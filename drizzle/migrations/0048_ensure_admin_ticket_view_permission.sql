-- Ensure admin and ops_manager roles have sidebar.project_team.ticket.view permission
-- This handles cases where permissions weren't properly assigned during role creation

-- Get permission ID and role IDs
DO $$
DECLARE
  v_ticket_perm_id uuid;
  v_admin_role_id uuid;
  v_ops_role_id uuid;
  v_super_admin_role_id uuid;
BEGIN
  -- Get the permission ID for project_team.ticket.view
  SELECT id INTO v_ticket_perm_id
  FROM public.permissions
  WHERE code = 'sidebar.project_team.ticket.view'
  LIMIT 1;

  IF v_ticket_perm_id IS NULL THEN
    -- If permission doesn't exist, create it
    INSERT INTO public.permissions (code, module, description)
    VALUES ('sidebar.project_team.ticket.view', 'Sidebar', 'View tickets in the Project Team workspace')
    RETURNING id INTO v_ticket_perm_id;
  END IF;

  -- Get role IDs for system roles
  SELECT id INTO v_admin_role_id
  FROM public.roles
  WHERE slug = 'admin' AND is_active;

  SELECT id INTO v_ops_role_id
  FROM public.roles
  WHERE slug = 'ops_manager' AND is_active;

  SELECT id INTO v_super_admin_role_id
  FROM public.roles
  WHERE slug = 'super_admin' AND is_active;

  -- Assign permission to admin role
  IF v_admin_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (v_admin_role_id, v_ticket_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Assign permission to ops_manager role
  IF v_ops_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (v_ops_role_id, v_ticket_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Assign permission to super_admin role
  IF v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (v_super_admin_role_id, v_ticket_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
