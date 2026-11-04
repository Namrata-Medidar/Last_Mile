ALTER TABLE public.user_roles
  ALTER COLUMN role DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_id_unique
  ON public.user_roles (user_id, role_id);

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.roles;
  target_user_id uuid;
  system_role public.app_role;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.assign_role')
    OR NOT (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO target_role
  FROM public.roles
  WHERE id = _role_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found or inactive';
  END IF;

  IF target_role.slug IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
    system_role := target_role.slug::public.app_role;
  ELSE
    system_role := NULL;
  END IF;

  IF target_role.slug = 'super_admin'
    AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can assign super admin access';
  END IF;

  IF coalesce(cardinality(_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one user';
  END IF;

  FOREACH target_user_id IN ARRAY _user_ids LOOP
    IF system_role IS NULL THEN
      INSERT INTO public.user_roles(user_id, role_id, role, status, created_by)
      VALUES (target_user_id, target_role.id, NULL, 'active', auth.uid())
      ON CONFLICT (user_id, role_id)
      DO UPDATE SET status = 'active';
    ELSE
      INSERT INTO public.user_roles(user_id, role_id, role, status, created_by)
      VALUES (target_user_id, target_role.id, system_role, 'active', auth.uid())
      ON CONFLICT (user_id, role)
      DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active';
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;
