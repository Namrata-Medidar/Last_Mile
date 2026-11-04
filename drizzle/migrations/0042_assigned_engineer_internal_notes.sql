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
  OR EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = booking_id
      AND (
        (visibility = 'public' AND b.customer_id = auth.uid())
        OR (
          public.has_role(auth.uid(), 'engineer')
          AND b.engineer_id = public.my_engineer_id()
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
  OR EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = booking_id
      AND (
        (visibility = 'public' AND b.customer_id = auth.uid())
        OR (
          public.has_role(auth.uid(), 'engineer')
          AND b.engineer_id = public.my_engineer_id()
        )
      )
  )
);

NOTIFY pgrst, 'reload schema';
