-- ============================================================
-- ARSC SHARED DATABASE — CLEAN SCHEMA
-- Script 01: Create New Schema
-- Jalankan script ini di Supabase SQL Editor (project BARU)
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- CORE: users (profile table, extends auth.users)
-- ============================================================
CREATE TABLE public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  email       text        NOT NULL UNIQUE,
  biro        text        NOT NULL DEFAULT '',
  jabatan     text        NOT NULL DEFAULT '',
  role        text        NOT NULL DEFAULT 'MEMBER',
  -- role values: 'MEMBER' | 'ADMIN' | 'SUPERADMIN'
  avatar_url  text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- HALO PSDM: admin_profiles
-- ============================================================
CREATE TABLE public.admin_profiles (
  user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name        text        NOT NULL,
  jabatan_display     text        NOT NULL DEFAULT '',
  availability_status text        NOT NULL DEFAULT 'OFFLINE',
  -- availability values: 'ONLINE' | 'BUSY' | 'OFFLINE'
  wa_number           text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER admin_profiles_updated_at
  BEFORE UPDATE ON admin_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- HALO PSDM: reports
-- ============================================================
CREATE TABLE public.reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         text        NOT NULL UNIQUE, -- display ID, e.g. "RPT-2025-001"
  user_id         uuid        NOT NULL REFERENCES users(id),
  category        text        NOT NULL,
  urgency         text        NOT NULL DEFAULT 'NORMAL',
  -- urgency values: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  kronologi       text        NOT NULL,
  status          text        NOT NULL DEFAULT 'RECEIVED',
  -- status values: 'RECEIVED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  admin_notes     text        NOT NULL DEFAULT '',
  attachment_url  text,
  attachment_name text,
  attachment_path text,
  attachment_mime text,
  attachment_size bigint,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- HALO PSDM: report_status_history
-- ============================================================
CREATE TABLE public.report_status_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text        NOT NULL,
  changed_by  uuid        NOT NULL REFERENCES users(id),
  note        text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- HALO PSDM: chat_sessions
-- ============================================================
CREATE TABLE public.chat_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid        REFERENCES reports(id) ON DELETE SET NULL,
  user_id           uuid        NOT NULL REFERENCES users(id),
  assigned_admin_id uuid        REFERENCES users(id) ON DELETE SET NULL,
  status            text        NOT NULL DEFAULT 'OPEN',
  -- status values: 'OPEN' | 'CLOSED'
  created_at        timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz
);


-- ============================================================
-- HALO PSDM: chat_messages
-- ============================================================
CREATE TABLE public.chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL REFERENCES users(id),
  content     text        NOT NULL DEFAULT '',
  type        text        NOT NULL DEFAULT 'TEXT',
  -- type values: 'TEXT' | 'IMAGE' | 'FILE'
  media_url   text,
  media_name  text,
  is_read     boolean     NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- HALO PSDM: appointments
-- ============================================================
CREATE TABLE public.appointments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES users(id),
  target_admin_id       uuid        NOT NULL REFERENCES users(id),
  status                text        NOT NULL DEFAULT 'OPEN',
  -- status values: 'OPEN' | 'HANDLED' | 'CANCELLED'
  status_note           text,
  handled_by            uuid        REFERENCES users(id) ON DELETE SET NULL,
  handled_at            timestamptz,
  wa_redirect_logged_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- HALO PSDM: notifications
-- ============================================================
CREATE TABLE public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  payload    jsonb       NOT NULL DEFAULT '{}',
  title      text,
  message    text,
  link       text,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- KEY TRACKER: key_status & key_log
-- ============================================================
CREATE TABLE public.key_status (
  id              int         PRIMARY KEY, -- always 1
  status          text        NOT NULL DEFAULT 'satpam',
  -- status values: 'satpam' | 'held'
  holder_name     text,
  holder_user_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed: initial state
INSERT INTO public.key_status (id, status, holder_name, holder_user_id, updated_at)
VALUES (1, 'satpam', null, null, now());

CREATE TABLE public.key_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action          text        NOT NULL,
  -- action values: 'borrowed' | 'transferred' | 'returned'
  actor_name      text        NOT NULL,
  actor_user_id   uuid        REFERENCES users(id) ON DELETE SET NULL,
  from_holder     text,
  to_holder       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- users
CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_role       ON users(role);
CREATE INDEX idx_users_is_active  ON users(is_active);

-- reports
CREATE INDEX idx_reports_user_id    ON reports(user_id);
CREATE INDEX idx_reports_status     ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_case_id    ON reports(case_id);

-- report_status_history
CREATE INDEX idx_rsh_report_id   ON report_status_history(report_id);
CREATE INDEX idx_rsh_created_at  ON report_status_history(created_at DESC);

-- chat_sessions
CREATE INDEX idx_cs_user_id           ON chat_sessions(user_id);
CREATE INDEX idx_cs_assigned_admin_id ON chat_sessions(assigned_admin_id);
CREATE INDEX idx_cs_status            ON chat_sessions(status);
CREATE INDEX idx_cs_created_at        ON chat_sessions(created_at DESC);

-- chat_messages
CREATE INDEX idx_cm_session_id  ON chat_messages(session_id);
CREATE INDEX idx_cm_sender_id   ON chat_messages(sender_id);
CREATE INDEX idx_cm_is_read     ON chat_messages(is_read);
CREATE INDEX idx_cm_created_at  ON chat_messages(created_at DESC);

-- appointments
CREATE INDEX idx_apt_user_id         ON appointments(user_id);
CREATE INDEX idx_apt_target_admin_id ON appointments(target_admin_id);
CREATE INDEX idx_apt_status          ON appointments(status);
CREATE INDEX idx_apt_created_at      ON appointments(created_at DESC);

-- notifications
CREATE INDEX idx_notif_user_id    ON notifications(user_id);
CREATE INDEX idx_notif_is_read    ON notifications(is_read);
CREATE INDEX idx_notif_created_at ON notifications(created_at DESC);

-- key_log
CREATE INDEX idx_key_log_created_at     ON key_log(created_at DESC);
CREATE INDEX idx_key_log_actor_user_id  ON key_log(actor_user_id);


-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_status         ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_log            ENABLE ROW LEVEL SECURITY;

-- users: bisa baca profil sendiri
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- admin bisa baca semua users
CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('ADMIN', 'SUPERADMIN')
    )
  );

-- notifications: hanya milik sendiri
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- key_status & key_log: public read, authenticated write
CREATE POLICY "key_status_read" ON key_status
  FOR SELECT USING (true);

CREATE POLICY "key_status_write" ON key_status
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "key_log_read" ON key_log
  FOR SELECT USING (true);

CREATE POLICY "key_log_insert" ON key_log
  FOR INSERT WITH CHECK (true); -- allow guest inserts too

-- Catatan: untuk tabel lainnya (reports, chat, appointments),
-- gunakan service_role key dari server routes (sudah bypass RLS).
-- Tambahkan policies lebih granular sesuai kebutuhan app.
