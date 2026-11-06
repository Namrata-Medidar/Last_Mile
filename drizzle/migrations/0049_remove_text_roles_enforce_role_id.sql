-- ============================================================================
-- PROPER FIX: Remove slug dependency entirely and enforce role_id NOT NULL
-- ============================================================================
-- This removes the broken dual role system (text 'role' + UUID 'role_id')
-- and enforces that role_id is ALWAYS set

-- ============================================================================
-- STEP 1: Migrate all roles to use only role_id (no more slug)
-- ============================================================================

-- First, ensure ALL user_roles have role_id populated
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
-- STEP 2: Drop the old 'role' column constraint and make role_id NOT NULL
-- ============================================================================

-- Remove old text-based role references
ALTER TABLE public.user_roles
  ALTER COLUMN role_id SET NOT NULL,
  ALTER COLUMN role DROP NOT NULL;

-- ============================================================================
-- STEP 3: Update has_permission to ONLY use role_id
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
-- STEP 4: Update has_role to ONLY use role_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      JOIN public.roles r ON r.id = ur.role_id AND r.is_active
      WHERE p.id = _user_id
        AND p.status = 'active'
        AND ur.status = 'active'
        AND r.slug = _role::text
    );
$$;

-- ============================================================================
-- STEP 5: Update is_staff to ONLY use role_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      JOIN public.roles r ON r.id = ur.role_id AND r.is_active
      WHERE p.id = _user_id
        AND p.status = 'active'
        AND ur.status = 'active'
        AND r.slug IN ('super_admin', 'admin', 'ops_manager')
    );
$$;

-- ============================================================================
-- STEP 6: Update user_has_role_id to enforce consistency
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_role_id(_user_id uuid, _role_id uuid)
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
    WHERE p.id = _user_id
      AND p.status = 'active'
      AND ur.status = 'active'
      AND ur.role_id = _role_id
  );
$$;

-- ============================================================================
-- STEP 7: Update ensure_assignment_role_link trigger to enforce role_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_assignment_role_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role_id is NULL, we CANNOT auto-populate it anymore
  -- This MUST be provided explicitly - no more text 'role' fallback
  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION 'role_id must be explicitly set. The legacy text-based role field is deprecated.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id) THEN
    RAISE EXCEPTION 'Assigned role (ID: %) does not exist', NEW.role_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_require_role_link ON public.user_roles;
CREATE TRIGGER user_roles_require_role_link
BEFORE INSERT OR UPDATE OF role_id, role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.ensure_assignment_role_link();

-- ============================================================================
-- STEP 8: Ensure all system roles (admin, ops_manager, super_admin) have 
--         sidebar.project_team.ticket.view permission
-- ============================================================================

DO $$
DECLARE
  v_ticket_perm_id uuid;
  v_role_id uuid;
  v_system_roles text[] := ARRAY['admin', 'ops_manager', 'super_admin'];
  v_role_slug text;
BEGIN
  -- Get or create the permission
  SELECT id INTO v_ticket_perm_id
  FROM public.permissions
  WHERE code = 'sidebar.project_team.ticket.view';

  IF v_ticket_perm_id IS NULL THEN
    INSERT INTO public.permissions (code, module, description)
    VALUES ('sidebar.project_team.ticket.view', 'Sidebar', 'View tickets in the Project Team workspace')
    RETURNING id INTO v_ticket_perm_id;
  END IF;

  -- Assign to all system roles
  FOREACH v_role_slug IN ARRAY v_system_roles LOOP
    SELECT id INTO v_role_id
    FROM public.roles
    WHERE slug = v_role_slug AND is_active;

    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_ticket_perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 9: Add constraint to prevent NULL role_id in the future
-- ============================================================================

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_role_id_not_null CHECK (role_id IS NOT NULL);

-- ============================================================================
-- VERIFY THE FIX
-- ============================================================================

SELECT 
  'After Fix - User Roles' as check_type,
  ur.user_id,
  ur.role_id,
  r.slug,
  r.name,
  ur.status
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.user_id = (SELECT id FROM public.profiles WHERE email = 'abhishek.g@airowire.com')
ORDER BY ur.created_at DESC;

SELECT 
  'Admin has permission' as check_type,
  COUNT(*) as has_ticket_view_permission
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.slug = 'admin'
  AND p.code = 'sidebar.project_team.ticket.view';

NOTIFY pgrst, 'reload schema';
