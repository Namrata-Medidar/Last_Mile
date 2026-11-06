-- ============================================================================
-- FINAL FIX: Quick approach + Bulletproof constraints
-- ============================================================================
-- Keeps slug in roles table (no major rewrite)
-- But makes role_id ABSOLUTELY CANNOT BE NULL in any scenario

-- ============================================================================
-- STEP 1: Populate any remaining NULL role_id values
-- ============================================================================

UPDATE public.user_roles ur
SET role_id = (
  SELECT r.id 
  FROM public.roles r 
  WHERE r.is_active 
    AND (
      (ur.role = 'admin' AND r.slug = 'admin')
      OR (ur.role = 'super_admin' AND r.slug = 'super_admin')
      OR (ur.role = 'ops_manager' AND r.slug = 'ops_manager')
      OR (ur.role = 'engineer' AND r.slug = 'engineer')
      OR (ur.role = 'customer' AND r.slug = 'customer')
    )
  LIMIT 1
)
WHERE ur.role_id IS NULL AND ur.role IS NOT NULL;

-- ============================================================================
-- STEP 2: Make role_id NOT NULL - CANNOT BE NULL EVER
-- ============================================================================

ALTER TABLE public.user_roles
  ALTER COLUMN role_id SET NOT NULL;

-- ============================================================================
-- STEP 3: Add database constraint to prevent NULL role_id
-- ============================================================================

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_role_id_never_null CHECK (role_id IS NOT NULL);

-- Drop the old constraint if it exists
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_role_id_not_null;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Add the new constraint (or just keep the existing one)
BEGIN;
  ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_id_never_null CHECK (role_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;

-- ============================================================================
-- STEP 4: Add foreign key constraint if not exists
-- ============================================================================
-- This prevents referencing a role that doesn't exist

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey 
      FOREIGN KEY (role_id) 
      REFERENCES public.roles(id) 
      ON DELETE RESTRICT 
      ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ============================================================================
-- STEP 5: Prevent deletion of roles that have users assigned
-- ============================================================================
-- If someone tries to delete a role with users, it fails

CREATE OR REPLACE FUNCTION public.prevent_role_deletion_with_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.id IN (SELECT DISTINCT role_id FROM public.user_roles WHERE role_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot delete role % because it has assigned users. Remove users first.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_deletion_with_users ON public.roles;
CREATE TRIGGER prevent_role_deletion_with_users
BEFORE DELETE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_deletion_with_users();

-- ============================================================================
-- STEP 6: Prevent NULL role_id on INSERT
-- ============================================================================
-- Trigger to catch any NULL attempts before constraint violation

CREATE OR REPLACE FUNCTION public.enforce_role_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot insert user_role with NULL role_id. Specify a valid role_id.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id) THEN
    RAISE EXCEPTION 'Role with id % does not exist', NEW.role_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_role_id_on_insert ON public.user_roles;
CREATE TRIGGER enforce_role_id_on_insert
BEFORE INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_id_on_insert();

-- ============================================================================
-- STEP 7: Prevent role_id from being set to NULL on UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_role_id_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot update user_role: role_id cannot be NULL. Current role_id: %', OLD.role_id;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id) THEN
    RAISE EXCEPTION 'Role with id % does not exist', NEW.role_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_role_id_on_update ON public.user_roles;
CREATE TRIGGER enforce_role_id_on_update
BEFORE UPDATE OF role_id ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_id_on_update();

-- ============================================================================
-- STEP 8: Prevent deactivation of roles that have active users
-- ============================================================================
-- If someone tries to set is_active = false on a role with users, it fails

CREATE OR REPLACE FUNCTION public.prevent_role_deactivation_with_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE role_id = NEW.id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Cannot deactivate role % because it has active users. Remove users first.', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_deactivation_with_users ON public.roles;
CREATE TRIGGER prevent_role_deactivation_with_users
BEFORE UPDATE OF is_active ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_deactivation_with_users();

-- ============================================================================
-- STEP 9: Drop the old 'role' text column (optional - only if safe)
-- ============================================================================
-- Uncomment this only after verifying no other code uses it

-- ALTER TABLE public.user_roles DROP COLUMN IF EXISTS role CASCADE;

-- ============================================================================
-- STEP 10: Assign permissions to system roles
-- ============================================================================

DO $$
DECLARE
  v_ticket_perm_id uuid;
  v_dashboard_perm_id uuid;
  v_role_mgmt_perm_id uuid;
  v_admin_role_id uuid;
  v_ops_role_id uuid;
  v_super_admin_role_id uuid;
  v_system_roles text[] := ARRAY['admin', 'ops_manager', 'super_admin'];
  v_role_slug text;
BEGIN
  -- Get permission IDs
  SELECT id INTO v_ticket_perm_id
  FROM public.permissions
  WHERE code = 'sidebar.project_team.ticket.view';

  SELECT id INTO v_dashboard_perm_id
  FROM public.permissions
  WHERE code = 'sidebar.project_team.dashboard.view';

  SELECT id INTO v_role_mgmt_perm_id
  FROM public.permissions
  WHERE code = 'sidebar.project_team.role_management.view';

  -- Create permissions if they don't exist
  IF v_ticket_perm_id IS NULL THEN
    INSERT INTO public.permissions (code, module, description)
    VALUES ('sidebar.project_team.ticket.view', 'Sidebar', 'View tickets in the Project Team workspace')
    RETURNING id INTO v_ticket_perm_id;
  END IF;

  IF v_dashboard_perm_id IS NULL THEN
    INSERT INTO public.permissions (code, module, description)
    VALUES ('sidebar.project_team.dashboard.view', 'Sidebar', 'View dashboard in the Project Team workspace')
    RETURNING id INTO v_dashboard_perm_id;
  END IF;

  IF v_role_mgmt_perm_id IS NULL THEN
    INSERT INTO public.permissions (code, module, description)
    VALUES ('sidebar.project_team.role_management.view', 'Sidebar', 'Manage roles in the Project Team workspace')
    RETURNING id INTO v_role_mgmt_perm_id;
  END IF;

  -- Assign to admin role
  SELECT id INTO v_admin_role_id
  FROM public.roles
  WHERE slug = 'admin' AND is_active;

  IF v_admin_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES 
      (v_admin_role_id, v_ticket_perm_id),
      (v_admin_role_id, v_dashboard_perm_id),
      (v_admin_role_id, v_role_mgmt_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Assign to ops_manager role
  SELECT id INTO v_ops_role_id
  FROM public.roles
  WHERE slug = 'ops_manager' AND is_active;

  IF v_ops_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES 
      (v_ops_role_id, v_ticket_perm_id),
      (v_ops_role_id, v_dashboard_perm_id),
      (v_ops_role_id, v_role_mgmt_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Assign to super_admin role
  SELECT id INTO v_super_admin_role_id
  FROM public.roles
  WHERE slug = 'super_admin' AND is_active;

  IF v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES 
      (v_super_admin_role_id, v_ticket_perm_id),
      (v_super_admin_role_id, v_dashboard_perm_id),
      (v_super_admin_role_id, v_role_mgmt_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 11: Update has_permission to use only role_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions permission ON permission.id = rp.permission_id
    WHERE p.id = _user_id
      AND p.status = 'active'
      AND ur.status = 'active'
      AND permission.code = _permission_code
  );
$$;

-- ============================================================================
-- STEP 12: Verification queries
-- ============================================================================

-- Check: All user_roles have role_id (NOT NULL)
SELECT 
  'user_roles.role_id is NULL' as issue,
  COUNT(*) as count
FROM public.user_roles
WHERE role_id IS NULL;

-- Should return 0 rows

-- Check: All role_ids exist
SELECT 
  'user_roles referencing deleted role' as issue,
  COUNT(*) as count
FROM public.user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE id = ur.role_id);

-- Should return 0 rows

-- Check: Admin has permissions
SELECT 
  r.slug as role,
  COUNT(p.code) as permission_count
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.slug IN ('admin', 'ops_manager', 'super_admin')
GROUP BY r.slug;

-- Check: User roles are linked correctly
SELECT 
  ur.user_id,
  ur.role_id,
  r.slug,
  r.name,
  ur.status,
  'Correct' as status_check
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.user_id = (SELECT id FROM public.profiles WHERE email = 'abhishek.g@airowire.com' LIMIT 1)
ORDER BY ur.created_at DESC;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- SUMMARY OF PROTECTIONS
-- ============================================================================
-- ✅ user_roles.role_id is NOT NULL (database level)
-- ✅ CHECK constraint prevents NULL role_id
-- ✅ FOREIGN KEY prevents invalid role_id
-- ✅ Trigger prevents NULL on INSERT
-- ✅ Trigger prevents NULL on UPDATE
-- ✅ Trigger prevents role deletion if users assigned
-- ✅ Trigger prevents role deactivation if users active
-- ============================================================================
