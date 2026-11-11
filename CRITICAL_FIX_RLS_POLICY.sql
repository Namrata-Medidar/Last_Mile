-- ============================================================================
-- CRITICAL FIX: RLS Policy and is_staff() Function
-- ============================================================================
-- PROBLEM: The is_staff() and has_role() functions were still checking the 
--          old 'role' column (text enum) instead of 'role_id' (UUID)
--          This broke the RLS policy that filters which users you can see
-- 
-- SYMPTOM: After assigning a role to a user, you can't see it because
--          the RLS policy is filtering it out
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix is_staff() function to use role_id + roles table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND ur.status = 'active'
      AND r.is_active = true
      AND r.slug IN ('super_admin', 'admin', 'ops_manager')
  );
$$;

-- ============================================================================
-- STEP 2: Fix has_role() function to use role_id + roles table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND ur.status = 'active'
      AND r.is_active = true
      AND r.slug = _role_slug
  );
$$;

-- ============================================================================
-- STEP 3: Drop old RLS policy and create corrected one
-- ============================================================================
DROP POLICY IF EXISTS "Own roles read" ON public.user_roles;

CREATE POLICY "Own roles or staff view" ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_staff(auth.uid())
);

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================
-- These queries will help verify the fix worked:

-- Check if current user is staff
SELECT 
  auth.uid() as current_user,
  public.is_staff(auth.uid()) as is_current_user_staff;

-- Check current user's roles
SELECT 
  ur.user_id,
  r.slug,
  r.name,
  ur.status
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.user_id = auth.uid()
  AND ur.status = 'active'
ORDER BY r.name;

-- If you can see other users' roles, the fix worked!
SELECT COUNT(*) as total_active_role_assignments
FROM public.user_roles
WHERE status = 'active';

SELECT format('✅ RLS Policy and Functions Fixed! You should now be able to see all user roles if you are staff.') as status;
