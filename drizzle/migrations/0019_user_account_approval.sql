CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bootstrap_super_admin boolean;
  role_status text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('last-mile-bootstrap-super-admin'));

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'super_admin'
      AND status = 'active'
  ) INTO bootstrap_super_admin;

  role_status := CASE WHEN bootstrap_super_admin THEN 'active' ELSE 'pending' END;

  INSERT INTO public.profiles (id, full_name, email, phone, company, status, created_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'company',
    role_status,
    NEW.id
  );

  INSERT INTO public.user_roles (user_id, role, status, created_by)
  VALUES (NEW.id, 'customer', role_status, NEW.id);

  IF bootstrap_super_admin THEN
    INSERT INTO public.user_roles (user_id, role, status, created_by)
    VALUES (NEW.id, 'super_admin', 'active', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.constrain_pending_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_status text;
BEGIN
  SELECT status INTO account_status
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF account_status = 'pending' THEN
    NEW.status := 'pending';
  ELSIF account_status = 'rejected' THEN
    NEW.status := 'inactive';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_account_status_guard ON public.user_roles;
CREATE TRIGGER user_roles_account_status_guard
BEFORE INSERT OR UPDATE OF status ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.constrain_pending_user_role();

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = _user_id
        AND p.status = 'active'
        AND ur.role = _role
        AND ur.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = _user_id
        AND p.status = 'active'
        AND ur.status = 'active'
        AND ur.role IN ('super_admin', 'admin', 'ops_manager')
    );
$$;

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

    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Only a super admin can change account approval status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_approval_status_guard ON public.profiles;
CREATE TRIGGER profiles_approval_status_guard
BEFORE UPDATE OF status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_user_approval_status();

CREATE OR REPLACE FUNCTION public.user_has_role_id(_user_id uuid, _role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.id = _user_id
      AND p.status = 'active'
      AND ur.role_id = _role_id
      AND ur.status = 'active'
      AND r.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission_id(_user_id uuid, _permission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = r.id
    WHERE p.id = _user_id
      AND p.status = 'active'
      AND ur.status = 'active'
      AND rp.permission_id = _permission_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions permission ON permission.id = rp.permission_id
    WHERE p.id = _user_id
      AND p.status = 'active'
      AND ur.status = 'active'
      AND permission.code = _permission_code
  );
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
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can approve or reject user accounts';
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

REVOKE ALL ON FUNCTION public.constrain_pending_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_user_approval_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_user_account_approval(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_account_approval(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Approved account booking reads" ON public.bookings;
CREATE POLICY "Approved account booking reads"
ON public.bookings
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
  )
);

DROP POLICY IF EXISTS "Approved account booking inserts" ON public.bookings;
CREATE POLICY "Approved account booking inserts"
ON public.bookings
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
  )
);

DROP POLICY IF EXISTS "Approved account booking updates" ON public.bookings;
CREATE POLICY "Approved account booking updates"
ON public.bookings
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
  )
);

DROP POLICY IF EXISTS "Approved account booking deletes" ON public.bookings;
CREATE POLICY "Approved account booking deletes"
ON public.bookings
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.cancel_my_booking(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Your account must be approved before managing bookings';
  END IF;

  UPDATE public.bookings
  SET status = 'Cancelled',
      updated_by = auth.uid()
  WHERE id = _booking_id
    AND customer_id = auth.uid()
    AND status = 'Open'
    AND engineer_name = 'Unassigned'
    AND engineer_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only your open bookings without an assigned engineer can be cancelled';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_role_id(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_permission_id(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_booking(uuid) TO authenticated;
