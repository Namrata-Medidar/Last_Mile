DROP FUNCTION IF EXISTS public.cancel_my_booking(uuid);

CREATE OR REPLACE FUNCTION public.cancel_my_booking(
  _booking_id uuid,
  _message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_name text;
  clean_message text := NULLIF(BTRIM(_message), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF clean_message IS NOT NULL AND char_length(clean_message) > 2000 THEN
    RAISE EXCEPTION 'Cancellation message must be 2000 characters or fewer';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(full_name), ''), email, 'Customer')
  INTO customer_name
  FROM public.profiles
  WHERE id = auth.uid()
    AND status = 'active';

  IF NOT FOUND THEN
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

  IF clean_message IS NOT NULL THEN
    INSERT INTO public.booking_comments (
      booking_id,
      author_id,
      author_name,
      author_role,
      visibility,
      body,
      created_by
    )
    VALUES (
      _booking_id,
      auth.uid(),
      customer_name,
      'Customer',
      'public',
      'Cancellation message: ' || clean_message,
      auth.uid()
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_booking(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
