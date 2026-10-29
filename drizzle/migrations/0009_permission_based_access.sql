CREATE OR REPLACE FUNCTION public.user_has_role_id(_user_id uuid, _role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND ur.role_id = _role_id
      AND ur.status = 'active'
      AND r.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission_id(_user_id uuid, _permission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = r.id
    WHERE ur.user_id = _user_id
      AND ur.status = 'active'
      AND rp.permission_id = _permission_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND ur.status = 'active'
      AND p.code = _permission_code
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_role_permissions(_role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(auth.uid(), 'roles.manage_permissions')
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR NOT public.user_has_role_id(auth.uid(), _role_id)
    );
$$;

REVOKE ALL ON FUNCTION public.user_has_role_id(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_permission_id(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_role_permissions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_role_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_role_permissions(uuid) TO authenticated;

DROP POLICY IF EXISTS "Customers read own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Engineers read assigned jobs" ON public.bookings;
DROP POLICY IF EXISTS "Staff update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers create own bookings" ON public.bookings;

CREATE POLICY "Permission-aware booking reads"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.has_permission(auth.uid(), 'tickets.view')
  OR (engineer_id IS NOT NULL AND engineer_id = public.my_engineer_id())
);
CREATE POLICY "Permission-aware booking reads restrictive"
ON public.bookings
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.has_permission(auth.uid(), 'tickets.view')
  OR (engineer_id IS NOT NULL AND engineer_id = public.my_engineer_id())
);

CREATE POLICY "Customers and ticket editors update bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  public.has_permission(auth.uid(), 'tickets.edit')
)
WITH CHECK (
  public.has_permission(auth.uid(), 'tickets.edit')
);
CREATE POLICY "Ticket edit permission required restrictive"
ON public.bookings
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.has_permission(auth.uid(), 'tickets.edit')
)
WITH CHECK (
  public.has_permission(auth.uid(), 'tickets.edit')
);

CREATE POLICY "Customer bookings and ticket creation"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  (
    customer_id = auth.uid()
    AND status = 'Open'
    AND engineer_name = 'Unassigned'
    AND details ->> 'createdVia' IS DISTINCT FROM 'staff_sample'
  )
  OR (
    customer_id = auth.uid()
    AND public.has_permission(auth.uid(), 'tickets.create')
    AND details ->> 'createdVia' = 'staff_sample'
  )
);
CREATE POLICY "Booking insert permission restrictive"
ON public.bookings
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (
    customer_id = auth.uid()
    AND status = 'Open'
    AND engineer_name = 'Unassigned'
    AND details ->> 'createdVia' IS DISTINCT FROM 'staff_sample'
  )
  OR (
    customer_id = auth.uid()
    AND public.has_permission(auth.uid(), 'tickets.create')
    AND details ->> 'createdVia' = 'staff_sample'
  )
);

GRANT DELETE ON public.bookings TO authenticated;
CREATE POLICY "Ticket delete permission"
ON public.bookings
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), 'tickets.delete'));
CREATE POLICY "Ticket delete permission restrictive"
ON public.bookings
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), 'tickets.delete'));

DROP POLICY IF EXISTS "Read comments" ON public.booking_comments;
DROP POLICY IF EXISTS "Engineers read job comments" ON public.booking_comments;
DROP POLICY IF EXISTS "Write comments" ON public.booking_comments;
CREATE POLICY "Permission-aware comment reads"
ON public.booking_comments
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'tickets.view')
  OR (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (
          b.customer_id = auth.uid()
          OR b.engineer_id = public.my_engineer_id()
        )
    )
  )
);
CREATE POLICY "Permission-aware comment reads restrictive"
ON public.booking_comments
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'tickets.view')
  OR (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (
          b.customer_id = auth.uid()
          OR b.engineer_id = public.my_engineer_id()
        )
    )
  )
);

CREATE POLICY "Customers and ticket editors write comments"
ON public.booking_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    (
      visibility = 'public'
      AND EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_id AND b.customer_id = auth.uid()
      )
    )
    OR public.has_permission(auth.uid(), 'tickets.edit')
  )
);
CREATE POLICY "Ticket edit permission required for comment writes"
ON public.booking_comments
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    (
      visibility = 'public'
      AND EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_id AND b.customer_id = auth.uid()
      )
    )
    OR public.has_permission(auth.uid(), 'tickets.edit')
  )
);

DROP POLICY IF EXISTS "Read events of visible bookings" ON public.booking_events;
DROP POLICY IF EXISTS "Engineers read job events" ON public.booking_events;
CREATE POLICY "Permission-aware booking event reads"
ON public.booking_events
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'tickets.view')
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND (
        b.customer_id = auth.uid()
        OR b.engineer_id = public.my_engineer_id()
      )
  )
);
CREATE POLICY "Permission-aware booking event reads restrictive"
ON public.booking_events
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'tickets.view')
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND (
        b.customer_id = auth.uid()
        OR b.engineer_id = public.my_engineer_id()
      )
  )
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Role create permission"
ON public.roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'roles.create'));
CREATE POLICY "Role create permission restrictive"
ON public.roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'roles.create'));
CREATE POLICY "Role edit permission"
ON public.roles
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), 'roles.edit'))
WITH CHECK (public.has_permission(auth.uid(), 'roles.edit'));
CREATE POLICY "Role edit permission restrictive"
ON public.roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), 'roles.edit'))
WITH CHECK (public.has_permission(auth.uid(), 'roles.edit'));

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
CREATE POLICY "Manage role permissions"
ON public.role_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_role_permissions(role_id));
CREATE POLICY "Manage role permissions restrictive insert"
ON public.role_permissions
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_role_permissions(role_id));
CREATE POLICY "Manage role permission updates"
ON public.role_permissions
FOR UPDATE
TO authenticated
USING (public.can_manage_role_permissions(role_id))
WITH CHECK (public.can_manage_role_permissions(role_id));
CREATE POLICY "Manage role permission updates restrictive"
ON public.role_permissions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.can_manage_role_permissions(role_id))
WITH CHECK (public.can_manage_role_permissions(role_id));
CREATE POLICY "Manage role permission deletes"
ON public.role_permissions
FOR DELETE
TO authenticated
USING (public.can_manage_role_permissions(role_id));
CREATE POLICY "Manage role permission deletes restrictive"
ON public.role_permissions
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.can_manage_role_permissions(role_id));

CREATE POLICY "Permission-aware user role reads"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'users.view'));
CREATE POLICY "Permission-aware user role reads restrictive"
ON public.user_roles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'users.view'));
CREATE POLICY "Manage user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), 'users.manage')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);
CREATE POLICY "Manage user roles restrictive insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), 'users.manage')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);
CREATE POLICY "Manage user role updates"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.has_permission(auth.uid(), 'users.manage')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
)
WITH CHECK (
  public.has_permission(auth.uid(), 'users.manage')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);
CREATE POLICY "Manage user role updates restrictive"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.has_permission(auth.uid(), 'users.manage')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
)
WITH CHECK (
  public.has_permission(auth.uid(), 'users.manage')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);
CREATE POLICY "Manage user role deletes"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_permission(auth.uid(), 'users.manage')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);
CREATE POLICY "Manage user role deletes restrictive"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  public.has_permission(auth.uid(), 'users.manage')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

DROP POLICY IF EXISTS "Own profile read" ON public.profiles;
CREATE POLICY "Permission-aware profile reads"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_permission(auth.uid(), 'users.view'));
CREATE POLICY "Permission-aware profile reads restrictive"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_permission(auth.uid(), 'users.view'));
CREATE POLICY "Profile edit permission restrictive"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.has_permission(auth.uid(), 'users.edit'))
WITH CHECK (id = auth.uid() OR public.has_permission(auth.uid(), 'users.edit'));

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.manage')
    OR NOT (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _role = 'super_admin' AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can change super admin access';
  END IF;
  IF _user_id = auth.uid() AND NOT _grant AND _role IN ('super_admin','admin') THEN
    RAISE EXCEPTION 'You cannot remove your own admin access';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role, created_by)
    SELECT _user_id, _role, auth.uid()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = _role;
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, new_data)
  VALUES (
    auth.uid(),
    CASE WHEN _grant THEN 'grant_role' ELSE 'revoke_role' END,
    'user_roles',
    _user_id::text,
    jsonb_build_object('role', _role)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) TO authenticated;
