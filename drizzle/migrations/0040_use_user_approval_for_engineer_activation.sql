CREATE OR REPLACE FUNCTION public.sync_engineer_role_profile(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_engineer_role boolean;
  account_is_approved boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    LEFT JOIN public.roles AS r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND ur.status = 'active'
      AND (ur.role = 'engineer' OR r.slug = 'engineer')
  )
  INTO has_engineer_role;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND status = 'active'
  )
  INTO account_is_approved;

  IF has_engineer_role AND account_is_approved THEN
    UPDATE public.engineers AS e
    SET approval_status = 'approved',
        status = CASE
          WHEN e.approval_status IS DISTINCT FROM 'approved' THEN 'active'
          ELSE e.status
        END,
        full_name = COALESCE(
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
      AND u.id = _user_id
      AND (
        e.approval_status IS DISTINCT FROM 'approved'
        OR e.full_name IS DISTINCT FROM COALESCE(
          NULLIF(BTRIM(p.full_name), ''),
          NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
          NULLIF(SPLIT_PART(u.email, '@', 1), ''),
          'Engineer'
        )
        OR e.phone IS DISTINCT FROM COALESCE(
          NULLIF(BTRIM(p.phone), ''),
          NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), ''),
          e.phone
        )
      );

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
        'approved',
        'active'
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

DO $$
DECLARE
  engineer_user_id uuid;
BEGIN
  FOR engineer_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles AS ur
    LEFT JOIN public.roles AS r ON r.id = ur.role_id
    JOIN public.profiles AS p ON p.id = ur.user_id AND p.status = 'active'
    WHERE ur.status = 'active'
      AND (ur.role = 'engineer' OR r.slug = 'engineer')
  LOOP
    PERFORM public.sync_engineer_role_profile(engineer_user_id);
  END LOOP;
END;
$$;
