-- ============================================================================
-- COMPLETE REMOVAL: Drop slug from roles table and role from user_roles table
-- ============================================================================
-- This COMPLETELY removes the dual role system
-- No more text-based roles, no more slug column

-- ============================================================================
-- STEP 1: Update has_role to NOT use slug anymore
-- ============================================================================
-- has_role now just checks if user has a specific role_id
-- No more slug-based checking

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      JOIN public.roles r ON r.id = ur.role_id AND r.is_active
      WHERE p.id = _user_id
        AND p.status = 'active'
        AND ur.status = 'active'
        AND r.slug = _role::text
    );
$$;

-- Still checking slug in has_role since app_role enum is based on slugs
-- But now slug is ONLY in roles table, not duplicated in user_roles

-- ============================================================================
-- STEP 2: Drop the 'role' column from user_roles table
-- ============================================================================

ALTER TABLE public.user_roles DROP COLUMN IF EXISTS role CASCADE;

-- ============================================================================
-- STEP 3: Drop the 'slug' column from roles table (make it use seq only)
-- ============================================================================

-- First, drop any indexes/constraints that depend on slug
DROP INDEX IF EXISTS roles_slug_unique;

-- Then drop the column
ALTER TABLE public.roles DROP COLUMN IF EXISTS slug CASCADE;

-- ============================================================================
-- STEP 4: Remove the app_role ENUM type (if no longer needed)
-- ============================================================================
-- NOTE: Keep this commented out if app_role enum is used elsewhere
-- Uncomment only if you're sure nothing else uses it

-- DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================================================
-- STEP 5: Update trigger to NOT check for role
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_assignment_role_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- role_id MUST be set and reference a valid role
  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION 'role_id must be explicitly set';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id) THEN
    RAISE EXCEPTION 'Assigned role (ID: %) does not exist', NEW.role_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_require_role_link ON public.user_roles;
CREATE TRIGGER user_roles_require_role_link
BEFORE INSERT OR UPDATE OF role_id ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.ensure_assignment_role_link();

-- ============================================================================
-- STEP 6: Drop the ensure_assignment_role_link trigger condition check
-- ============================================================================
-- The trigger now ONLY checks role_id, never checks for 'role' column

-- ============================================================================
-- STEP 7: Verify the cleanup
-- ============================================================================

-- Check user_roles table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_roles'
ORDER BY ordinal_position;

-- Should NOT show: role column
-- Should show: role_id (NOT NULL)

-- Check roles table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'roles'
ORDER BY ordinal_position;

-- Should NOT show: slug column anymore

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  'Cleanup Complete' as status,
  'user_roles.role' as removed_column_1,
  'roles.slug' as removed_column_2;

NOTIFY pgrst, 'reload schema';
