DROP POLICY IF EXISTS "Permission-aware booking reads" ON public.bookings;
DROP POLICY IF EXISTS "Permission-aware booking reads restrictive" ON public.bookings;

CREATE POLICY "Permission-aware booking reads"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'tickets.view')
  )
  OR (
    public.has_role(auth.uid(), 'engineer')
    AND engineer_id IS NOT NULL
    AND engineer_id = public.my_engineer_id()
  )
);

CREATE POLICY "Permission-aware booking reads restrictive"
ON public.bookings
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'tickets.view')
  )
  OR (
    public.has_role(auth.uid(), 'engineer')
    AND engineer_id IS NOT NULL
    AND engineer_id = public.my_engineer_id()
  )
);

DROP POLICY IF EXISTS "Permission-aware comment reads" ON public.booking_comments;
DROP POLICY IF EXISTS "Permission-aware comment reads restrictive" ON public.booking_comments;

CREATE POLICY "Permission-aware comment reads"
ON public.booking_comments
FOR SELECT
TO authenticated
USING (
  (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'tickets.view')
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

CREATE POLICY "Permission-aware comment reads restrictive"
ON public.booking_comments
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  (
    public.is_staff(auth.uid())
    AND public.has_permission(auth.uid(), 'tickets.view')
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
