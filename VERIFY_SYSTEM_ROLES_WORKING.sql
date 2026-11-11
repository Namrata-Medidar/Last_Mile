-- ============================================================================
-- VERIFY: System role assignment working
-- ============================================================================

-- 1. Check all roles in database
SELECT 
  id,
  slug,
  name,
  is_system,
  is_active,
  created_at
FROM public.roles
ORDER BY is_system DESC, name ASC;

-- 2. Count users per role
SELECT 
  r.name,
  r.is_system,
  COUNT(ur.id) as user_count
FROM public.roles r
LEFT JOIN public.user_roles ur ON r.id = ur.role_id AND ur.status = 'active'
WHERE r.is_active = true
GROUP BY r.id, r.name, r.is_system
ORDER BY r.is_system DESC, user_count DESC;

-- 3. Check specific user assignments (Amrata Medidar)
SELECT 
  ur.id,
  ur.user_id,
  ur.role_id,
  r.slug,
  r.name,
  r.is_system,
  ur.status,
  ur.created_at
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
JOIN public.profiles p ON p.id = ur.user_id
WHERE p.email LIKE '%amrata@airowire%'
ORDER BY ur.created_at DESC;

-- 4. Verify RLS policy on roles table
SELECT 
  policyname,
  permissive,
  roles as policy_roles,
  qual as select_condition
FROM pg_policies
WHERE tablename = 'roles'
ORDER BY policyname;

-- 5. Test: Can select all active roles?
SELECT COUNT(*) as total_active_roles FROM public.roles WHERE is_active = true;
SELECT COUNT(*) as total_system_roles FROM public.roles WHERE is_system = true AND is_active = true;
