-- ============================================================================
-- FIX: Properly handle engineer role assignment 
-- ============================================================================
-- Issue: assign_user_role function uses ON CONFLICT with (user_id, role)
-- but for system roles this conflicts with NULL role values and breaks constraint
-- handling. Solution: Use explicit check-before-insert logic instead.

-- ============================================================================
-- STEP 1: Remove old broken constraint if it exists (keep only role_id unique)
-- ============================================================================

-- Drop the conflicting (user_id, role) unique constraint if it still exists
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_role_key;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Ensure we have the correct unique index on (user_id, role_id)
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_id_unique
ON public.user_roles (user_id, role_id);

-- ============================================================================
-- STEP 2: Fix the assign_user_role function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.roles;
  target_user_id uuid;
  existing_assignment uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.role_management')
    OR NOT (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO target_role
  FROM public.roles
  WHERE id = _role_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found or inactive';
  END IF;

  IF target_role.slug IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
    -- Validate that we're assigning a known system role
    NULL;
  ELSE
    RAISE EXCEPTION 'Unknown system role slug: %', target_role.slug;
  END IF;

  IF target_role.slug = 'super_admin'
    AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can assign super admin access';
  END IF;

  IF coalesce(cardinality(_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one user';
  END IF;

  FOREACH target_user_id IN ARRAY _user_ids LOOP
    -- Check if assignment already exists for this user and role_id
    SELECT id INTO existing_assignment
    FROM public.user_roles
    WHERE user_id = target_user_id AND role_id = target_role.id;

    IF existing_assignment IS NOT NULL THEN
      -- Update existing assignment to active status
      UPDATE public.user_roles
      SET status = 'active', updated_by = auth.uid(), updated_at = now()
      WHERE id = existing_assignment;
    ELSE
      -- Create new assignment with role_id only (role column was dropped in migration 0050)
      INSERT INTO public.user_roles(user_id, role_id, status, created_by, updated_by)
      VALUES (
        target_user_id,
        target_role.id,
        'active',
        auth.uid(),
        auth.uid()
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
