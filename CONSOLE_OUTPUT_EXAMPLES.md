# 🎬 Real Console Output Examples

## ✅ SUCCESSFUL ENGINEER ROLE ASSIGNMENT

### What You'll See in the Console:

```
════════════════════════════════════════
🔴 [SAVE BUTTON CLICKED] - Initiating role assignment
════════════════════════════════════════

┌─────────────────────────────────────┐
│ Button State      READY              │
│ Users selected    1                  │
│ User IDs          22bf5efa-3901-... │
│ Roles selected    2                  │
│ Role IDs          c8fd545c-51d5-..., │
│                   1f4c2499-6731-...  │
└─────────────────────────────────────┘

🟢 [saveRolesMutation] STARTING MUTATION

┌──────────────────────────────────────────┐
│ Users to update        1                 │
│ User IDs              22bf5efa-3901-...  │
│ Roles selected        2                  │
│ Role IDs              c8fd545c-51d5-..., │
│                       1f4c2499-6731-...  │
└──────────────────────────────────────────┘

🟢 [saveRolesMutation] Current role assignments

┌────────────────────────────────────┐
│ User ID    22bf5efa-3901-...       │
│ Role ID    5098e564-0ca2-...       │
│ Status     active                  │
└────────────────────────────────────┘

🟢 [saveRolesMutation] Roles to ADD

┌────────────────────────────────────┐
│ Role ID    c8fd545c-51d5-...       │
│ Role ID    1f4c2499-6731-...       │
└────────────────────────────────────┘

🟢 [saveRolesMutation] Roles to REMOVE

┌────────────────────────────────────┐
│ Roles to remove    None             │
└────────────────────────────────────┘

🟢 [saveRolesMutation] Permissions OK - Proceeding with assignment

🟢 [saveRolesMutation] ASSIGNING role to 1 user(s)

┌──────────────────────────────────────┐
│ Role ID            c8fd545c-51d5-...  │
│ Users to assign    1                  │
│ User IDs           22bf5efa-3901-...  │
└──────────────────────────────────────┘

🔵 [assignRoleToUsers] Starting assignment

┌──────────────────────────────────────┐
│ User count    1                       │
│ User IDs      22bf5efa-3901-...       │
│ Role ID       c8fd545c-51d5-...       │
└──────────────────────────────────────┘

🔵 [assignRoleToUsers] Fetching role details from database...

✅ [assignRoleToUsers] Role fetched successfully

┌──────────────────────────────────────┐
│ Role ID      c8fd545c-51d5-...       │
│ Role Slug    engineer                │
│ Is Active    true                    │
└──────────────────────────────────────┘

🔵 [assignRoleToUsers] About to call RPC function assign_user_role...

RPC Parameters:

┌──────────────────────────────────────┐
│ _user_ids      22bf5efa-3901-...     │
│ _role_id       c8fd545c-51d5-...     │
│ role_slug      engineer              │
└──────────────────────────────────────┘

✅ [assignRoleToUsers] SUCCESS: Role assigned to all users!

✅ [saveRolesMutation] ALL ROLE UPDATES COMPLETED SUCCESSFULLY!

✅ [saveRolesMutation] SUCCESS: Role changes saved
```

---

## ❌ ERROR: Database Function Not Updated

### What You'll See:

```
════════════════════════════════════════
🔴 [SAVE BUTTON CLICKED] - Initiating role assignment
════════════════════════════════════════

[... same green logs as above until RPC call ...]

🔵 [assignRoleToUsers] About to call RPC function assign_user_role...

RPC Parameters:

┌──────────────────────────────────────┐
│ _user_ids      22bf5efa-3901-...     │
│ _role_id       c8fd545c-51d5-...     │
│ role_slug      engineer              │
└──────────────────────────────────────┘

❌ [assignRoleToUsers] RPC CALL FAILED (400 Bad Request)

Database error details:

┌─────────────────────────────────────────────────────┐
│ Error Code        P0001                             │
│ Error Message     null value in column "role_id"    │
│                   of relation "user_roles" violates │
│                   not-null constraint               │
│ Error Details     N/A                               │
│ Error Hint        N/A                               │
└─────────────────────────────────────────────────────┘

❌ [saveRolesMutation] FAILED: Error during role update

Error message: null value in column "role_id" of relation "user_roles" violates not-null constraint
Stack trace: Error: null value in column "role_id" of relation "user_roles" violates not-null constraint
    at normalizeError (rolePermissionService.ts:58:12)
    at Object.assignRoleToUsers (rolePermissionService.ts:382:13)
```

### What This Means:

The database function `assign_user_role` is still using the OLD broken code.

### How to Fix:

1. Open Supabase dashboard
2. Go to **SQL Editor**
3. Run this query:

```sql
DROP FUNCTION IF EXISTS public.assign_user_role(uuid[], uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.roles;
  target_user_id uuid;
  system_role public.app_role;
  existing_assignment uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users.role_management')
    OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO target_role FROM public.roles WHERE id = _role_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found or inactive';
  END IF;

  IF target_role.slug IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
    system_role := target_role.slug::public.app_role;
  ELSE
    system_role := NULL;
  END IF;

  IF target_role.slug = 'super_admin' AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can assign super admin access';
  END IF;

  IF coalesce(cardinality(_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one user';
  END IF;

  FOREACH target_user_id IN ARRAY _user_ids LOOP
    SELECT id INTO existing_assignment FROM public.user_roles WHERE user_id = target_user_id AND role_id = target_role.id;

    IF existing_assignment IS NOT NULL THEN
      UPDATE public.user_roles SET status = 'active', updated_by = auth.uid(), updated_at = now() WHERE id = existing_assignment;
    ELSE
      INSERT INTO public.user_roles(user_id, role_id, role, status, created_by, updated_by)
      VALUES (target_user_id, target_role.id, system_role, 'active', auth.uid(), auth.uid());
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;
```

4. Press **Execute**
5. Hard refresh browser: **Ctrl+Shift+R**
6. Try assigning the role again

---

## ❌ ERROR: Permission Denied

### What You'll See:

```
🔴 [SAVE BUTTON CLICKED]

🟢 [saveRolesMutation] STARTING MUTATION

🟢 [saveRolesMutation] Permissions OK - Proceeding with assignment

🔵 [assignRoleToUsers] Starting assignment

🔵 [assignRoleToUsers] Fetching role details from database...

✅ [assignRoleToUsers] Role fetched successfully

🔵 [assignRoleToUsers] About to call RPC function assign_user_role...

❌ [assignRoleToUsers] RPC CALL FAILED (400 Bad Request)

Database error details:

┌────────────────────────────┐
│ Error Code      P0001      │
│ Error Message   Forbidden  │
│ Error Details   N/A        │
└────────────────────────────┘
```

### What This Means:

The logged-in user doesn't have permission to assign roles.

### How to Fix:

1. Check that the user has **Admin** or **Super Admin** role
2. Verify they have the **users.role_management** permission
3. If they do, refresh the browser and try again

---

## ❌ ERROR: Role Does Not Exist

### What You'll See:

```
🔴 [SAVE BUTTON CLICKED]

🟢 [saveRolesMutation] STARTING MUTATION

🟢 [saveRolesMutation] Current role assignments

🔵 [assignRoleToUsers] Starting assignment

🔵 [assignRoleToUsers] Fetching role details from database...

❌ [assignRoleToUsers] Role fetch FAILED

Error details:

┌──────────────────────────────────────────┐
│ Error Code      PGRST116                 │
│ Error Message   JSON object requested,   │
│                 multiple (or no) rows    │
│                 returned                 │
└──────────────────────────────────────────┘
```

### What This Means:

The Role ID doesn't exist in the database.

### How to Fix:

1. Double-check the Role ID is correct
2. Verify the role exists in the **Roles** table
3. Make sure it's marked as **active** (is_active = true)

---

## 📊 Quick Reference Table

| Error | Cause | Solution |
|-------|-------|----------|
| `null value in column "role_id"` | Database function is outdated | Run the SQL fix above |
| `role_id must be explicitly set` | Database function is outdated | Run the SQL fix above |
| `Forbidden` | User lacks permission | Check user has Admin/Super Admin role |
| `JSON object requested` | Role ID doesn't exist | Verify role exists and is active |
| `role is not active` | Role is marked inactive | Activate the role in the database |
| `Select at least one user` | No users selected | Select users before clicking Save |

---

## 🎯 Step-by-Step Debugging

### Step 1: Open Console
- Press **F12** in browser
- Click **Console** tab

### Step 2: Click Save
- Select user
- Select role
- Click **Save roles** button

### Step 3: Check for Red Banner
- Should see: `🔴 [SAVE BUTTON CLICKED]`
- If you don't see it, console might be closed or wrong tab

### Step 4: Look for Success or Error
- **Success path**: 🔴 → 🟢 → 🔵 → ✅
- **Error path**: 🔴 → 🟢 → 🔵 → ❌

### Step 5: If Error, Read the Table
- Find the `Error Code` in the table
- Match it to the table above
- Follow the solution

### Step 6: Screenshot for Support
If you can't fix it:
- Screenshot the error table
- Include the User ID being assigned
- Include the Role ID being assigned
- Share with support

---

## 🏁 How to Know It Worked

After clicking Save, you should see:

```
✅ [saveRolesMutation] SUCCESS: Role changes saved
```

**AND**

- The dialog closes
- Green notification appears: "User roles updated successfully."
- User appears with new role in the table

If you see this, the assignment worked! 🎉
