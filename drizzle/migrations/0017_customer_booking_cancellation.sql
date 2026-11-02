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

  UPDATE public.bookings
  SET status = 'Cancelled',
      updated_by = auth.uid()
  WHERE id = _booking_id
    AND customer_id = auth.uid()
    AND status = 'Open'
    AND engineer_name = 'Unassigned'
    AND engineer_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only your open bookings without an assigned engineer can be cancelled';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_booking(uuid) TO authenticated;
