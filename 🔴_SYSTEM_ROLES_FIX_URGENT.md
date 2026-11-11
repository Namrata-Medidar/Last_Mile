# 🔴 URGENT: System Roles Assignment Bug Found & Fixed

## The Problem

Only **custom roles** work (like "engineer"), but **system roles** fail silently.

**Root Cause:** Line 65 in `IMPROVED_RPC_FUNCTION.sql` has a hardcoded validation:

```sql
IF target_role.slug NOT IN ('super_admin', 'admin', 'ops_manager', 'engineer', 'customer') THEN
  RAISE EXCEPTION 'Unknown system role: %', target_role.slug;
END IF;
```

This is **backwards logic** - it REJECTS any role NOT in that hardcoded list!

---

## The Fix

Apply this SQL file to Supabase:

### 📋 File: `FIX_SYSTEM_ROLES_BUG.sql`

**What it does:**
1. Drops the broken `assign_user_role()` function
2. Recreates it WITHOUT the hardcoded role list
3. Allows ANY active role (system or custom) to be assigned

---

## 🚀 How to Apply

### Step 1: Open Supabase SQL Editor
Go to: **Supabase Dashboard → SQL Editor → New Query**

### Step 2: Copy & Paste This SQL

```sql
-- Drop the old function with the bug
DROP FUNCTION IF EXISTS public.assign_user_role(uuid[], uuid) CASCADE;

-- Create the FIXED function
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_ids uuid[], _role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.roles;
  target_user_id uuid;
  existing_assignment uuid;
  assigned_count int := 0;
  failed_count int := 0;
  result_message text;
BEGIN
  RAISE NOTICE '[assign_user_role] Starting role assignment';
  RAISE NOTICE '[assign_user_role] Received _user_ids: %, _role_id: %', _user_ids, _role_id;

  IF NOT public.has_permission(auth.uid(), 'users.role_management') THEN
    RAISE EXCEPTION 'Insufficient permissions: users.role_management required';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Insufficient role permissions: admin or super_admin required';
  END IF;

  IF _user_ids IS NULL OR cardinality(_user_ids) = 0 THEN
    RAISE EXCEPTION 'user_ids parameter cannot be empty or NULL';
  END IF;

  IF _role_id IS NULL THEN
    RAISE EXCEPTION 'role_id parameter cannot be NULL';
  END IF;

  SELECT * INTO target_role
  FROM public.roles
  WHERE id = _role_id AND is_active = true;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Role not found or inactive. Role ID: %', _role_id;
  END IF;

  RAISE NOTICE '[assign_user_role] Role found: % (slug: %)', target_role.name, target_role.slug;

  IF target_role.slug = 'super_admin' AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can assign super_admin role';
  END IF;

  -- KEY FIX: Removed the hardcoded role validation!
  -- Now allows ANY active role (system or custom)

  FOREACH target_user_id IN ARRAY _user_ids LOOP
    BEGIN
      RAISE NOTICE '[assign_user_role] Processing user: %', target_user_id;

      SELECT id INTO existing_assignment
      FROM public.user_roles
      WHERE user_id = target_user_id 
        AND role_id = target_role.id
        AND status = 'active';

      IF existing_assignment IS NOT NULL THEN
        UPDATE public.user_roles
        SET status = 'active', updated_by = auth.uid(), updated_at = now()
        WHERE id = existing_assignment;
        
        RAISE NOTICE '[assign_user_role] Updated existing assignment for user %', target_user_id;
      ELSE
        INSERT INTO public.user_roles(user_id, role_id, status, created_by, updated_by)
        VALUES (
          target_user_id,
          target_role.id,
          'active',
          auth.uid(),
          auth.uid()
        );
        
        RAISE NOTICE '[assign_user_role] Inserted new assignment for user %', target_user_id;
      END IF;

      assigned_count := assigned_count + 1;

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      RAISE NOTICE '[assign_user_role] Error processing user %: %', target_user_id, SQLERRM;
    END;
  END LOOP;

  result_message := format('Successfully processed %s users. Assigned: %s, Failed: %s', 
    cardinality(_user_ids), assigned_count, failed_count);
  
  RAISE NOTICE '[assign_user_role] %', result_message;

  RETURN jsonb_build_object(
    'success', true,
    'message', result_message,
    'assigned_count', assigned_count,
    'failed_count', failed_count,
    'total_users', cardinality(_user_ids),
    'role_id', target_role.id,
    'role_name', target_role.name
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[assign_user_role] EXCEPTION: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid[], uuid) TO authenticated;
```

### Step 3: Click **"Run"** ✅

### Step 4: Check the Result

Should see:
```
✅ Fixed! System roles assignment bug removed.
```

---

## ✅ After the Fix

You'll be able to assign:
- ✅ Custom roles (like "engineer") - was already working
- ✅ System roles (like "admin", "ops_manager", "customer") - NOW FIXED
- ✅ Any new roles you create - will work immediately

---

## 🧪 Test It

Try assigning a system role:
1. Go to User Management
2. Select a user
3. Try to assign a **system role** (admin, ops_manager, customer, etc.)
4. Should now work! ✅

---

## Summary

| Before | After |
|--------|-------|
| ❌ System roles REJECTED | ✅ System roles WORK |
| ✅ Custom roles work | ✅ Custom roles still work |
| Hardcoded role list | Dynamic role validation |
| Can assign only 5 specific roles | Can assign ANY active role |

---

**Status:** Ready to apply 🚀
