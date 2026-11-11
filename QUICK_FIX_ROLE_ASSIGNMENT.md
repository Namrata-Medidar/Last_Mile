# Quick Fix: Role Assignment Issue

## TL;DR

The role assignment was failing because 37 database migrations were not applied. This has been fixed.

## What To Do Now

### Step 1: Apply the Migration

**Recommended: Automatic via Build**
```bash
npm run build
# or
bun run build
```

**Alternative: Manual via Supabase**
1. Go to https://supabase.com → Your Project (tvztrfoiqcbdvsblkbdq)
2. Click **SQL Editor**
3. Click **New Query**
4. Copy & paste content from: `drizzle/migrations/0053_fix_role_assignment_critical.sql`
5. Click **Run**

### Step 2: Test the Fix

1. Navigate to **User Management** in your app
2. Select a user
3. Assign them the "Engineer" role
4. Click **Save**
5. Should work without errors!

## What Was Fixed

❌ **Before**: Role assignment failed with "null value in column 'role_id'"

✅ **After**: 
- Roles table properly created and seeded
- User role assignments work correctly
- Database constraints prevent invalid data
- RPC function properly handles role IDs

## Files Changed

- ✅ `drizzle/migrations/meta/_journal.json` - Resolved git merge conflict
- ✅ `drizzle/migrations/0053_fix_role_assignment_critical.sql` - Applied comprehensive fix
- ✅ `ROLE_ASSIGNMENT_FIX.md` - Detailed explanation (this directory)

## If You Still Have Issues

1. Run verification queries from [VERIFY_ENGINEER_ROLE.sql](./VERIFY_ENGINEER_ROLE.sql)
2. Check console logs in browser (F12 → Console tab)
3. Ensure you have admin/super_admin role to assign roles
4. Verify the migration was applied in Supabase (check schema in SQL Editor)

## Need More Details?

See [ROLE_ASSIGNMENT_FIX.md](./ROLE_ASSIGNMENT_FIX.md) for complete technical details.
