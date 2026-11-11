-- QUICK FIX: Apply immediately in Supabase SQL Editor
-- This fixes the role assignment "null value in column role_id" error

-- 1. Ensure roles table exists
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- 2. Seed default system roles
INSERT INTO public.roles (slug, name, description, is_active, is_system)
VALUES
  ('super_admin', 'Super Admin', 'Full system access', true, true),
  ('admin', 'Admin', 'Admin access', true, true),
  ('ops_manager', 'Operations Manager', 'Operations management', true, true),
  ('engineer', 'Field Engineer', 'Service delivery engineer', true, true),
  ('customer', 'Customer', 'Customer user', true, true)
ON CONFLICT (slug) DO NOTHING;

-- 3. Ensure user_roles has role_id column
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_id uuid;

-- 4. Populate NULL role_id values from existing role column
UPDATE public.user_roles ur
SET role_id = (
  SELECT r.id 
  FROM public.roles r 
  WHERE r.is_active 
    AND (
      (ur.role::text = 'admin' AND r.slug = 'admin')
      OR (ur.role::text = 'super_admin' AND r.slug = 'super_admin')
      OR (ur.role::text = 'ops_manager' AND r.slug = 'ops_manager')
      OR (ur.role::text = 'engineer' AND r.slug = 'engineer')
      OR (ur.role::text = 'customer' AND r.slug = 'customer')
    )
  LIMIT 1
)
WHERE ur.role_id IS NULL AND ur.role IS NOT NULL;

-- For any still-NULL role_id, assign 'customer' role
UPDATE public.user_roles ur
SET role_id = (SELECT id FROM public.roles WHERE slug = 'customer' LIMIT 1)
WHERE ur.role_id IS NULL;

-- 5. Add NOT NULL constraint on role_id
ALTER TABLE public.user_roles ALTER COLUMN role_id SET NOT NULL;

-- 6. Add foreign key constraint
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey 
      FOREIGN KEY (role_id) 
      REFERENCES public.roles(id) 
      ON DELETE RESTRICT 
      ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 7. Fix the assign_user_role RPC function
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.roles;
  target_user_id uuid;
  existing_assignment uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.role_management')
    OR NOT (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO target_role
  FROM public.roles
  WHERE id = _role_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found or inactive';
  END IF;

  IF target_role.slug IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Unknown system role slug: %', target_role.slug;
  END IF;

  IF target_role.slug = 'super_admin'
    AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can assign super admin access';
  END IF;

  IF coalesce(cardinality(_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one user';
  END IF;

  FOREACH target_user_id IN ARRAY _user_ids LOOP
    SELECT id INTO existing_assignment
    FROM public.user_roles
    WHERE user_id = target_user_id AND role_id = target_role.id;

    IF existing_assignment IS NOT NULL THEN
      UPDATE public.user_roles
      SET status = 'active', updated_by = auth.uid(), updated_at = now()
      WHERE id = existing_assignment;
    ELSE
      INSERT INTO public.user_roles(user_id, role_id, status, created_by, updated_by)
      VALUES (
        target_user_id,
        target_role.id,
        'active',
        auth.uid(),
        auth.uid()
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
