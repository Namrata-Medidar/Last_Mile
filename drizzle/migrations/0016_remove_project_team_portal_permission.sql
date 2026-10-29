DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id
  FROM public.permissions
  WHERE code = 'sidebar.project_team.portal.view'
);

DELETE FROM public.permissions
WHERE code = 'sidebar.project_team.portal.view';
