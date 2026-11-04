CREATE OR REPLACE FUNCTION public.can_read_ticket(_customer_id uuid, _engineer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'super_admin') THEN true
    WHEN public.has_role(auth.uid(), 'engineer')
      THEN COALESCE(_engineer_id = public.my_engineer_id(), false)
    WHEN public.has_role(auth.uid(), 'customer')
      THEN _customer_id = auth.uid()
    ELSE (
      public.has_permission(auth.uid(), 'sidebar.project_team.ticket.view')
      OR public.has_permission(auth.uid(), 'sidebar.project_team.dashboard.view')
      OR public.has_permission(auth.uid(), 'users.engineer_dispatch')
    )
  END
$$;

REVOKE ALL ON FUNCTION public.can_read_ticket(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_ticket(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Permission-aware booking reads" ON public.bookings;
CREATE POLICY "Permission-aware booking reads"
ON public.bookings FOR SELECT TO authenticated
USING (public.can_read_ticket(customer_id, engineer_id));

DROP POLICY IF EXISTS "Permission-aware booking reads restrictive" ON public.bookings;
CREATE POLICY "Permission-aware booking reads restrictive"
ON public.bookings AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.can_read_ticket(customer_id, engineer_id));

DROP POLICY IF EXISTS "Permission-aware comment reads" ON public.booking_comments;
CREATE POLICY "Permission-aware comment reads"
ON public.booking_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings AS b
    WHERE b.id = booking_id
      AND public.can_read_ticket(b.customer_id, b.engineer_id)
      AND (
        visibility = 'public'
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'engineer')
        OR NOT public.has_role(auth.uid(), 'customer')
      )
  )
);

DROP POLICY IF EXISTS "Permission-aware comment reads restrictive" ON public.booking_comments;
CREATE POLICY "Permission-aware comment reads restrictive"
ON public.booking_comments AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings AS b
    WHERE b.id = booking_id
      AND public.can_read_ticket(b.customer_id, b.engineer_id)
      AND (
        visibility = 'public'
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'engineer')
        OR NOT public.has_role(auth.uid(), 'customer')
      )
  )
);

DROP POLICY IF EXISTS "Permission-aware booking event reads" ON public.booking_events;
CREATE POLICY "Permission-aware booking event reads"
ON public.booking_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings AS b
    WHERE b.id = booking_id
      AND public.can_read_ticket(b.customer_id, b.engineer_id)
  )
);

DROP POLICY IF EXISTS "Permission-aware booking event reads restrictive" ON public.booking_events;
CREATE POLICY "Permission-aware booking event reads restrictive"
ON public.booking_events AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings AS b
    WHERE b.id = booking_id
      AND public.can_read_ticket(b.customer_id, b.engineer_id)
  )
);

NOTIFY pgrst, 'reload schema';
