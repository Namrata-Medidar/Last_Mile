-- Fix ticket visibility for team members with project_team permissions
-- Issue: Team members with "admin" role or custom roles with project_team permissions
-- couldn't see tickets because has_permission() wasn't working correctly

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND (
    -- Check via custom roles
    EXISTS (
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
    )
    OR
    -- Check if user is staff (admin, ops_manager, super_admin) - grant all team permissions
    (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        WHERE p.id = _user_id
          AND p.status = 'active'
          AND ur.status = 'active'
          AND ur.role IN ('super_admin', 'admin', 'ops_manager')
      )
      AND _permission_code LIKE 'sidebar.project_team.%'
    )
  );
$$;

NOTIFY pgrst, 'reload schema';
