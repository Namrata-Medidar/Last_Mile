DROP FUNCTION IF EXISTS public.cancel_my_booking(uuid, text);

CREATE OR REPLACE FUNCTION public.cancel_my_booking(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Your account must be approved before managing bookings';
  END IF;

  UPDATE public.bookings
  SET status = 'Cancelled',
      updated_by = auth.uid()
  WHERE id = _booking_id
    AND customer_id = auth.uid()
    AND status IN ('Open', 'In Progress');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only your open or in-progress bookings can be cancelled';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_booking(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
