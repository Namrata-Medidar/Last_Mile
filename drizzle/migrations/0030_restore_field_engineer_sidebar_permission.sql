INSERT INTO public.permissions (code, module, description)
VALUES (
  'sidebar.field_engineer.view',
  'Sidebar',
  'View the Field Engineer Support entry in the sidebar'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM public.roles AS role
CROSS JOIN public.permissions AS permission
WHERE role.slug = 'engineer'
  AND permission.code = 'sidebar.field_engineer.view'
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions AS existing
    WHERE existing.role_id = role.id
      AND existing.permission_id = permission.id
  );
