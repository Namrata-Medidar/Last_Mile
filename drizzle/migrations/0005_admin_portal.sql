CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _role = 'super_admin' AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can change super admin access';
  END IF;
  IF _user_id = auth.uid() AND NOT _grant AND _role IN ('super_admin','admin') THEN
    RAISE EXCEPTION 'You cannot remove your own admin access';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role, created_by) SELECT _user_id, _role, auth.uid()
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
  ELSE
    DELETE FROM public.user_roles WHERE user_id=_user_id AND role=_role;
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, new_data)
  VALUES (auth.uid(), CASE WHEN _grant THEN 'grant_role' ELSE 'revoke_role' END, 'user_roles', _user_id::text, jsonb_build_object('role', _role));
END $$;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) TO authenticated;