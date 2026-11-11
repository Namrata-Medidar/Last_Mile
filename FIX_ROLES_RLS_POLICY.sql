-- ============================================================================
-- FIX: Allow SELECT of all roles (system and custom)
-- ============================================================================
-- System roles might be hidden by an overly restrictive RLS policy

-- Step 1: Drop any existing RLS policies on roles table
DROP POLICY IF EXISTS "Only select active roles" ON public.roles;
DROP POLICY IF EXISTS "Custom roles visible" ON public.roles;
DROP POLICY IF EXISTS "Select active and custom roles" ON public.roles;

-- Step 2: Create a permissive policy that allows selecting ALL active roles
CREATE POLICY "Select all active roles"
ON public.roles
FOR SELECT
TO authenticated
USING (
  is_active = true
);

-- Step 3: Grant SELECT permission to authenticated
GRANT SELECT ON public.roles TO authenticated;

-- Step 4: Verify the fix
SELECT 
  id,
  slug,
  name,
  is_system,
  is_active
FROM public.roles
WHERE is_active = true
ORDER BY is_system DESC, name ASC;

SELECT format('✅ Roles RLS policy fixed! All active roles should now be visible.') as status;
