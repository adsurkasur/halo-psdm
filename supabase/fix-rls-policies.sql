-- ============================================================
-- HALO PSDM: RLS POLICY FIXES
-- Jalankan script ini di Supabase SQL Editor untuk memperbaiki
-- izin akses admin (PH) dalam mengelola role pengguna.
-- ============================================================

BEGIN;

-- 1. Pastikan fungsi current_app_role optimal (mendukung uuid)
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- 2. Perbaiki Policy SELECT pada tabel users
-- Memungkinkan PH dan HR melihat semua pengguna, dan pengguna melihat dirinya sendiri.
DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_elevated" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;

CREATE POLICY "users_select_admin_and_self" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_app_role() IN ('PH', 'HR')
  );

-- 3. Perbaiki Policy UPDATE pada tabel users
-- Memungkinkan PH mengubah role pengguna lain, dan pengguna mengubah profilnya sendiri.
DROP POLICY IF EXISTS "users_update_self_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_update_ph" ON public.users;

CREATE POLICY "users_update_admin_and_self" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_app_role() = 'PH'
  )
  WITH CHECK (
    id = auth.uid()
    OR public.current_app_role() = 'PH'
  );

-- 4. Perbaiki Policy pada admin_profiles
-- PH harus bisa menambah (upsert) admin_profiles untuk pengguna lain.
DROP POLICY IF EXISTS "admin_profiles_insert_admin_only" ON public.admin_profiles;
CREATE POLICY "admin_profiles_insert_ph" ON public.admin_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() = 'PH'
  );

DROP POLICY IF EXISTS "admin_profiles_update_self_or_super" ON public.admin_profiles;
CREATE POLICY "admin_profiles_update_ph_and_self" ON public.admin_profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_app_role() = 'PH'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.current_app_role() = 'PH'
  );

COMMIT;
