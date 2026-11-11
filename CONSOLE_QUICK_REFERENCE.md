# 🎯 Console Debugging Quick Reference Card

## 🎬 Expected Console Flow (Success Path)

```
🔴 RED BANNER
   ├─ [SAVE BUTTON CLICKED]
   └─ Shows: Users selected, Roles selected

🟢 GREEN FLOW
   ├─ [saveRolesMutation] Starting mutation
   ├─ Current assignments table
   ├─ Roles to ADD table
   ├─ Roles to REMOVE table
   └─ Permissions OK

🔵 BLUE DATABASE
   ├─ [assignRoleToUsers] Starting
   ├─ Fetching role details...
   ├─ Role fetch successful
   ├─ Role details table
   └─ Calling RPC function

✅ GREEN SUCCESS
   ├─ [assignRoleToUsers] SUCCESS
   ├─ [saveRolesMutation] ALL COMPLETED
   └─ Dialog closes + notification shows
```

---

## ❌ Error: Database Function Outdated

**Console shows:**
```
❌ RPC CALL FAILED (400 Bad Request)
Error Code: P0001
Error Message: null value in column "role_id"
```

**Fix:**
```sql
-- Paste this in Supabase SQL Editor and Execute

DROP FUNCTION IF EXISTS public.assign_user_role(uuid[], uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found or inactive'; END IF;

  IF target_role.slug IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
    system_role := target_role.slug::public.app_role;
  ELSE system_role := NULL; END IF;

  IF target_role.slug = 'super_admin' AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can assign super admin access';
  END IF;

  IF coalesce(cardinality(_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one user';
  END IF;

  FOREACH target_user_id IN ARRAY _user_ids LOOP
    SELECT id INTO existing_assignment FROM public.user_roles 
    WHERE user_id = target_user_id AND role_id = target_role.id;

    IF existing_assignment IS NOT NULL THEN
      UPDATE public.user_roles SET status = 'active', updated_by = auth.uid(), updated_at = now() 
      WHERE id = existing_assignment;
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

Then: **Hard refresh browser (Ctrl+Shift+R)** and try again.

---

## ❌ Error: Forbidden (Permission Denied)

**Console shows:**
```
❌ RPC CALL FAILED (400 Bad Request)
Error Code: P0001
Error Message: Forbidden
```

**Fix:**
1. Check user has **Admin** or **Super Admin** role
2. Verify they have **users.role_management** permission
3. Hard refresh browser
4. Try again

---

## ❌ Error: Role Not Found

**Console shows:**
```
❌ Role fetch FAILED
Error Code: PGRST116
Error Message: JSON object requested, multiple (or no) rows returned
```

**Fix:**
1. Copy the Role ID from console
2. Check it exists in database `roles` table
3. Verify it's marked `is_active = true`
4. Try again with correct Role ID

---

## ❌ Error: No Users Selected

**Console shows:**
```
❌ ERROR: No users selected
```

**Fix:**
1. Close the dialog
2. Select at least one user from the list
3. Open dialog again
4. Select a role
5. Click Save

---

## 🔍 How to Read the Console

### Open Console
- Press **F12**
- Click **Console** tab

### Look for Red Banner
- Should see: `🔴 [SAVE BUTTON CLICKED]`
- If missing: Check console is open and on right page

### Follow the Color Flow
- 🔴 Red = Button clicked
- 🟢 Green = Mutation processing  
- 🔵 Blue = Database operation
- ✅ Green ✓ = Success
- ❌ Red X = Failure

### Read Error Table
- Error Code = What went wrong (P0001, PGRST116, etc.)
- Error Message = Why it failed
- Error Details = Additional context

### Copy Error Code
- Search the table above for matching error code
- Follow the fix instructions

---

## 📊 Console Log Sections

### Section 1: Button Click
```
────────────────────────────
🔴 [SAVE BUTTON CLICKED]
────────────────────────────
Button State: READY/LOADING
Users selected: [number]
User IDs: [UUID list]
Roles selected: [number]
Role IDs: [UUID list]
```
✅ This shows what you're saving

### Section 2: Mutation Start
```
🟢 [saveRolesMutation] STARTING MUTATION
Users to update: [number]
User IDs: [list]
Roles selected: [number]
Role IDs: [list]
```
✅ Backend processing started

### Section 3: Current State
```
🟢 [saveRolesMutation] Current role assignments
User ID: [UUID]
Role ID: [UUID]
Status: active
```
✅ What roles user already has

### Section 4: Changes
```
🟢 [saveRolesMutation] Roles to ADD
Role ID: [UUID]

🟢 [saveRolesMutation] Roles to REMOVE
[table or "None"]
```
✅ What's being added/removed

### Section 5: Permission Check
```
🟢 [saveRolesMutation] Permissions OK
```
✅ User has permission to make changes

### Section 6: Assignment
```
🟢 [saveRolesMutation] ASSIGNING role to N user(s)
Role ID: [UUID]
Users to assign: [number]
User IDs: [list]
```
✅ Starting the assignment

### Section 7: Database Call
```
🔵 [assignRoleToUsers] Starting assignment
User count: [number]
User IDs: [list]
Role ID: [UUID]

🔵 [assignRoleToUsers] Fetching role details...

✅ [assignRoleToUsers] Role fetched successfully
Role ID: [UUID]
Role Slug: engineer
Is Active: true

🔵 [assignRoleToUsers] Calling RPC function...
_user_ids: [list]
_role_id: [UUID]
role_slug: engineer
```
✅ Database operation in progress

### Section 8: Result
```
✅ [assignRoleToUsers] SUCCESS: Role assigned!

✅ [saveRolesMutation] ALL COMPLETED SUCCESSFULLY!

✅ [saveRolesMutation] SUCCESS: Role changes saved
```
✅ SUCCESS! Dialog closes, notification shows

---

## 🚨 Troubleshooting Matrix

| Symptom | Check | Solution |
|---------|-------|----------|
| No red banner | Console open? | Press F12, Console tab |
| See 🔴 but no 🟢 | Button working? | Reload page, try again |
| See 🟢 but no 🔵 | Permissions? | Check user role + permission |
| See 🔵 but ❌ | Database? | Run SQL fix above |
| See ✅ but no dialog close | Page glitch? | Reload page, try again |
| Nothing happens | JavaScript error? | Check browser for other errors |

---

## 📋 Info to Share When Reporting Bug

```
Browser: Chrome / Firefox / Safari / Edge
OS: Windows / Mac / Linux

User ID: [copy from console User IDs]
Role ID: [copy from console Role IDs]
Error Code: [if shown in error table]
Error Message: [full text from error table]

Screenshot of console: [paste image]
Steps to reproduce: [what you did]
Expected: [what should happen]
Actual: [what actually happened]
```

With this info, we can fix it fast! ⚡

---

## ✨ Pro Tips

### Tip 1: Clear Console Before Testing
```javascript
// Type in console and press Enter
clear()
```
Then do your test. Easier to see fresh output.

### Tip 2: Keep Console Open
Use **Ctrl+Shift+J** (Windows/Linux) or **Cmd+Option+J** (Mac) to open console quickly.

### Tip 3: Right-Click Error
Right-click on error → "Copy object" → paste to file for sharing.

### Tip 4: Search Console
Use **Ctrl+F** in console to search for specific messages.

### Tip 5: Filter by Message
Type in console search: `🔴` to see only clicks, `❌` to see only errors.

### Tip 6: Pin Important Logs
Click the pin icon next to important messages to keep them visible when scrolling.

---

## 🎯 Decision Tree: What Do I Do?

```
Problem?
├─ See 🔴 Red Banner
│  └─ See ✅ Success
│     └─ FIXED! ✨
│  └─ See 🟢 Green
│     └─ See 🔵 Blue
│        └─ See ❌ Error
│           └─ Check error code table above
│              └─ Follow fix instructions
│  └─ No 🟢 Green
│     └─ Check user permissions
│        └─ Run permission fix
├─ No 🔴 Red Banner
│  └─ Check console is open
│     └─ Reload page
│        └─ Try again
```

---

## 🌟 Success Checklist

After clicking Save, you should see:

- ✅ Red banner appears
- ✅ Green flow messages appear
- ✅ Blue database message appears
- ✅ Green success message appears
- ✅ Dialog closes automatically
- ✅ Green notification appears: "User roles updated successfully"
- ✅ User appears in list with new role

If all these are present, it worked! 🎉
