# 🎯 CONSOLE DEBUGGING - QUICK REFERENCE CARD

## SAVE THIS & PRINT IT! 📋

---

## 🔴 WHAT YOU'LL SEE

```
═════════════════════════════════════════
🔴 [SAVE BUTTON CLICKED] - Initiating role assignment
═════════════════════════════════════════
  Users selected: 1
  User IDs: 22bf5efa-3901-493f-9ff2-b6ea548b4512
  Roles selected: 2
  Role IDs: c8fd545c-51d5-422e-8e89-d3379260d98f, ...

🟢 [saveRolesMutation] STARTING MUTATION
  Users to update: 1
  Roles selected: 2

🟢 [saveRolesMutation] Current role assignments
  User ID: 22bf5efa-3901-...
  Role ID: 5098e564-0ca2-...
  Status: active

🟢 [saveRolesMutation] Roles to ADD
  Role ID: c8fd545c-51d5-...

🔵 [assignRoleToUsers] Starting assignment
  User count: 1
  Role ID: c8fd545c-51d5-...

✅ [assignRoleToUsers] Role fetched successfully

🔵 [assignRoleToUsers] Calling RPC function assign_user_role...

✅ [assignRoleToUsers] SUCCESS: Role assigned to all users!

✅ [saveRolesMutation] ALL ROLE UPDATES COMPLETED SUCCESSFULLY!
```

---

## ❌ ERROR: "null value in column role_id"

```
❌ RPC CALL FAILED (400 Bad Request)
Error Code: P0001
Error Message: null value in column "role_id" of relation "user_roles"
```

**FIX:** Paste this in Supabase SQL Editor and Execute:

```sql
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

Then: **Hard refresh browser (Ctrl+Shift+R)**

---

## ❌ ERROR: "Forbidden"

**CAUSE:** User doesn't have permission  
**FIX:** Check user has Admin or Super Admin role

---

## ❌ ERROR: "JSON object requested, multiple (or no) rows returned"

**CAUSE:** Role ID doesn't exist  
**FIX:** Verify Role ID exists in database and is active

---

## 🎨 COLOR MEANINGS

| Color | Meaning |
|-------|---------|
| 🔴 | Button click / Error |
| 🟢 | Progress / Assignment |
| 🔵 | Database operation |
| ✅ | Success |
| ❌ | Failure |

---

## 📊 EXPECTED FLOW

```
🔴 → 🟢 → 🔵 → ✅ = SUCCESS! 🎉
🔴 → 🟢 → 🔵 → ❌ = ERROR! (See error table)
```

---

## 🔍 HOW TO DEBUG

### 1. Open Console
Press **F12** → Console tab

### 2. Click Save
Select user → Select role → Click Save roles

### 3. Look for Red Banner
Should see: `🔴 [SAVE BUTTON CLICKED]`

### 4. Follow the Color Flow
- 🔴 Red banner (1-2 seconds)
- 🟢 Green messages (1-2 seconds)
- 🔵 Blue message (1-2 seconds)
- ✅ Success OR ❌ Error (final result)

### 5. If Error, Read Table
Find "Error Code" row
Match it to error list above
Follow fix instructions

---

## ✅ SUCCESS SIGNS

- ✅ Dialog closes automatically
- ✅ See "User roles updated successfully" notification
- ✅ User appears with new role in list
- ✅ ✅ [saveRolesMutation] SUCCESS message in console

---

## 💡 PRO TIPS

1. **Clear before testing**
   ```
   Type in console: clear()
   Press Enter
   ```

2. **Keep console open**
   - Use Ctrl+Shift+J to toggle quickly

3. **Search console**
   - Use Ctrl+F to find messages

4. **Screenshot errors**
   - Right-click error → Copy
   - Or screenshot the table

5. **Hard refresh after fixes**
   - Use Ctrl+Shift+R (not just F5)

---

## 📞 INFO TO SHARE WITH SUPPORT

When reporting bug, provide:
- ✅ Error code (e.g., P0001)
- ✅ User ID being assigned
- ✅ Role ID being assigned
- ✅ Console screenshot
- ✅ What you did before error

---

## 📚 FULL GUIDES AVAILABLE

Read these for more details:

1. **00_START_HERE.md** - Quick start (2-5 min)
2. **CONSOLE_QUICK_REFERENCE.md** - All errors & fixes (5 min)
3. **CONSOLE_OUTPUT_EXAMPLES.md** - Real examples (10 min)
4. **IMPROVED_CONSOLE_DEBUG_GUIDE.md** - Complete guide (15 min)
5. **DEBUGGING_GUIDE_INDEX.md** - Navigation hub (5 min)

Located in project root directory!

---

## ⏱️ TYPICAL DEBUG TIME

- **See error:** 5 seconds
- **Find cause:** 1 minute
- **Copy fix:** 1 minute
- **Apply fix:** 1 minute
- **Test again:** 30 seconds

**Total:** ~4 minutes start to finish

---

## 🎯 REMEMBER

```
✨ The console is your friend! ✨

It shows:
- Exactly what you clicked
- Exactly what's being processed
- Exactly where it failed
- Exactly what the error is

No guessing needed! Just read the table! 📊
```

---

## 🚀 NEXT STEPS

1. **Now:** Save this card
2. **Later:** Try assigning a role
3. **Watch:** Console output as it happens
4. **Notice:** How clear everything is!
5. **Use:** For debugging any role assignment issue

---

**Questions?** Check the full guides or ask your team!  
**Issue?** Screenshot console + error table, send to support!  
**Success!** Celebrate the clear error messages! 🎉

---

*Print this card and keep it handy for debugging!*  
*Last Updated: 2026-11-10*
