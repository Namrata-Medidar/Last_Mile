ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_status_check,
  ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('Open', 'Assigned', 'In Progress', 'Closed', 'Cancelled'));

CREATE OR REPLACE FUNCTION public.pick_engineer(_booking_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH booking AS (
    SELECT
      COALESCE(details->>'level', 'L1') AS level,
      LOWER(COALESCE(city, '')) AS city
    FROM public.bookings
    WHERE id = _booking_id
  ),
  load AS (
    SELECT engineer_id, COUNT(*) AS active
    FROM public.bookings
    WHERE engineer_id IS NOT NULL
      AND status IN ('Open', 'Assigned', 'In Progress')
    GROUP BY engineer_id
  )
  SELECT engineer.id
  FROM public.engineers AS engineer
  CROSS JOIN booking
  LEFT JOIN load ON load.engineer_id = engineer.id
  WHERE engineer.approval_status = 'approved'
    AND engineer.status = 'active'
    AND COALESCE(load.active, 0) < engineer.max_active_jobs
    AND (
      POSITION('L2' IN booking.level) = 0
      OR engineer.grade = 'L2'
    )
  ORDER BY
    (booking.city <> '' AND LOWER(engineer.city) = booking.city) DESC,
    (engineer.grade = 'L1' AND POSITION('L2' IN booking.level) = 0) DESC,
    COALESCE(load.active, 0) ASC,
    engineer.rating DESC,
    engineer.created_at ASC
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.pick_engineer(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_booking_engineer(
  _booking_id uuid,
  _engineer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_engineer public.engineers;
  previous_engineer_id uuid;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(), 'ticket.addassignee')
    OR public.has_permission(auth.uid(), 'users.engineer_dispatch')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _engineer_id IS NOT NULL THEN
    SELECT * INTO selected_engineer
    FROM public.engineers
    WHERE id = _engineer_id
      AND approval_status = 'approved'
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Engineer is not approved or is inactive';
    END IF;
  END IF;

  SELECT engineer_id INTO previous_engineer_id
  FROM public.bookings
  WHERE id = _booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF previous_engineer_id IS NOT DISTINCT FROM _engineer_id THEN
    RETURN;
  END IF;

  UPDATE public.bookings
  SET engineer_id = _engineer_id,
      engineer_name = COALESCE(selected_engineer.full_name, 'Unassigned'),
      engineer_phone = selected_engineer.phone,
      status = CASE
        WHEN _engineer_id IS NOT NULL AND status IN ('Open', 'Assigned', 'In Progress') THEN 'Assigned'
        WHEN _engineer_id IS NULL AND status = 'Assigned' THEN 'Open'
        ELSE status
      END,
      progress = CASE
        WHEN _engineer_id IS NOT NULL AND status IN ('Open', 'Assigned', 'In Progress') THEN 30
        ELSE progress
      END,
      started_at = CASE
        WHEN _engineer_id IS NOT NULL AND status IN ('Open', 'Assigned', 'In Progress') THEN NULL
        ELSE started_at
      END
  WHERE id = _booking_id;

  IF selected_engineer.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, booking_id, event, title, detail, created_by)
    SELECT selected_engineer.user_id, id, 'job_assigned', 'New job assigned',
      ticket_no || ' · ' || title, auth.uid()
    FROM public.bookings
    WHERE id = _booking_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_engineer(_booking_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  picked_engineer_id uuid;
  selected_engineer public.engineers;
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.is_staff(auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE id = _booking_id AND customer_id = auth.uid()
    ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  picked_engineer_id := public.pick_engineer(_booking_id);
  IF picked_engineer_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO selected_engineer
  FROM public.engineers
  WHERE id = picked_engineer_id;

  UPDATE public.bookings
  SET engineer_id = selected_engineer.id,
      engineer_name = selected_engineer.full_name,
      engineer_phone = selected_engineer.phone,
      status = 'Assigned',
      progress = greatest(progress, 30)
  WHERE id = _booking_id
    AND engineer_id IS NULL
    AND status = 'Open';

  IF FOUND THEN
    IF selected_engineer.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, booking_id, event, title, detail, created_by)
      SELECT selected_engineer.user_id, id, 'job_assigned', 'New job assigned',
        ticket_no || ' · ' || title, auth.uid()
      FROM public.bookings
      WHERE id = _booking_id;
    END IF;
    RETURN selected_engineer.full_name;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.engineer_job_action(_booking_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_engineer uuid := public.my_engineer_id();
BEGIN
  IF my_engineer IS NULL THEN
    RAISE EXCEPTION 'not an approved engineer';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.engineers
    WHERE id = my_engineer
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Engineer account is inactive';
  END IF;

  IF _action = 'start' THEN
    UPDATE public.bookings
    SET status = 'In Progress',
        progress = GREATEST(progress, 55),
        started_at = now()
    WHERE id = _booking_id
      AND engineer_id = my_engineer
      AND (
        status IN ('Assigned', 'Open')
        OR (status = 'In Progress' AND started_at IS NULL)
      );
  ELSIF _action = 'complete' THEN
    UPDATE public.bookings
    SET status = 'Closed',
        progress = 100,
        completed_at = now()
    WHERE id = _booking_id
      AND engineer_id = my_engineer
      AND status = 'In Progress';
  ELSE
    RAISE EXCEPTION 'unknown action';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not in a valid state';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_booking_engineer(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_engineer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.engineer_job_action(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_booking_engineer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_engineer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.engineer_job_action(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
