-- ============================================================================
-- CHECK: What's the current state of roles in the database?
-- ============================================================================

SELECT 
  id,
  slug,
  name,
  is_system,
  is_active,
  created_at
FROM public.roles
ORDER BY is_system DESC, is_active DESC, name ASC;

-- Specifically check system roles
SELECT 
  id,
  slug,
  name,
  is_active
FROM public.roles
WHERE is_system = true
ORDER BY name;

-- Check if all system roles are active
SELECT COUNT(*) as inactive_system_roles
FROM public.roles
WHERE is_system = true AND is_active = false;
