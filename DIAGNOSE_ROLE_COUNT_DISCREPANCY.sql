-- ============================================================================
-- DIAGNOSE: Why are counts different between views?
-- ============================================================================

-- 1. Check total user_roles for each role (all statuses)
SELECT 
  r.name,
  r.slug,
  COUNT(ur.id) as total_assignments
FROM public.roles r
LEFT JOIN public.user_roles ur ON r.id = ur.role_id
GROUP BY r.id, r.name, r.slug
ORDER BY total_assignments DESC;

-- 2. Check only ACTIVE assignments
SELECT 
  r.name,
  r.slug,
  COUNT(ur.id) as active_assignments
FROM public.roles r
LEFT JOIN public.user_roles ur ON r.id = ur.role_id AND ur.status = 'active'
WHERE r.is_active = true
GROUP BY r.id, r.name, r.slug
ORDER BY active_assignments DESC;

-- 3. Check if there are any INACTIVE roles
SELECT 
  id, slug, name, is_active, is_system
FROM public.roles
WHERE is_active = false
ORDER BY name;

-- 4. Check Admin role specifically
SELECT 
  r.id,
  r.slug,
  r.name,
  r.is_active,
  r.is_system,
  COUNT(ur.id) as active_user_count
FROM public.roles r
LEFT JOIN public.user_roles ur ON r.id = ur.role_id AND ur.status = 'active'
WHERE r.slug = 'admin'
GROUP BY r.id, r.slug, r.name, r.is_active, r.is_system;

-- 5. Check Customer role specifically
SELECT 
  r.id,
  r.slug,
  r.name,
  r.is_active,
  r.is_system,
  COUNT(ur.id) as active_user_count
FROM public.roles r
LEFT JOIN public.user_roles ur ON r.id = ur.role_id AND ur.status = 'active'
WHERE r.slug = 'customer'
GROUP BY r.id, r.slug, r.name, r.is_active, r.is_system;

-- 6. Are there duplicate roles?
SELECT 
  slug,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as ids
FROM public.roles
GROUP BY slug
HAVING COUNT(*) > 1
ORDER BY count DESC;
