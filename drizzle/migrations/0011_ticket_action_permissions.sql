INSERT INTO public.permissions (code, module, description)
VALUES
  ('ticket.addassignee', 'Tickets', 'Assign an engineer to a ticket'),
  ('ticket.close', 'Tickets', 'Close a ticket')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_booking_assignee(
  _booking_id uuid,
  _engineer_name text,
  _engineer_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_name text := coalesce(nullif(btrim(_engineer_name), ''), 'Unassigned');
BEGIN
  IF NOT public.is_staff(auth.uid())
    OR NOT public.has_permission(auth.uid(), 'ticket.addassignee') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF length(normalized_name) > 200 OR length(coalesce(_engineer_phone, '')) > 50 THEN
    RAISE EXCEPTION 'Assignee details are too long';
  END IF;

  UPDATE public.bookings
  SET engineer_name = normalized_name,
      engineer_phone = nullif(btrim(coalesce(_engineer_phone, '')), ''),
      status = CASE WHEN normalized_name <> 'Unassigned' THEN 'In Progress' ELSE status END,
      progress = CASE WHEN normalized_name <> 'Unassigned' THEN greatest(progress, 45) ELSE progress END
  WHERE id = _booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_booking_ticket(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid())
    OR NOT public.has_permission(auth.uid(), 'ticket.close') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.bookings
  SET status = 'Closed',
      progress = 100
  WHERE id = _booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_booking_assignee(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_booking_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_booking_assignee(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_booking_ticket(uuid) TO authenticated;
