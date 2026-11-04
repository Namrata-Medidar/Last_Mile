INSERT INTO public.permissions (code, module, description)
VALUES
  ('users.approve_reject', 'Users', 'Approve or reject user accounts'),
  ('users.engineer_dispatch', 'Users', 'Access Engineers & dispatch')
ON CONFLICT (code) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles AS r
CROSS JOIN public.permissions AS p
WHERE r.slug = 'super_admin'
  AND p.code IN ('users.approve_reject', 'users.engineer_dispatch')
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions AS rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

CREATE OR REPLACE FUNCTION public.protect_user_approval_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot change your own account approval status';
    END IF;

    IF NOT public.has_permission(auth.uid(), 'users.approve_reject') THEN
      RAISE EXCEPTION 'Missing permission: users.approve_reject';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_account_approval(
  _user_id uuid,
  _status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.approve_reject') THEN
    RAISE EXCEPTION 'Missing permission: users.approve_reject';
  END IF;

  IF _status NOT IN ('active', 'rejected') THEN
    RAISE EXCEPTION 'Status must be active or rejected';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own account approval status';
  END IF;

  UPDATE public.profiles
  SET status = _status,
      updated_by = auth.uid()
  WHERE id = _user_id
    AND status IN ('pending', 'rejected');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or not awaiting approval';
  END IF;

  IF _status = 'active' THEN
    UPDATE public.user_roles
    SET status = 'active',
        updated_by = auth.uid()
    WHERE user_id = _user_id;
  ELSE
    UPDATE public.user_roles
    SET status = 'inactive',
        updated_by = auth.uid()
    WHERE user_id = _user_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, new_data)
  VALUES (
    auth.uid(),
    CASE WHEN _status = 'active' THEN 'approve_user' ELSE 'reject_user' END,
    'profiles',
    _user_id::text,
    jsonb_build_object('status', _status)
  );
END;
$$;

DROP POLICY IF EXISTS "Permission role reads engineer list" ON public.engineers;
CREATE POLICY "Permission role reads engineer list"
ON public.engineers
FOR SELECT
TO authenticated
USING (public.has_permission(auth.uid(), 'users.engineer_dispatch'));

DROP POLICY IF EXISTS "Permission role manages engineers" ON public.engineers;
CREATE POLICY "Permission role manages engineers"
ON public.engineers
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), 'users.engineer_dispatch'))
WITH CHECK (public.has_permission(auth.uid(), 'users.engineer_dispatch'));

DROP POLICY IF EXISTS "Permission-aware booking reads" ON public.bookings;
CREATE POLICY "Permission-aware booking reads"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'tickets.view')
  )
  OR (
    public.has_role(auth.uid(), 'engineer')
    AND engineer_id IS NOT NULL
    AND engineer_id = public.my_engineer_id()
  )
  OR public.has_permission(auth.uid(), 'users.engineer_dispatch')
);

DROP POLICY IF EXISTS "Permission-aware booking reads restrictive" ON public.bookings;
CREATE POLICY "Permission-aware booking reads restrictive"
ON public.bookings
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'tickets.view')
  )
  OR (
    public.has_role(auth.uid(), 'engineer')
    AND engineer_id IS NOT NULL
    AND engineer_id = public.my_engineer_id()
  )
  OR public.has_permission(auth.uid(), 'users.engineer_dispatch')
);

CREATE OR REPLACE FUNCTION public.assign_booking_engineer(
  _booking_id uuid,
  _engineer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_engineer public.engineers;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(), 'ticket.addassignee')
    OR public.has_permission(auth.uid(), 'users.engineer_dispatch')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _engineer_id IS NOT NULL THEN
    SELECT * INTO selected_engineer
    FROM public.engineers
    WHERE id = _engineer_id
      AND approval_status = 'approved'
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Engineer is not approved or is inactive';
    END IF;
  END IF;

  UPDATE public.bookings
  SET engineer_id = _engineer_id,
      engineer_name = COALESCE(selected_engineer.full_name, 'Unassigned'),
      engineer_phone = selected_engineer.phone,
      status = CASE WHEN _engineer_id IS NOT NULL THEN 'In Progress' ELSE status END,
      progress = CASE WHEN _engineer_id IS NOT NULL THEN greatest(progress, 45) ELSE progress END
  WHERE id = _booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_booking_assignee(
  _booking_id uuid,
  _engineer_name text,
  _engineer_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_engineer_id uuid;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(), 'ticket.addassignee')
    OR public.has_permission(auth.uid(), 'users.engineer_dispatch')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF COALESCE(NULLIF(BTRIM(_engineer_name), ''), 'Unassigned') <> 'Unassigned' THEN
    SELECT id INTO selected_engineer_id
    FROM public.engineers
    WHERE full_name = BTRIM(_engineer_name)
      AND approval_status = 'approved'
      AND status = 'active'
    ORDER BY created_at
    LIMIT 1;

    IF selected_engineer_id IS NULL THEN
      RAISE EXCEPTION 'Select an approved engineer from the engineer list';
    END IF;
  END IF;

  PERFORM public.assign_booking_engineer(_booking_id, selected_engineer_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_account_approval(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_account_approval(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.assign_booking_engineer(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_booking_assignee(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_booking_engineer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_booking_assignee(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
