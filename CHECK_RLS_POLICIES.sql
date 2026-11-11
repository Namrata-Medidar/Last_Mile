-- ============================================================================
-- DIAGNOSTIC: Check RLS policies on user_roles table
-- ============================================================================

-- Step 1: List all RLS policies on user_roles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- Step 2: Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_class
JOIN pg_tables ON pg_class.relname = pg_tables.tablename
WHERE tablename = 'user_roles';

-- Step 3: Try direct insert (this will show if there's an RLS issue)
-- This should fail if you don't have permission, which would explain the silent failure
INSERT INTO public.user_roles(user_id, role_id, status, created_by, updated_by)
VALUES (
  auth.uid(),
  (SELECT id FROM public.roles WHERE slug = 'engineer' LIMIT 1),
  'active',
  auth.uid(),
  auth.uid()
);

-- Step 4: Check what went wrong
SELECT COUNT(*) as total_inserts
FROM public.user_roles
WHERE user_id = auth.uid()
  AND status = 'active'
  AND created_at > now() - interval '1 minute';
