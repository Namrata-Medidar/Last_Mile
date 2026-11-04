CREATE OR REPLACE FUNCTION public.soft_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can delete user accounts';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  PERFORM 1
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE public.profiles
  SET status = 'deleted',
      updated_by = auth.uid()
  WHERE id = _user_id
    AND status <> 'deleted';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account is already deleted';
  END IF;

  UPDATE public.user_roles
  SET status = 'inactive',
      updated_by = auth.uid()
  WHERE user_id = _user_id
    AND status = 'active';

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, new_data)
  VALUES (
    auth.uid(),
    'soft_delete_user',
    'profiles',
    _user_id::text,
    jsonb_build_object('status', 'deleted')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_user(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
