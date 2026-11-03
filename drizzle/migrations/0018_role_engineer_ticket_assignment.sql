CREATE OR REPLACE FUNCTION public.sync_engineer_role_profile(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_engineer_role boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND ur.status = 'active'
      AND (ur.role = 'engineer' OR r.slug = 'engineer')
  ) INTO has_engineer_role;

  IF has_engineer_role THEN
    INSERT INTO public.engineers AS existing_engineer (
      user_id,
      full_name,
      phone,
      city,
      approval_status,
      available,
      status
    )
    SELECT
      u.id,
      COALESCE(
        NULLIF(BTRIM(p.full_name), ''),
        NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(SPLIT_PART(u.email, '@', 1), ''),
        'Engineer'
      ),
      COALESCE(NULLIF(BTRIM(p.phone), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), '')),
      'Not specified',
      'approved',
      true,
      'active'
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = _user_id
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, existing_engineer.phone),
        approval_status = 'approved',
        available = true,
        status = 'active'
    WHERE existing_engineer.full_name IS DISTINCT FROM EXCLUDED.full_name
      OR existing_engineer.phone IS DISTINCT FROM COALESCE(EXCLUDED.phone, existing_engineer.phone)
      OR existing_engineer.approval_status IS DISTINCT FROM 'approved'
      OR existing_engineer.available IS DISTINCT FROM true
      OR existing_engineer.status IS DISTINCT FROM 'active';
  ELSE
    UPDATE public.engineers
    SET approval_status = 'suspended',
        available = false
    WHERE user_id = _user_id
      AND approval_status IS DISTINCT FROM 'suspended';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_engineer_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_is_engineer boolean := false;
  new_is_engineer boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT OLD.role = 'engineer' OR EXISTS (
      SELECT 1 FROM public.roles r WHERE r.id = OLD.role_id AND r.slug = 'engineer'
    ) INTO old_is_engineer;
    IF old_is_engineer THEN
      PERFORM public.sync_engineer_role_profile(OLD.user_id);
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT NEW.role = 'engineer' OR EXISTS (
      SELECT 1 FROM public.roles r WHERE r.id = NEW.role_id AND r.slug = 'engineer'
    ) INTO new_is_engineer;
    IF new_is_engineer THEN
      PERFORM public.sync_engineer_role_profile(NEW.user_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_engineer_profile_sync ON public.user_roles;
CREATE TRIGGER user_roles_engineer_profile_sync
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_engineer_role_assignment();

CREATE OR REPLACE FUNCTION public.sync_engineer_profile_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = NEW.id
      AND ur.status = 'active'
      AND (ur.role = 'engineer' OR r.slug = 'engineer')
  ) THEN
    PERFORM public.sync_engineer_role_profile(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_engineer_contact_sync ON public.profiles;
CREATE TRIGGER profiles_engineer_contact_sync
AFTER UPDATE OF full_name, phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_engineer_profile_contact();

DO $$
DECLARE
  engineer_user_id uuid;
BEGIN
  FOR engineer_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.status = 'active'
      AND (ur.role = 'engineer' OR r.slug = 'engineer')
  LOOP
    PERFORM public.sync_engineer_role_profile(engineer_user_id);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Assignee permission reads engineer list" ON public.engineers;
CREATE POLICY "Assignee permission reads engineer list"
ON public.engineers
FOR SELECT
TO authenticated
USING (public.has_permission(auth.uid(), 'ticket.addassignee'));

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
  IF NOT public.has_permission(auth.uid(), 'ticket.addassignee') THEN
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
  IF NOT public.has_permission(auth.uid(), 'ticket.addassignee') THEN
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

REVOKE ALL ON FUNCTION public.sync_engineer_role_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_engineer_role_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_engineer_profile_contact() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_booking_engineer(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_booking_assignee(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_booking_engineer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_booking_assignee(uuid, text, text) TO authenticated;
