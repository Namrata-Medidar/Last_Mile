# Fix: Engineer Role Assignment Issue

## Problem

When assigning the "engineer" role to a user, the assignment was failing. The error occurred in the `assign_user_role` database function.

## Root Cause

The `assign_user_role` function (defined in migration 0036) had a flawed conflict resolution strategy:

```sql
ON CONFLICT (user_id, role)
DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active';
```

This approach had multiple issues:

1. **NULL role column conflict**: For custom roles, the `role` column is NULL, making the unique constraint `(user_id, role)` unreliable
2. **Constraint violation**: After migration 0051 made `role_id` NOT NULL with a CHECK constraint, the conflict resolution became problematic
3. **Logic error**: For system roles like "engineer", both `role` and `role_id` need to be properly set, but the conflict clause only updated `role_id`

## Solution

The fix rewrites the `assign_user_role` function to:

1. **Check for existing assignments**: Query the database first to see if a user already has the role assigned
2. **Update or Insert**: 
   - If assignment exists → update status to 'active'
   - If assignment doesn't exist → insert new assignment
3. **Remove ON CONFLICT dependency**: Avoid the complex constraint conflict resolution entirely

### Fixed Function Logic

```sql
FOREACH target_user_id IN ARRAY _user_ids LOOP
  -- Check if assignment already exists
  SELECT id INTO existing_assignment
  FROM public.user_roles
  WHERE user_id = target_user_id AND role_id = target_role.id;

  IF existing_assignment IS NOT NULL THEN
    -- Update existing
    UPDATE public.user_roles
    SET status = 'active', updated_by = auth.uid(), updated_at = now()
    WHERE id = existing_assignment;
  ELSE
    -- Create new
    INSERT INTO public.user_roles(user_id, role_id, role, status, created_by)
    VALUES (target_user_id, target_role.id, system_role, 'active', auth.uid());
  END IF;
END LOOP;
```

## Migration

A new migration `0052_fix_assign_engineer_role.sql` has been created that:

1. Replaces the problematic `assign_user_role` function
2. Uses explicit logic instead of ON CONFLICT clauses
3. Properly handles both system roles (where `role` is set) and custom roles (where `role` is NULL)

## How to Apply

Run the migration:

```bash
drizzle-kit push
```

Or manually execute:

```sql
-- Apply the migration 0052_fix_assign_engineer_role.sql
```

## Testing

After applying the migration, test the engineer role assignment:

1. Navigate to User Role Assignments
2. Select a user
3. Assign the "engineer" role
4. Verify the assignment succeeds without errors

## Verification

The fix ensures:

- ✅ Engineer role can be assigned to users
- ✅ Role assignments are properly tracked with `role_id`
- ✅ Existing assignments are updated (reactivated) when reassigning
- ✅ New assignments are created correctly
- ✅ Both system roles and custom roles work properly

## Related Migrations

- `0036_unify_user_role_management_permission.sql` - Introduced the flawed function
- `0051_bulletproof_role_id_never_null.sql` - Made `role_id` NOT NULL (exposed the bug)
- `0052_fix_assign_engineer_role.sql` - Fixes the function (this solution)
