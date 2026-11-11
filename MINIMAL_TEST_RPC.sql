-- ============================================================================
-- ABSOLUTE MINIMAL TEST: Remove ALL checks and just INSERT
-- ============================================================================
-- This will test if the INSERT is even working at all

DROP FUNCTION IF EXISTS public.assign_user_role(uuid[], uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  assigned_count int := 0;
  failed_count int := 0;
BEGIN
  RAISE NOTICE '[assign_user_role] MINIMAL TEST VERSION - Starting';
  RAISE NOTICE '[assign_user_role] User IDs: %', _user_ids;
  RAISE NOTICE '[assign_user_role] Role ID: %', _role_id;

  -- Validate: Check input parameters only
  IF _user_ids IS NULL OR cardinality(_user_ids) = 0 THEN
    RAISE EXCEPTION 'user_ids parameter cannot be empty or NULL';
  END IF;

  IF _role_id IS NULL THEN
    RAISE EXCEPTION 'role_id parameter cannot be NULL';
  END IF;

  -- Process each user - NO PERMISSION CHECKS
  FOREACH target_user_id IN ARRAY _user_ids LOOP
    BEGIN
      RAISE NOTICE '[assign_user_role] Processing user: %', target_user_id;

      -- Try to insert or update
      INSERT INTO public.user_roles(user_id, role_id, status, created_by, updated_by)
      VALUES (
        target_user_id,
        _role_id,
        'active',
        auth.uid(),
        auth.uid()
      )
      ON CONFLICT (user_id, role_id) DO UPDATE
      SET status = 'active', updated_by = auth.uid(), updated_at = now();

      assigned_count := assigned_count + 1;
      RAISE NOTICE '[assign_user_role] Successfully assigned role to user %', target_user_id;

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      RAISE NOTICE '[assign_user_role] ERROR for user %: %', target_user_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[assign_user_role] COMPLETE - Assigned: %, Failed: %', assigned_count, failed_count;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Assigned: %s, Failed: %s', assigned_count, failed_count),
    'assigned_count', assigned_count,
    'failed_count', failed_count,
    'total_users', cardinality(_user_ids)
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[assign_user_role] EXCEPTION: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;

SELECT '✅ MINIMAL TEST VERSION DEPLOYED - Check database after assignment' as status;
