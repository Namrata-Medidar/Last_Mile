CREATE OR REPLACE FUNCTION public.ensure_assignment_role_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role_id IS NULL AND NEW.role IS NOT NULL THEN
    SELECT id INTO NEW.role_id
    FROM public.roles
    WHERE slug = NEW.role::text;
  END IF;

  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION 'A role assignment must reference an existing role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id) THEN
    RAISE EXCEPTION 'Assigned role does not exist';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_assignment_role_link() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_roles_require_role_link
BEFORE INSERT OR UPDATE OF role_id, role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.ensure_assignment_role_link();

NOTIFY pgrst, 'reload schema';
