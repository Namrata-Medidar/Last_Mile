-- ============================================================================
-- IMPROVED RPC FUNCTION: Complete role assignment with all 3 operations
-- ============================================================================
-- This RPC function handles:
-- 1. INSERT - Assign a new role to users
-- 2. UPDATE - Change existing role assignment
-- 3. DELETE - Remove role assignments
-- ============================================================================

-- Function 1: Assign roles to users (INSERT new assignments)
-- ============================================================================
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

  -- Validate: Check super_admin permission
  IF target_role.slug = 'super_admin' AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can assign super_admin role';
  END IF;

  -- Validate: Ensure it's a known system role
  IF target_role.slug NOT IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
    RAISE EXCEPTION 'Unknown system role: %', target_role.slug;
  END IF;

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

-- ============================================================================
-- Function 2: Update user's role (CHANGE role assignment)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_role(_user_id uuid, _old_role_id uuid, _new_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_role public.roles;
  new_role public.roles;
  assignment_id uuid;
BEGIN
  RAISE NOTICE '[update_user_role] Updating role for user: % from % to %', _user_id, _old_role_id, _new_role_id;

  -- Validate permissions
  IF NOT public.has_permission(auth.uid(), 'users.role_management') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Validate parameters
  IF _user_id IS NULL OR _old_role_id IS NULL OR _new_role_id IS NULL THEN
    RAISE EXCEPTION 'user_id, old_role_id, and new_role_id cannot be NULL';
  END IF;

  -- Fetch and validate roles
  SELECT * INTO old_role FROM public.roles WHERE id = _old_role_id AND is_active = true;
  IF old_role IS NULL THEN
    RAISE EXCEPTION 'Old role not found or inactive';
  END IF;

  SELECT * INTO new_role FROM public.roles WHERE id = _new_role_id AND is_active = true;
  IF new_role IS NULL THEN
    RAISE EXCEPTION 'New role not found or inactive';
  END IF;

  -- UPDATE: Change the role
  UPDATE public.user_roles
  SET role_id = _new_role_id, updated_by = auth.uid(), updated_at = now()
  WHERE user_id = _user_id AND role_id = _old_role_id
  RETURNING id INTO assignment_id;

  IF assignment_id IS NULL THEN
    RAISE EXCEPTION 'No active assignment found for user with old role';
  END IF;

  RAISE NOTICE '[update_user_role] Successfully updated assignment % from % to %', 
    assignment_id, old_role.name, new_role.name;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Role updated from %s to %s', old_role.name, new_role.name),
    'user_id', _user_id,
    'old_role', old_role.name,
    'new_role', new_role.name,
    'assignment_id', assignment_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[update_user_role] EXCEPTION: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ============================================================================
-- Function 3: Revoke/remove role assignments (DELETE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_user_roles(_assignment_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_row public.user_roles;
  revoked_count int := 0;
  failed_count int := 0;
BEGIN
  RAISE NOTICE '[revoke_user_roles] Revoking % role assignments', cardinality(_assignment_ids);

  -- Validate permissions
  IF NOT public.has_permission(auth.uid(), 'users.role_management') THEN
    RAISE EXCEPTION 'Insufficient permissions: users.role_management required';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Insufficient role permissions: admin or super_admin required';
  END IF;

  -- Validate input
  IF _assignment_ids IS NULL OR cardinality(_assignment_ids) = 0 THEN
    RAISE EXCEPTION 'assignment_ids parameter cannot be empty or NULL';
  END IF;

  -- Process each assignment
  FOR assignment_row IN SELECT * FROM public.user_roles WHERE id = ANY(_assignment_ids) LOOP
    BEGIN
      RAISE NOTICE '[revoke_user_roles] Processing assignment: %', assignment_row.id;

      -- Prevent self-revocation of admin roles
      IF assignment_row.user_id = auth.uid() 
        AND assignment_row.role_id IN (
          SELECT id FROM public.roles WHERE slug IN ('admin', 'super_admin')
        ) THEN
        RAISE EXCEPTION 'Cannot revoke your own admin access';
      END IF;

      -- Prevent non-super_admins from revoking super_admin roles
      IF assignment_row.role_id = (SELECT id FROM public.roles WHERE slug = 'super_admin' LIMIT 1)
        AND NOT public.has_role(auth.uid(), 'super_admin') THEN
        RAISE EXCEPTION 'Only super admins can revoke super_admin access';
      END IF;

      -- DELETE: Soft delete or hard delete (based on your preference)
      -- Option 1: Soft delete (set status to 'inactive')
      UPDATE public.user_roles
      SET status = 'inactive', updated_by = auth.uid(), updated_at = now()
      WHERE id = assignment_row.id;

      -- Option 2: Hard delete (uncomment to use instead)
      -- DELETE FROM public.user_roles WHERE id = assignment_row.id;

      revoked_count := revoked_count + 1;
      RAISE NOTICE '[revoke_user_roles] Revoked assignment %', assignment_row.id;

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      RAISE NOTICE '[revoke_user_roles] Error revoking %: %', assignment_row.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[revoke_user_roles] Revoked: %, Failed: %', revoked_count, failed_count;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully revoked %s assignments', revoked_count),
    'revoked_count', revoked_count,
    'failed_count', failed_count,
    'total_processed', cardinality(_assignment_ids)
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[revoke_user_roles] EXCEPTION: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.update_user_role(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_user_roles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_user_roles(uuid[]) TO authenticated;

-- ============================================================================
-- Notify PostgREST to reload schema
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Test queries (run these to verify the functions work)
-- ============================================================================
-- SELECT public.assign_user_role(ARRAY['user-uuid-here']::uuid[], 'role-uuid-here'::uuid);
-- SELECT public.update_user_role('user-uuid', 'old-role-uuid', 'new-role-uuid');
-- SELECT public.revoke_user_roles(ARRAY['assignment-uuid-here']::uuid[]);
