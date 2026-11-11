-- ============================================================================
-- DIAGNOSTIC: Check if there's an RLS policy blocking system roles
-- ============================================================================

-- Check all RLS policies on roles table
SELECT 
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'roles'
ORDER BY policyname;

-- Try to fetch a system role
SELECT id, slug, name, is_system, is_active
FROM public.roles
WHERE slug = 'admin'
  AND is_active = true;

-- Try to fetch a custom role  
SELECT id, slug, name, is_system, is_active
FROM public.roles
WHERE is_system = false
  AND is_active = true
LIMIT 1;
