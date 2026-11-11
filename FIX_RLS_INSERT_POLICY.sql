-- ============================================================================
-- FIX: Grant INSERT/UPDATE permissions to authenticated users on user_roles
-- ============================================================================
-- The RPC function is likely being blocked by RLS policies that don't allow
-- authenticated users to INSERT into user_roles
--
-- SOLUTION: Add explicit INSERT and UPDATE policies for the function
-- ============================================================================

-- Step 1: Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.user_roles;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.user_roles;

-- Step 2: Create permissive policies for staff to manage roles
-- This allows admins/ops_managers to INSERT and UPDATE user_roles
CREATE POLICY "Staff can manage user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow insert if current user is staff (admin/ops_manager/super_admin)
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.status = 'active'
      AND r.is_active = true
      AND r.slug IN ('admin', 'ops_manager', 'super_admin')
  )
);

-- Step 3: Allow staff to update user_roles
CREATE POLICY "Staff can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  -- Check if current user is staff
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.status = 'active'
      AND r.is_active = true
      AND r.slug IN ('admin', 'ops_manager', 'super_admin')
  )
)
WITH CHECK (
  -- Allow update if current user is staff
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.status = 'active'
      AND r.is_active = true
      AND r.slug IN ('admin', 'ops_manager', 'super_admin')
  )
);

-- Step 4: Grant explicit permissions to service_role (for RPC)
GRANT INSERT, UPDATE ON public.user_roles TO service_role;

-- Step 5: Verify the policies
SELECT 
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

SELECT '✅ RLS policies fixed! Staff can now INSERT and UPDATE user_roles' as status;
