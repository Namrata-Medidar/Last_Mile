-- ============================================================================
-- FIX: System Roles Assignment Bug
-- ============================================================================
-- PROBLEM: The assign_user_role() function had a hardcoded validation that
--          REJECTED any role not in ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer')
--          This prevented SYSTEM ROLES from being assigned
-- 
-- SOLUTION: Remove the hardcoded validation and allow ANY active role to be assigned
--           The is_active check ensures only valid, enabled roles can be assigned
-- ============================================================================

-- Drop the old function with the bug
DROP FUNCTION IF EXISTS public.assign_user_role(uuid[], uuid) CASCADE;

-- Create the FIXED function
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
BEGIN
  -- Log: Start of function
  RAISE NOTICE '[assign_user_role] Starting role assignment';
  RAISE NOTICE '[assign_user_role] Received _user_ids: %, _role_id: %', _user_ids, _role_id;

  -- Validate: Check permissions
  IF NOT public.has_permission(auth.uid(), 'users.role_management') THEN
    RAISE EXCEPTION 'Insufficient permissions: users.role_management required';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Insufficient role permissions: admin or super_admin required';
  END IF;

  -- Validate: Check input parameters
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

  -- Validate: Check super_admin permission for super_admin role
  IF target_role.slug = 'super_admin' AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can assign super_admin role';
  END IF;

  -- REMOVED: The hardcoded role validation that was rejecting custom roles
  -- Previously: IF target_role.slug NOT IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer')
  -- This was preventing system roles from being assigned
  -- Now we just check is_active=true which is sufficient for both system and custom roles

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

  -- Return result
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

-- Grant permissions
REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;

-- Notify
SELECT format('✅ Fixed! System roles assignment bug removed. You can now assign ANY active role (system or custom) to users.') as status;
