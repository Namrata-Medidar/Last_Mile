INSERT INTO public.permissions (code, module, description)
VALUES (
  'sidebar.project_team.ticket.view',
  'Sidebar',
  'View tickets in the Project Team workspace'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT old_grant.role_id, replacement.id
FROM public.role_permissions AS old_grant
JOIN public.permissions AS old_permission
  ON old_permission.id = old_grant.permission_id
JOIN public.permissions AS replacement
  ON replacement.code = 'sidebar.project_team.ticket.view'
WHERE old_permission.code = 'tickets.view'
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions AS existing
    WHERE existing.role_id = old_grant.role_id
      AND existing.permission_id = replacement.id
  );

DROP POLICY IF EXISTS "Permission-aware booking reads" ON public.bookings;
CREATE POLICY "Permission-aware booking reads"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'sidebar.project_team.ticket.view')
  )
  OR (
    public.has_role(auth.uid(), 'engineer')
    AND engineer_id IS NOT NULL
    AND engineer_id = public.my_engineer_id()
  )
  OR public.has_permission(auth.uid(), 'users.engineer_dispatch')
);

DROP POLICY IF EXISTS "Permission-aware booking reads restrictive" ON public.bookings;
CREATE POLICY "Permission-aware booking reads restrictive"
ON public.bookings
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'sidebar.project_team.ticket.view')
  )
  OR (
    public.has_role(auth.uid(), 'engineer')
    AND engineer_id IS NOT NULL
    AND engineer_id = public.my_engineer_id()
  )
  OR public.has_permission(auth.uid(), 'users.engineer_dispatch')
);

DROP POLICY IF EXISTS "Customer bookings and ticket creation" ON public.bookings;
CREATE POLICY "Customer bookings and ticket creation"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  AND status = 'Open'
  AND engineer_name = 'Unassigned'
  AND details ->> 'createdVia' IS DISTINCT FROM 'staff_sample'
);

DROP POLICY IF EXISTS "Booking insert permission restrictive" ON public.bookings;
CREATE POLICY "Booking insert permission restrictive"
ON public.bookings
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  AND status = 'Open'
  AND engineer_name = 'Unassigned'
  AND details ->> 'createdVia' IS DISTINCT FROM 'staff_sample'
);

DROP POLICY IF EXISTS "Permission-aware comment reads" ON public.booking_comments;
CREATE POLICY "Permission-aware comment reads"
ON public.booking_comments
FOR SELECT
TO authenticated
USING (
  (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'sidebar.project_team.ticket.view')
  )
  OR (
    visibility = 'public'
    AND EXISTS (
      SELECT 1
      FROM public.bookings AS b
      WHERE b.id = booking_id
        AND (
          b.customer_id = auth.uid()
          OR (
            public.has_role(auth.uid(), 'engineer')
            AND b.engineer_id = public.my_engineer_id()
          )
        )
    )
  )
);

DROP POLICY IF EXISTS "Permission-aware comment reads restrictive" ON public.booking_comments;
CREATE POLICY "Permission-aware comment reads restrictive"
ON public.booking_comments
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'sidebar.project_team.ticket.view')
  )
  OR (
    visibility = 'public'
    AND EXISTS (
      SELECT 1
      FROM public.bookings AS b
      WHERE b.id = booking_id
        AND (
          b.customer_id = auth.uid()
          OR (
            public.has_role(auth.uid(), 'engineer')
            AND b.engineer_id = public.my_engineer_id()
          )
        )
    )
  )
);

DROP POLICY IF EXISTS "Permission-aware booking event reads" ON public.booking_events;
CREATE POLICY "Permission-aware booking event reads"
ON public.booking_events
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'sidebar.project_team.ticket.view')
  OR EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = booking_id
      AND (
        b.customer_id = auth.uid()
        OR b.engineer_id = public.my_engineer_id()
      )
  )
);

DROP POLICY IF EXISTS "Permission-aware booking event reads restrictive" ON public.booking_events;
CREATE POLICY "Permission-aware booking event reads restrictive"
ON public.booking_events
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'sidebar.project_team.ticket.view')
  OR EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = booking_id
      AND (
        b.customer_id = auth.uid()
        OR b.engineer_id = public.my_engineer_id()
      )
  )
);

DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id
  FROM public.permissions
  WHERE code IN ('tickets.create', 'tickets.view')
);

DELETE FROM public.permissions
WHERE code IN ('tickets.create', 'tickets.view');
