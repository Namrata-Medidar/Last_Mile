INSERT INTO public.permissions (code, module, description)
VALUES (
  'sidebar.my_orders.view',
  'Sidebar',
  'Show the My Orders navigation button'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM public.roles AS role
CROSS JOIN public.permissions AS permission
WHERE role.slug = 'customer'
  AND permission.code = 'sidebar.my_orders.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
