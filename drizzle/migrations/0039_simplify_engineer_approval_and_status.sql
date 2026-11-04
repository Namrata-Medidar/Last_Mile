CREATE OR REPLACE FUNCTION public.protect_engineer_approval_and_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND pg_trigger_depth() <= 1
    AND (
      NEW.approval_status IS DISTINCT FROM OLD.approval_status
      OR NEW.status IS DISTINCT FROM OLD.status
    )
    AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the Super Admin can change engineer approval or status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS engineers_approval_status_guard ON public.engineers;
CREATE TRIGGER engineers_approval_status_guard
BEFORE UPDATE ON public.engineers
FOR EACH ROW
EXECUTE FUNCTION public.protect_engineer_approval_and_status();

CREATE OR REPLACE FUNCTION public.sync_engineer_role_profile(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_engineer_role boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND ur.status = 'active'
      AND (ur.role = 'engineer' OR r.slug = 'engineer')
  ) INTO has_engineer_role;

  IF has_engineer_role THEN
    UPDATE public.engineers AS e
    SET full_name = COALESCE(
          NULLIF(BTRIM(p.full_name), ''),
          NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
          NULLIF(SPLIT_PART(u.email, '@', 1), ''),
          'Engineer'
        ),
        phone = COALESCE(
          NULLIF(BTRIM(p.phone), ''),
          NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), ''),
          e.phone
        )
    FROM auth.users AS u
    LEFT JOIN public.profiles AS p ON p.id = u.id
    WHERE e.user_id = _user_id
      AND u.id = _user_id;

    IF NOT FOUND THEN
      INSERT INTO public.engineers (
        user_id,
        full_name,
        phone,
        city,
        approval_status,
        status
      )
      SELECT
        u.id,
        COALESCE(
          NULLIF(BTRIM(p.full_name), ''),
          NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
          NULLIF(SPLIT_PART(u.email, '@', 1), ''),
          'Engineer'
        ),
        COALESCE(
          NULLIF(BTRIM(p.phone), ''),
          NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), '')
        ),
        'Not specified',
        'pending',
        'inactive'
      FROM auth.users AS u
      LEFT JOIN public.profiles AS p ON p.id = u.id
      WHERE u.id = _user_id
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  ELSE
    UPDATE public.engineers
    SET approval_status = 'pending',
        status = 'inactive'
    WHERE user_id = _user_id
      AND (
        approval_status IS DISTINCT FROM 'pending'
        OR status IS DISTINCT FROM 'inactive'
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.engineer_role_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_approved boolean := false;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    was_approved := OLD.approval_status = 'approved';
  END IF;

  IF NEW.approval_status = 'approved' THEN
    IF NOT was_approved THEN
      UPDATE public.engineers
      SET status = 'active'
      WHERE id = NEW.id;
    END IF;

    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (NEW.user_id, 'engineer', auth.uid())
    ON CONFLICT (user_id, role)
    DO UPDATE SET status = 'active';

    IF NOT was_approved THEN
      INSERT INTO public.notifications (user_id, event, title, detail, created_by)
      VALUES (
        NEW.user_id,
        'engineer_approved',
        'Engineer profile approved',
        'You can now receive jobs',
        auth.uid()
      );
    END IF;
  ELSE
    UPDATE public.user_roles
    SET status = 'inactive'
    WHERE user_id = NEW.user_id
      AND role = 'engineer'
      AND status IS DISTINCT FROM 'inactive';
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.engineers
SET approval_status = 'pending',
    status = 'inactive'
WHERE approval_status IN ('rejected', 'suspended');

ALTER TABLE public.engineers
  DROP CONSTRAINT IF EXISTS engineers_approval_status_check;

ALTER TABLE public.engineers
  ADD CONSTRAINT engineers_approval_status_check
  CHECK (approval_status IN ('pending', 'approved'));

REVOKE ALL ON FUNCTION public.set_my_availability(boolean) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.set_my_availability(boolean);

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
      AND status IN ('Open', 'In Progress')
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
      AND status = 'Open';
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

REVOKE ALL ON FUNCTION public.engineer_job_action(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.engineer_job_action(uuid, text) TO authenticated;
