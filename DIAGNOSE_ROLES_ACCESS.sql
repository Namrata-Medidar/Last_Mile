-- ============================================================================
-- DIAGNOSE: Check RLS policies and role access
-- ============================================================================

-- 1. Show all RLS policies on roles table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles as policy_roles,
  qual as select_condition,
  with_check
FROM pg_policies
WHERE tablename = 'roles'
ORDER BY policyname;

-- 2. Check if roles table has RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'roles'
  AND schemaname = 'public';

-- 3. Try to fetch all roles as authenticated user
-- (This might fail if RLS is blocking)
SELECT 
  id,
  slug,
  name,
  is_system,
  is_active,
  created_at
FROM public.roles
ORDER BY is_system DESC, name ASC;

-- 4. Check role count
SELECT COUNT(*) as total_roles FROM public.roles;
SELECT COUNT(*) as active_roles FROM public.roles WHERE is_active = true;
SELECT COUNT(*) as system_roles FROM public.roles WHERE is_system = true;
SELECT COUNT(*) as custom_roles FROM public.roles WHERE is_system = false;
