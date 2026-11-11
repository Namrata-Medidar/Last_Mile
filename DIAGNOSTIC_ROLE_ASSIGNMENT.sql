-- ============================================================================
-- DIAGNOSTIC: Check if role was actually saved to database
-- ============================================================================
-- Replace 'your-user-email@example.com' with the email of the user you just assigned a role to

-- Query 1: Check ALL roles for this user (including inactive)
SELECT
  p.email AS user_email,
  ur.id AS assignment_id,
  ur.role_id,
  r.slug AS role_slug,
  r.name AS role_name,
  ur.status AS assignment_status,
  r.is_active AS role_is_active,
  ur.created_at,
  ur.updated_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN public.roles r ON r.id = ur.role_id
WHERE p.email = 'your-user-email@example.com'
ORDER BY ur.created_at DESC;

-- Query 2: Check ONLY ACTIVE roles for this user
SELECT
  p.email AS user_email,
  r.slug AS role_slug,
  r.name AS role_name,
  ur.status,
  ur.updated_at
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
JOIN public.roles r ON r.id = ur.role_id
WHERE p.email = 'your-user-email@example.com'
  AND ur.status = 'active'
  AND r.is_active = true;

-- Query 3: Count total active role assignments
SELECT COUNT(*) as total_active_assignments
FROM public.user_roles
WHERE status = 'active';

-- Query 4: Check if the RPC function is even being called (check recent entries)
SELECT
  ur.id,
  ur.user_id,
  ur.role_id,
  ur.status,
  ur.created_at,
  ur.created_by,
  r.slug,
  r.name
FROM public.user_roles ur
LEFT JOIN public.roles r ON r.id = ur.role_id
ORDER BY ur.created_at DESC
LIMIT 10;

-- Query 5: Check the roles table to see what roles exist
SELECT 
  id,
  slug,
  name,
  is_active,
  is_system
FROM public.roles
ORDER BY created_at DESC;
