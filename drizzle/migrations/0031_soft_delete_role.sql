UPDATE public.permissions
SET description = 'Delete custom roles (soft delete)'
WHERE code = 'roles.deactivate';

CREATE OR REPLACE FUNCTION public.soft_delete_role(_role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.roles;
BEGIN
  SELECT * INTO target_role
  FROM public.roles
  WHERE id = _role_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF target_role.is_system THEN
    RAISE EXCEPTION 'System roles cannot be deleted.';
  END IF;

  IF NOT target_role.is_active THEN
    RAISE EXCEPTION 'Role is already deleted.';
  END IF;

  IF NOT public.has_permission(auth.uid(), 'roles.deactivate') THEN
    RAISE EXCEPTION 'Forbidden: roles.deactivate is required to delete a role';
  END IF;

  UPDATE public.roles
  SET is_active = false,
      updated_at = now()
  WHERE id = _role_id;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_role(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
