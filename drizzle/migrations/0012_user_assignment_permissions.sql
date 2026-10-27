INSERT INTO public.permissions (code, module, description)
VALUES
  ('users.tab_view', 'Users', 'View the User Assignments tab'),
  ('users.assign_role', 'Users', 'Assign roles to users'),
  ('users.revoke_role', 'Users', 'Revoke roles from users')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles AS r
CROSS JOIN public.permissions AS p
WHERE r.slug = 'super_admin'
  AND p.code IN ('users.tab_view', 'users.assign_role', 'users.revoke_role')
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions AS rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );

DROP POLICY IF EXISTS "Permission-aware profile reads" ON public.profiles;
DROP POLICY IF EXISTS "Permission-aware profile reads restrictive" ON public.profiles;
CREATE POLICY "Permission-aware profile reads"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_permission(auth.uid(), 'users.view')
  OR public.has_permission(auth.uid(), 'users.tab_view')
);
CREATE POLICY "Permission-aware profile reads restrictive"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_permission(auth.uid(), 'users.view')
  OR public.has_permission(auth.uid(), 'users.tab_view')
);

DROP POLICY IF EXISTS "Permission-aware user role reads" ON public.user_roles;
DROP POLICY IF EXISTS "Permission-aware user role reads restrictive" ON public.user_roles;
CREATE POLICY "Permission-aware user role reads"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'users.view')
  OR public.has_permission(auth.uid(), 'users.tab_view')
);
CREATE POLICY "Permission-aware user role reads restrictive"
ON public.user_roles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'users.view')
  OR public.has_permission(auth.uid(), 'users.tab_view')
);

DROP POLICY IF EXISTS "Permission-aware role reads" ON public.roles;
DROP POLICY IF EXISTS "Permission-aware role reads restrictive" ON public.roles;
CREATE POLICY "Permission-aware role reads"
ON public.roles
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'roles.tab_view')
  OR public.has_permission(auth.uid(), 'users.tab_view')
  OR public.user_has_role_id(auth.uid(), id)
);
CREATE POLICY "Permission-aware role reads restrictive"
ON public.roles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'roles.tab_view')
  OR public.has_permission(auth.uid(), 'users.tab_view')
  OR public.user_has_role_id(auth.uid(), id)
);

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.roles;
  target_user_id uuid;
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

  IF target_role.slug NOT IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
    RAISE EXCEPTION 'Role cannot be assigned to an application user';
  END IF;

  IF target_role.slug = 'super_admin'
    AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can assign super admin access';
  END IF;

  IF coalesce(cardinality(_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one user';
  END IF;

  FOREACH target_user_id IN ARRAY _user_ids LOOP
    INSERT INTO public.user_roles(user_id, role_id, role, status, created_by)
    VALUES (target_user_id, target_role.id, target_role.slug::public.app_role, 'active', auth.uid())
    ON CONFLICT (user_id, role)
    DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active';
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_user_roles(_assignment_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_row public.user_roles;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.revoke_role')
    OR NOT (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF coalesce(cardinality(_assignment_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one role assignment';
  END IF;

  FOR assignment_row IN
    SELECT * FROM public.user_roles WHERE id = ANY(_assignment_ids)
  LOOP
    IF assignment_row.user_id = auth.uid()
      AND assignment_row.role IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'You cannot revoke your own admin access';
    END IF;
    IF assignment_row.role = 'super_admin'
      AND NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Only a super admin can revoke super admin access';
    END IF;
  END LOOP;

  DELETE FROM public.user_roles
  WHERE id = ANY(_assignment_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_user_roles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_roles(uuid[]) TO authenticated;
