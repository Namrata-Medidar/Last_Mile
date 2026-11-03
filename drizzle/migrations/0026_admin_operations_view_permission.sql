INSERT INTO public.permissions (code, module, description)
VALUES (
  'sidebar.admin.view',
  'Admin & operations',
  'View the Admin & operations page'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles AS r
CROSS JOIN public.permissions AS p
WHERE r.slug = 'super_admin'
  AND p.code = 'sidebar.admin.view'
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions AS rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
