# 🔧 Improved RPC Functions - Complete Guide

## Overview

The improved RPC functions properly handle all three role assignment operations with:

✅ Proper UUID array handling  
✅ All 3 operations (INSERT, UPDATE, DELETE)  
✅ Comprehensive validation  
✅ Detailed logging for debugging  
✅ Error handling with JSON responses  
✅ Return values with operation details  

---

## Three Operations Explained

### Operation 1: INSERT (Assign New Role)

**Function**: `assign_user_role(_user_ids uuid[], _role_id uuid)`

**What it does**:
- Takes an array of user UUIDs (not strings!)
- Assigns them all to a single role
- If user already has that role, updates to ensure it's active
- Returns JSON with operation results

**Example call**:
```sql
SELECT public.assign_user_role(
  ARRAY['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001']::uuid[],
  '660e8400-e29b-41d4-a716-446655440000'::uuid
);
```

**Expected response**:
```json
{
  "success": true,
  "message": "Successfully processed 2 users. Assigned: 2, Failed: 0",
  "assigned_count": 2,
  "failed_count": 0,
  "total_users": 2,
  "role_id": "660e8400-e29b-41d4-a716-446655440000",
  "role_name": "Engineer"
}
```

---

### Operation 2: UPDATE (Change Role)

**Function**: `update_user_role(_user_id uuid, _old_role_id uuid, _new_role_id uuid)`

**What it does**:
- Changes a user's role from old role to new role
- Validates both roles exist and are active
- Updates the role_id in the user_roles record
- Returns JSON with change details

**Example call**:
```sql
SELECT public.update_user_role(
  '550e8400-e29b-41d4-a716-446655440000'::uuid,  -- user_id
  '660e8400-e29b-41d4-a716-446655440000'::uuid,  -- old role (engineer)
  '770e8400-e29b-41d4-a716-446655440000'::uuid   -- new role (admin)
);
```

**Expected response**:
```json
{
  "success": true,
  "message": "Role updated from Engineer to Admin",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "old_role": "Engineer",
  "new_role": "Admin",
  "assignment_id": "880e8400-e29b-41d4-a716-446655440000"
}
```

---

### Operation 3: DELETE (Revoke/Remove Role)

**Function**: `revoke_user_roles(_assignment_ids uuid[])`

**What it does**:
- Takes an array of assignment UUIDs (not user UUIDs!)
- Marks them as inactive (soft delete) or deletes them (hard delete)
- Prevents self-revocation of admin roles
- Prevents non-super_admins from revoking super_admin
- Returns JSON with revocation details

**Example call**:
```sql
SELECT public.revoke_user_roles(
  ARRAY['880e8400-e29b-41d4-a716-446655440000', '890e8400-e29b-41d4-a716-446655440001']::uuid[]
);
```

**Expected response**:
```json
{
  "success": true,
  "message": "Successfully revoked 2 assignments",
  "revoked_count": 2,
  "failed_count": 0,
  "total_processed": 2
}
```

---

## Key Improvements

### 1. UUID Array Handling ✅

**Old (Wrong)**:
```sql
_user_ids text  -- This is wrong! Causes type errors
```

**New (Correct)**:
```sql
_user_ids uuid[]  -- Proper UUID array type
```

**Why it matters**:
- The RPC receives UUIDs from the application
- TypeScript passes UUID[] (array of UUID objects)
- PostgreSQL expects uuid[] type
- String types cause casting errors

---

### 2. All Three Operations ✅

| Operation | Function | What It Does |
|-----------|----------|-------------|
| INSERT | `assign_user_role()` | Assign role to users (new assignment) |
| UPDATE | `update_user_role()` | Change user's role |
| DELETE | `revoke_user_roles()` | Remove role assignment |

---

### 3. Comprehensive Validation ✅

Each function validates:

```
✅ User has 'users.role_management' permission
✅ User has 'admin' or 'super_admin' role
✅ All input parameters are not NULL
✅ Role exists and is active
✅ Role is a known system role (not custom/invalid)
✅ Super_admin assignments only by super_admins
✅ Self-revocation protection
```

---

### 4. Detailed Logging ✅

Functions emit PostgreSQL NOTICE messages for debugging:

```
[assign_user_role] Starting role assignment
[assign_user_role] Received _user_ids: ARRAY[...], _role_id: ...
[assign_user_role] Role found: Engineer (slug: engineer)
[assign_user_role] Processing user: 550e8400-...
[assign_user_role] Inserted new assignment for user 550e8400-...
[assign_user_role] Successfully processed 1 users...
```

**View logs in Supabase**: SQL Editor → Logs (bottom panel)

---

### 5. JSON Response Objects ✅

All functions return JSON with:

**Success response**:
```json
{
  "success": true,
  "message": "Operation completed",
  "[operation-specific data]": "..."
}
```

**Error response**:
```json
{
  "success": false,
  "error": "Specific error message",
  "error_detail": "SQL error code (if available)"
}
```

**Advantages**:
- Easy to parse in application code
- Clear success/failure status
- Detailed message for UI display
- Error details for debugging

---

### 6. Error Handling ✅

Each function handles errors gracefully:

```sql
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  RAISE NOTICE '[function_name] EXCEPTION: %', SQLERRM;
  -- Return JSON error response
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
```

---

## How to Use in Your Application

### From TypeScript/JavaScript

```typescript
// Assign role to users
const result = await supabase.rpc('assign_user_role', {
  _user_ids: [userId1, userId2],  // Array of UUIDs
  _role_id: roleId                 // Single UUID
});

if (result.data.success) {
  console.log(`Assigned ${result.data.assigned_count} users`);
} else {
  console.error(`Failed: ${result.data.error}`);
}

// Update user's role
const result = await supabase.rpc('update_user_role', {
  _user_id: userId,        // UUID
  _old_role_id: oldRoleId, // UUID
  _new_role_id: newRoleId  // UUID
});

// Revoke role assignments
const result = await supabase.rpc('revoke_user_roles', {
  _assignment_ids: [assignmentId1, assignmentId2]  // Array of UUIDs
});
```

---

## Parameter Types - Critical!

### ✅ Correct Type Usage

```sql
-- UUID array (for user_ids and assignment_ids)
_user_ids uuid[]                    -- Array of user UUIDs
_assignment_ids uuid[]              -- Array of assignment UUIDs

-- UUID (for role_id and user_id)
_role_id uuid                       -- Single role UUID
_user_id uuid                       -- Single user UUID
_old_role_id uuid                   -- Single role UUID
_new_role_id uuid                   -- Single role UUID
```

### ❌ Wrong Type Usage (Will Fail)

```sql
_user_ids text          -- WRONG! Use uuid[]
_user_ids varchar       -- WRONG! Use uuid[]
_role_id text           -- WRONG! Use uuid
_assignment_ids text    -- WRONG! Use uuid[]
```

---

## Testing the Functions

### Test 1: Verify Roles Exist

```sql
SELECT id, slug, name FROM public.roles WHERE is_active = true;
-- Should return: super_admin, admin, ops_manager, engineer, customer
```

### Test 2: Assign Role

```sql
-- First, get a user ID and role ID
SELECT id FROM public.profiles LIMIT 1;  -- Get user ID
SELECT id FROM public.roles WHERE slug = 'engineer';  -- Get role ID

-- Then assign
SELECT public.assign_user_role(
  ARRAY['<user-id>']::uuid[],
  '<role-id>'::uuid
);
```

### Test 3: Check Assignment

```sql
SELECT ur.id, ur.user_id, r.slug, ur.status
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.status = 'active'
LIMIT 5;
```

### Test 4: Update Role

```sql
SELECT public.update_user_role(
  '<user-id>'::uuid,
  '<old-role-id>'::uuid,
  '<new-role-id>'::uuid
);
```

### Test 5: Revoke Role

```sql
SELECT public.revoke_user_roles(
  ARRAY['<assignment-id>']::uuid[]
);
```

---

## Files to Apply

### Option 1: Complete Setup (Recommended)

**Apply in this order**:
1. `APPLY_THIS_SQL_NOW.sql` - Basic setup
2. `IMPROVED_RPC_FUNCTION.sql` - Enhanced functions with all 3 operations

### Option 2: Just Enhanced Functions

If your database already has the roles table and constraints:
- Apply only: `IMPROVED_RPC_FUNCTION.sql`

---

## Troubleshooting

### Issue: "operator does not exist: uuid = text"
**Cause**: Parameters being passed as text instead of uuid  
**Fix**: Ensure `_user_ids::uuid[]` casting in your RPC call

### Issue: "cardinality returns NULL"
**Cause**: Passing NULL or empty array  
**Fix**: Validate array is not empty before calling

### Issue: "Role not found"
**Cause**: Role ID doesn't exist or role is inactive  
**Fix**: Check role exists: `SELECT * FROM public.roles WHERE slug = 'engineer'`

### Issue: "null value in column role_id"
**Cause**: Function trying to insert with NULL role_id  
**Fix**: Verify role ID is valid and not NULL before calling

### Issue: "Insufficient permissions"
**Cause**: Calling user doesn't have required permission  
**Fix**: Check user has 'users.role_management' permission and is admin/super_admin

---

## Security Features

✅ **Permission Checks**: Validates user has role_management permission  
✅ **Role Validation**: Ensures role exists and is active  
✅ **Self-Protection**: Prevents accidental self-revocation  
✅ **Super Admin Protection**: Only super_admins can assign super_admin role  
✅ **SQL Injection Protection**: Uses prepared statements (built-in with PL/pgSQL)  
✅ **Audit Trail**: All operations recorded via created_by/updated_by fields  

---

## Summary

| Feature | Status |
|---------|--------|
| INSERT operation | ✅ Implemented |
| UPDATE operation | ✅ Implemented |
| DELETE operation | ✅ Implemented |
| UUID array handling | ✅ Correct |
| Role validation | ✅ Comprehensive |
| Error handling | ✅ JSON responses |
| Logging | ✅ Detailed NOTICE messages |
| Security | ✅ Permission & role checks |
| Documentation | ✅ Complete |

---

**Next Step**: Apply `IMPROVED_RPC_FUNCTION.sql` to your Supabase database for full functionality with all three operations!
