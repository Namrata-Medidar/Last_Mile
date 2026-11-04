DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id
  FROM public.permissions
  WHERE code IN (
    'sidebar.customer_portal.view',
    'sidebar.field_engineer.view',
    'sidebar.project_team.finance.view'
  )
);

DELETE FROM public.permissions
WHERE code IN (
  'sidebar.customer_portal.view',
  'sidebar.field_engineer.view',
  'sidebar.project_team.finance.view'
);
