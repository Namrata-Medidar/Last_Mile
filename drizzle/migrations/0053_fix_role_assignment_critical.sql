-- ============================================================================
-- CRITICAL FIX: Restore role assignment functionality 
-- ============================================================================
-- This migration consolidates fixes needed after pending migrations were not
-- applied. It ensures the user_roles table and assign_user_role function
-- are properly configured to handle role assignments.

-- ============================================================================
-- STEP 1: Ensure roles table exists with proper structure
-- ============================================================================
-- Create roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE(slug)
);

-- ============================================================================
-- STEP 2: Seed default system roles if they don't exist
-- ============================================================================
INSERT INTO public.roles (slug, name, description, is_active, is_system)
VALUES
  ('super_admin', 'Super Admin', 'Full system access', true, true),
  ('admin', 'Admin', 'Admin access', true, true),
  ('ops_manager', 'Operations Manager', 'Operations management', true, true),
  ('engineer', 'Field Engineer', 'Service delivery engineer', true, true),
  ('customer', 'Customer', 'Customer user', true, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 3: Ensure user_roles table has role_id column
-- ============================================================================
-- Add role_id column if it doesn't exist
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS role_id uuid;

-- ============================================================================
-- STEP 4: Populate any NULL role_id values from existing role column
-- ============================================================================
-- Only run if there are NULL role_id values
UPDATE public.user_roles ur
SET role_id = (
  SELECT r.id 
  FROM public.roles r 
  WHERE r.is_active 
    AND (
      (ur.role::text = 'admin' AND r.slug = 'admin')
      OR (ur.role::text = 'super_admin' AND r.slug = 'super_admin')
      OR (ur.role::text = 'ops_manager' AND r.slug = 'ops_manager')
      OR (ur.role::text = 'engineer' AND r.slug = 'engineer')
      OR (ur.role::text = 'customer' AND r.slug = 'customer')
    )
  LIMIT 1
)
WHERE ur.role_id IS NULL AND ur.role IS NOT NULL;

-- For any still-NULL role_id (e.g., from custom roles), assign them the 'customer' role
UPDATE public.user_roles ur
SET role_id = (SELECT id FROM public.roles WHERE slug = 'customer' LIMIT 1)
WHERE ur.role_id IS NULL;

-- ============================================================================
-- STEP 5: Make role_id NOT NULL
-- ============================================================================
-- Remove old constraint if it exists
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_role_id_not_null;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Set NOT NULL constraint on role_id
ALTER TABLE public.user_roles
ALTER COLUMN role_id SET NOT NULL;

-- ============================================================================
-- STEP 6: Add constraints to prevent NULL role_id
-- ============================================================================
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_role_id_never_null CHECK (role_id IS NOT NULL);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Add foreign key constraint if not exists
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey 
      FOREIGN KEY (role_id) 
      REFERENCES public.roles(id) 
      ON DELETE RESTRICT 
      ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ============================================================================
-- STEP 7: Fix the assign_user_role function
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

  -- Fetch the target role
  SELECT * INTO target_role
  FROM public.roles
  WHERE id = _role_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found or inactive';
  END IF;

  -- Validate that we're assigning a known system role
  IF target_role.slug IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Unknown system role slug: %', target_role.slug;
  END IF;

  -- Check super_admin permission
  IF target_role.slug = 'super_admin'
    AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can assign super admin access';
  END IF;

  -- Validate input
  IF coalesce(cardinality(_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one user';
  END IF;

  -- Process each user
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
      -- Create new assignment with role_id (role column may be removed in future)
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

-- ============================================================================
-- STEP 8: Create or recreate helper trigger to ensure role_id is always set
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_user_roles_role_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- role_id MUST be set and reference a valid role
  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION 'role_id must be explicitly set and cannot be NULL';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id) THEN
    RAISE EXCEPTION 'Assigned role (ID: %) does not exist', NEW.role_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS ensure_user_roles_role_id ON public.user_roles;

-- Create new trigger
CREATE TRIGGER ensure_user_roles_role_id
BEFORE INSERT OR UPDATE OF role_id ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.ensure_user_roles_role_id();

-- ============================================================================
-- STEP 9: Verify the fix
-- ============================================================================
-- Check that user_roles table has proper structure
-- SELECT 
--   column_name,
--   data_type,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_roles'
--   AND column_name IN ('id', 'user_id', 'role_id', 'role', 'status')
-- ORDER BY ordinal_position;

NOTIFY pgrst, 'reload schema';
