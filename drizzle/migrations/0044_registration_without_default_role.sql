CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bootstrap_super_admin boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('last-mile-bootstrap-super-admin'));

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'super_admin'
      AND status = 'active'
  ) INTO bootstrap_super_admin;

  INSERT INTO public.profiles (id, full_name, email, phone, company, status, created_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'company',
    CASE WHEN bootstrap_super_admin THEN 'active' ELSE 'pending' END,
    NEW.id
  );

  IF bootstrap_super_admin THEN
    INSERT INTO public.user_roles (user_id, role, status, created_by)
    VALUES (NEW.id, 'super_admin', 'active', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Remove only signup-created Customer assignments for accounts still awaiting approval.
DELETE FROM public.user_roles AS assignment
USING public.profiles AS profile
WHERE assignment.user_id = profile.id
  AND profile.status = 'pending'
  AND assignment.role = 'customer'
  AND assignment.status = 'pending'
  AND assignment.created_by = assignment.user_id;

NOTIFY pgrst, 'reload schema';
