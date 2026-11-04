INSERT INTO public.permissions (code, module, description)
VALUES
  ('users.tab_view', 'Users', 'View the User Management tab'),
  ('users.delete', 'Users', 'Soft-delete user accounts'),
  ('users.assign_role', 'Users', 'Manage user role assignments'),
  ('users.revoke_role', 'Users', 'Remove user role assignments'),
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
  AND p.code IN (
    'users.tab_view',
    'users.delete',
    'users.assign_role',
    'users.revoke_role',
    'users.approve_reject',
    'users.engineer_dispatch'
  )
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

    IF NEW.status = 'deleted' THEN
      IF NOT public.has_permission(auth.uid(), 'users.delete') THEN
        RAISE EXCEPTION 'Missing permission: users.delete';
      END IF;
    ELSIF NOT public.has_permission(auth.uid(), 'users.approve_reject') THEN
      RAISE EXCEPTION 'Missing permission: users.approve_reject';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
