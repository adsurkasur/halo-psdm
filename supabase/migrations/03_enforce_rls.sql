-- ==============================================================================
-- 0. CLEANUP ALL EXISTING POLICIES
-- ==============================================================================
DO $$ 
DECLARE
  pol record;
BEGIN
  -- Drop all policies on users table
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;

  -- Drop all policies on admin_profiles table
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'admin_profiles' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_profiles', pol.policyname);
  END LOOP;

  -- Drop all policies on chat_messages table
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'chat_messages' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_messages', pol.policyname);
  END LOOP;
END $$;

-- Drop the helper function if it still exists from previous attempts
DROP FUNCTION IF EXISTS get_auth_role() CASCADE;

-- ==============================================================================
-- 1. USERS TABLE
-- ==============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile, OR admins can read all profiles.
-- We use admin_profiles to check for admin status to avoid infinite recursion on the users table.
CREATE POLICY "Users can view own profile or admins can view all" 
ON users FOR SELECT 
TO authenticated 
USING (
  id = auth.uid() OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- Users can update their own profile.
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
TO authenticated 
USING (id = auth.uid());

-- ==============================================================================
-- 2. ADMIN_PROFILES TABLE
-- ==============================================================================
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read admin profiles (for directory/dropdowns).
CREATE POLICY "Anyone can read admin profiles" 
ON admin_profiles FOR SELECT 
TO authenticated 
USING (true);

-- Admins can update their own profile (e.g. availability status).
CREATE POLICY "Admins can update own profile" 
ON admin_profiles FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());

-- Admins can insert new admin profiles (Kelola HR feature).
CREATE POLICY "Admins can insert admin profiles" 
ON admin_profiles FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- Admins can delete admin profiles (Keluarkan dari Daftar).
CREATE POLICY "Admins can delete admin profiles" 
ON admin_profiles FOR DELETE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- ==============================================================================
-- 3. CHAT_MESSAGES TABLE
-- ==============================================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages if they are part of the session, or if they are an admin.
CREATE POLICY "Participants and admins can read messages" 
ON chat_messages FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE id = chat_messages.session_id 
    AND (user_id = auth.uid() OR assigned_admin_id = auth.uid())
  ) OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- Users can insert messages if they are part of the session or an admin.
CREATE POLICY "Participants and admins can insert messages" 
ON chat_messages FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE id = chat_messages.session_id 
    AND (user_id = auth.uid() OR assigned_admin_id = auth.uid())
  ) OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- Users can update messages (e.g., mark as read).
CREATE POLICY "Participants and admins can update messages" 
ON chat_messages FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE id = chat_messages.session_id 
    AND (user_id = auth.uid() OR assigned_admin_id = auth.uid())
  ) OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);
