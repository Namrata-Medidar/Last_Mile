-- ============================================================================
-- VERIFICATION SCRIPT: Engineer Role Assignment Status
-- ============================================================================
-- Run this script to verify the current state and find any issues

-- 1. Check if engineer role exists and is active
SELECT 
  id,
  slug,
  name,
  description,
  is_active,
  is_system,
  created_at
FROM public.roles
WHERE slug = 'engineer'
LIMIT 1;

-- 2. Check user_roles table structure (verify role_id is NOT NULL)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_roles'
  AND column_name IN ('id', 'user_id', 'role_id', 'role', 'status')
ORDER BY ordinal_position;

-- 3. Find users with engineer role assignments
SELECT 
  ur.id,
  ur.user_id,
  ur.role_id,
  ur.role,
  ur.status,
  r.slug,
  r.name,
  p.full_name,
  p.email
FROM public.user_roles ur
LEFT JOIN public.roles r ON r.id = ur.role_id
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE r.slug = 'engineer' OR ur.role = 'engineer'
ORDER BY ur.created_at DESC;

-- 4. Check for any NULL role_id values that violate constraint
SELECT 
  id,
  user_id,
  role_id,
  role,
  status
FROM public.user_roles
WHERE role_id IS NULL
LIMIT 10;

-- 5. Check for duplicate role assignments (multiple active assignments for same user+role)
SELECT 
  user_id,
  role_id,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as assignment_ids
FROM public.user_roles
WHERE status = 'active'
GROUP BY user_id, role_id
HAVING COUNT(*) > 1
ORDER BY user_id, role_id;

-- 6. Check the current function definition
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'assign_user_role'
  AND routine_type = 'FUNCTION'
LIMIT 1;

-- 7. Verify permissions for engineer role
SELECT 
  r.id,
  r.slug,
  r.name,
  p.code,
  p.module,
  p.description
FROM public.roles r
LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
LEFT JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.slug = 'engineer'
ORDER BY p.code;
