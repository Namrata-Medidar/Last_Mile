DROP POLICY IF EXISTS "Permission-aware role reads" ON public.roles;
DROP POLICY IF EXISTS "Permission-aware role reads restrictive" ON public.roles;
CREATE POLICY "Permission-aware role reads"
ON public.roles
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'roles.tab_view')
  OR public.user_has_role_id(auth.uid(), id)
);
CREATE POLICY "Permission-aware role reads restrictive"
ON public.roles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'roles.tab_view')
  OR public.user_has_role_id(auth.uid(), id)
);

DROP POLICY IF EXISTS "Permission-aware permission catalog reads" ON public.permissions;
DROP POLICY IF EXISTS "Permission-aware permission catalog reads restrictive" ON public.permissions;
CREATE POLICY "Permission-aware permission catalog reads"
ON public.permissions
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'roles.tab_view')
  OR public.has_permission(auth.uid(), 'roles.manage_permissions')
  OR public.user_has_permission_id(auth.uid(), id)
);
CREATE POLICY "Permission-aware permission catalog reads restrictive"
ON public.permissions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'roles.tab_view')
  OR public.has_permission(auth.uid(), 'roles.manage_permissions')
  OR public.user_has_permission_id(auth.uid(), id)
);

DROP POLICY IF EXISTS "Permission-aware role permission reads" ON public.role_permissions;
DROP POLICY IF EXISTS "Permission-aware role permission reads restrictive" ON public.role_permissions;
CREATE POLICY "Permission-aware role permission reads"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'roles.tab_view')
  OR public.has_permission(auth.uid(), 'roles.manage_permissions')
  OR public.user_has_role_id(auth.uid(), role_id)
);
CREATE POLICY "Permission-aware role permission reads restrictive"
ON public.role_permissions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'roles.tab_view')
  OR public.has_permission(auth.uid(), 'roles.manage_permissions')
  OR public.user_has_role_id(auth.uid(), role_id)
);
