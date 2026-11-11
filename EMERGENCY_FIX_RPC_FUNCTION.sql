-- ============================================================================
-- IMMEDIATE FIX: Simplify has_role() and assign_user_role() validation
-- ============================================================================
-- The issue is that has_role() is still broken or returning FALSE
-- This causes the permission check to FAIL and the entire RPC to FAIL
-- 
-- SOLUTION: Bypass the broken has_role() check temporarily to test
-- ============================================================================

-- First, let's see what the current has_role function looks like
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'has_role' 
AND routine_schema = 'public';

-- Now let's create a SIMPLER, MORE RELIABLE version of assign_user_role
DROP FUNCTION IF EXISTS public.assign_user_role(uuid[], uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.roles;
  target_user_id uuid;
  existing_assignment uuid;
  assigned_count int := 0;
  failed_count int := 0;
  result_message text;
  user_has_admin_role boolean;
BEGIN
  RAISE NOTICE '[assign_user_role] Starting role assignment';
  RAISE NOTICE '[assign_user_role] Received _user_ids: %, _role_id: %', _user_ids, _role_id;

  -- Check if current user has admin permission - DIRECT CHECK (no broken has_role function)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.status = 'active'
      AND r.is_active = true
      AND r.slug IN ('admin', 'super_admin')
  ) INTO user_has_admin_role;

  IF NOT user_has_admin_role THEN
    RAISE EXCEPTION 'Insufficient permissions: admin or super_admin role required';
  END IF;

  -- Validate input parameters
  IF _user_ids IS NULL OR cardinality(_user_ids) = 0 THEN
    RAISE EXCEPTION 'user_ids parameter cannot be empty or NULL';
  END IF;

  IF _role_id IS NULL THEN
    RAISE EXCEPTION 'role_id parameter cannot be NULL';
  END IF;

  -- Fetch the target role
  SELECT * INTO target_role
  FROM public.roles
  WHERE id = _role_id AND is_active = true;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Role not found or inactive. Role ID: %', _role_id;
  END IF;

  RAISE NOTICE '[assign_user_role] Role found: % (slug: %)', target_role.name, target_role.slug;

  -- Process each user
  FOREACH target_user_id IN ARRAY _user_ids LOOP
    BEGIN
      RAISE NOTICE '[assign_user_role] Processing user: %', target_user_id;

      -- Check if assignment already exists
      SELECT id INTO existing_assignment
      FROM public.user_roles
      WHERE user_id = target_user_id 
        AND role_id = target_role.id
        AND status = 'active';

      IF existing_assignment IS NOT NULL THEN
        -- UPDATE: User already has this role, just ensure it's active
        UPDATE public.user_roles
        SET status = 'active', updated_by = auth.uid(), updated_at = now()
        WHERE id = existing_assignment;
        
        RAISE NOTICE '[assign_user_role] Updated existing assignment for user %', target_user_id;
      ELSE
        -- INSERT: Create new role assignment
        INSERT INTO public.user_roles(user_id, role_id, status, created_by, updated_by)
        VALUES (
          target_user_id,
          target_role.id,
          'active',
          auth.uid(),
          auth.uid()
        );
        
        RAISE NOTICE '[assign_user_role] Inserted new assignment for user %', target_user_id;
      END IF;

      assigned_count := assigned_count + 1;

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      RAISE NOTICE '[assign_user_role] Error processing user %: %', target_user_id, SQLERRM;
    END;
  END LOOP;

  result_message := format('Successfully processed %s users. Assigned: %s, Failed: %s', 
    cardinality(_user_ids), assigned_count, failed_count);
  
  RAISE NOTICE '[assign_user_role] %', result_message;

  RETURN jsonb_build_object(
    'success', true,
    'message', result_message,
    'assigned_count', assigned_count,
    'failed_count', failed_count,
    'total_users', cardinality(_user_ids),
    'role_id', target_role.id,
    'role_name', target_role.name
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

SELECT format('✅ assign_user_role() function recreated with direct permission checks!') as status;
