-- ==============================================================================
-- 0. CLEANUP ALL EXISTING POLICIES
-- ==============================================================================
DO $$ 
DECLARE
  pol record;
BEGIN
  -- Drop policies on all relevant tables to ensure a perfectly clean slate
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'admin_profiles' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_profiles', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'chat_sessions' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_sessions', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'chat_messages' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_messages', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'reports' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'report_status_history' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.report_status_history', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'appointments' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.appointments', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'notifications' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS get_auth_role() CASCADE;

-- ==============================================================================
-- 1. USERS TABLE
-- ==============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Select: Users can read themselves. Admins can read all. ANYONE can read a user if that user is an admin.
-- This ensures senders can fetch the name/whatsapp of the HR/PH they are interacting with.
CREATE POLICY "Users view access" 
ON users FOR SELECT 
TO authenticated 
USING (
  id = auth.uid() OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = users.id)
);

CREATE POLICY "Users update access" 
ON users FOR UPDATE 
TO authenticated 
USING (id = auth.uid());

-- ==============================================================================
-- 2. ADMIN_PROFILES TABLE
-- ==============================================================================
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin_profiles select" 
ON admin_profiles FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admin_profiles update" 
ON admin_profiles FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Admin_profiles insert" 
ON admin_profiles FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admin_profiles delete" 
ON admin_profiles FOR DELETE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- ==============================================================================
-- 3. CHAT_SESSIONS TABLE
-- ==============================================================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Select: Participants can see the session, or any admin can see it.
CREATE POLICY "Chat_sessions select" 
ON chat_sessions FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() OR 
  assigned_admin_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- Insert: Any authenticated user can create a chat session.
CREATE POLICY "Chat_sessions insert" 
ON chat_sessions FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Update: Participants or admins can update (e.g. to close the session).
CREATE POLICY "Chat_sessions update" 
ON chat_sessions FOR UPDATE 
TO authenticated 
USING (
  user_id = auth.uid() OR 
  assigned_admin_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- ==============================================================================
-- 4. CHAT_MESSAGES TABLE
-- ==============================================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat_messages select" 
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

CREATE POLICY "Chat_messages insert" 
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

CREATE POLICY "Chat_messages update" 
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

-- ==============================================================================
-- 5. REPORTS TABLE
-- ==============================================================================
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports select" 
ON reports FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Reports insert" 
ON reports FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Reports update" 
ON reports FOR UPDATE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- ==============================================================================
-- 6. REPORT_STATUS_HISTORY TABLE
-- ==============================================================================
ALTER TABLE report_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Report_status select" 
ON report_status_history FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM reports 
    WHERE id = report_status_history.report_id 
    AND user_id = auth.uid()
  ) OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Report_status insert" 
ON report_status_history FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- ==============================================================================
-- 7. APPOINTMENTS TABLE
-- ==============================================================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appointments select" 
ON appointments FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() OR 
  target_admin_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Appointments insert" 
ON appointments FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Appointments update" 
ON appointments FOR UPDATE 
TO authenticated 
USING (
  target_admin_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = auth.uid())
);

-- ==============================================================================
-- 8. NOTIFICATIONS TABLE
-- ==============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications select" 
ON notifications FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Notifications insert" 
ON notifications FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Notifications update" 
ON notifications FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());
