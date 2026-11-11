-- ============================================================================
-- VERIFY: Check if is_staff() function is working correctly
-- ============================================================================

-- Step 1: Check current user's roles
SELECT 
  auth.uid() as current_user_id,
  ur.id as assignment_id,
  ur.user_id,
  ur.role_id,
  r.slug,
  r.name,
  ur.status
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.user_id = auth.uid()
  AND ur.status = 'active';

-- Step 2: Check if current user is staff
SELECT public.is_staff(auth.uid()) as is_staff;

-- Step 3: Test: Try to see all user roles (should work if staff)
SELECT 
  COUNT(*) as total_roles,
  ur.user_id,
  COUNT(DISTINCT ur.id) as role_count
FROM public.user_roles ur
WHERE ur.status = 'active'
GROUP BY ur.user_id
ORDER BY role_count DESC
LIMIT 10;

-- Step 4: If you can't see roles, the RLS policy is blocking you
-- This means you need to be marked as staff (admin/ops_manager/super_admin)
