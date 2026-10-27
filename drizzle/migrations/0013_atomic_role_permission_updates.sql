CREATE OR REPLACE FUNCTION public.save_role_permissions(
  _role_id uuid,
  _permission_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_ids uuid[] := coalesce(_permission_ids, ARRAY[]::uuid[]);
BEGIN
  IF NOT public.can_manage_role_permissions(_role_id) THEN
    RAISE EXCEPTION 'Forbidden: roles.manage_permissions is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.roles
    WHERE id = _role_id
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Role not found or inactive';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(requested_ids) AS requested(permission_id)
    LEFT JOIN public.permissions AS permission
      ON permission.id = requested.permission_id
    WHERE permission.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more selected permissions do not exist';
  END IF;

  DELETE FROM public.role_permissions AS existing
  WHERE existing.role_id = _role_id
    AND NOT (existing.permission_id = ANY(requested_ids));

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT _role_id, requested.permission_id
  FROM (
    SELECT DISTINCT permission_id
    FROM unnest(requested_ids) AS selected(permission_id)
  ) AS requested
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.role_permissions AS existing
    WHERE existing.role_id = _role_id
      AND existing.permission_id = requested.permission_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.save_role_permissions(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_role_permissions(uuid, uuid[]) TO authenticated;
