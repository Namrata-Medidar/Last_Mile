INSERT INTO public.permissions (code, module, description)
VALUES ('roles.deactivate', 'Roles', 'Deactivate roles')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_role_active(
  _role_id uuid,
  _is_active boolean
)
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
    RAISE EXCEPTION 'System roles cannot be deactivated.';
  END IF;

  IF _is_active THEN
    IF NOT public.has_permission(auth.uid(), 'roles.edit') THEN
      RAISE EXCEPTION 'Forbidden: roles.edit is required to activate a role';
    END IF;
  ELSIF NOT public.has_permission(auth.uid(), 'roles.deactivate') THEN
    RAISE EXCEPTION 'Forbidden: roles.deactivate is required to deactivate a role';
  END IF;

  UPDATE public.roles
  SET is_active = _is_active,
      updated_at = now()
  WHERE id = _role_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_role_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_role_active(uuid, boolean) TO authenticated;
