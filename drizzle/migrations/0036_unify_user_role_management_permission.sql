INSERT INTO public.permissions (code, module, description)
VALUES ('users.role_management', 'Users', 'Assign and revoke user roles')
ON CONFLICT (code) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, new_permission.id
FROM public.role_permissions AS rp
JOIN public.permissions AS old_permission
  ON old_permission.id = rp.permission_id
JOIN public.permissions AS new_permission
  ON new_permission.code = 'users.role_management'
WHERE old_permission.code IN ('users.assign_role', 'users.revoke_role')
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id
  FROM public.permissions
  WHERE code IN ('users.assign_role', 'users.revoke_role')
);

DELETE FROM public.permissions
WHERE code IN ('users.assign_role', 'users.revoke_role');

-- NOTE: assign_user_role and revoke_user_roles functions are now defined in migration 0052_fix_assign_engineer_role.sql
-- This migration previously defined them with a flawed ON CONFLICT approach that didn't work for system roles
-- The fixed versions use explicit check-before-insert logic instead

CREATE OR REPLACE FUNCTION public.revoke_user_roles(_assignment_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_row public.user_roles;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.role_management')
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

REVOKE ALL ON FUNCTION public.revoke_user_roles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_user_roles(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
