-- ============================================================================
-- FIX: Ensure all SYSTEM roles are ACTIVE
-- ============================================================================
-- The roles filter shows only is_active=true
-- System roles might have been marked as inactive

-- First, check current status
SELECT id, slug, name, is_system, is_active FROM public.roles;

-- Activate ALL system roles
UPDATE public.roles
SET is_active = true, updated_at = NOW()
WHERE is_system = true;

-- Verify the fix
SELECT id, slug, name, is_system, is_active FROM public.roles
ORDER BY is_system DESC, name ASC;

SELECT format('✅ All system roles are now ACTIVE!') as status;
