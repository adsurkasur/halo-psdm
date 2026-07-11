-- ==============================================================================
-- 07 IDENTITY SNAPSHOTTING AND DELETE CASCADE HANDLING
-- ==============================================================================
-- Migration untuk mendukung penghapusan akun (delete account) secara aman
-- dan menyimpan identitas pelapor berupa snapshot (Identity Snapshotting) 
-- agar nama, email, dan nomor WhatsApp pelapor tidak hilang saat akun dihapus.

-- ==============================================================================
-- 1. TAMBAHKAN KOLOM SNAPSHOT IDENTITAS PADA TABEL REPORTS
-- ==============================================================================
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reporter_name text,
  ADD COLUMN IF NOT EXISTS reporter_email text,
  ADD COLUMN IF NOT EXISTS reporter_whatsapp text;


-- ==============================================================================
-- 2. BACKFILL (ISI OTOMATIS) IDENTITAS UNTUK LAPORAN YANG SUDAH ADA
-- ==============================================================================
UPDATE public.reports r
SET 
  reporter_name = u.name,
  reporter_email = u.email,
  reporter_whatsapp = u.whatsapp
FROM public.users u
WHERE r.user_id = u.id
  AND (r.reporter_name IS NULL OR r.reporter_name = '');


-- ==============================================================================
-- 3. BUAT TRIGGER AGAR LAPORAN BARU OTOMATIS MENGISI SNAPSHOT IDENTITAS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sync_reporter_identity_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Jika reporter_name belum diisi dari frontend, ambil langsung dari tabel users
  IF NEW.reporter_name IS NULL OR NEW.reporter_name = '' THEN
    SELECT name, email, whatsapp 
    INTO NEW.reporter_name, NEW.reporter_email, NEW.reporter_whatsapp
    FROM public.users
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_reporter_identity ON public.reports;

CREATE TRIGGER trigger_sync_reporter_identity
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reporter_identity_snapshot();


-- ==============================================================================
-- 4. ATUR FOREIGN KEY REPORTS -> USERS MENJADI ON DELETE SET NULL
-- ==============================================================================
ALTER TABLE public.reports
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_user_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_reports_user;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE SET NULL;


-- ==============================================================================
-- 5. PASTIKAN TABEL TURUNAN TETAP AMAN SAAT USER DIHAPUS (SET NULL / CASCADE)
-- ==============================================================================
-- Report Status History (Tahan riwayat, ubah pengubah status jadi NULL bila dihapus)
ALTER TABLE public.report_status_history
  ALTER COLUMN changed_by DROP NOT NULL;

ALTER TABLE public.report_status_history
  DROP CONSTRAINT IF EXISTS report_status_history_report_id_fkey,
  DROP CONSTRAINT IF EXISTS report_status_history_changed_by_fkey;

ALTER TABLE public.report_status_history
  ADD CONSTRAINT report_status_history_report_id_fkey
  FOREIGN KEY (report_id) REFERENCES public.reports(id)
  ON DELETE CASCADE,
  ADD CONSTRAINT report_status_history_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES public.users(id)
  ON DELETE SET NULL;

-- Chat Sessions (Tahan sesi chat laporan, ubah user_id & assigned_admin_id jadi NULL)
ALTER TABLE public.chat_sessions
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN assigned_admin_id DROP NOT NULL;

ALTER TABLE public.chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_chat_sessions_user,
  DROP CONSTRAINT IF EXISTS chat_sessions_assigned_admin_id_fkey,
  DROP CONSTRAINT IF EXISTS chat_sessions_report_id_fkey;

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE SET NULL,
  ADD CONSTRAINT chat_sessions_assigned_admin_id_fkey
  FOREIGN KEY (assigned_admin_id) REFERENCES public.users(id)
  ON DELETE SET NULL,
  ADD CONSTRAINT chat_sessions_report_id_fkey
  FOREIGN KEY (report_id) REFERENCES public.reports(id)
  ON DELETE CASCADE;

-- Chat Messages (Pesan tetap ada di sesi, ubah pengirim jadi NULL bila user dihapus)
ALTER TABLE public.chat_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_chat_messages_session,
  DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id)
  ON DELETE CASCADE,
  ADD CONSTRAINT chat_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.users(id)
  ON DELETE SET NULL;

-- Appointments (Tahan arsip janji temu)
ALTER TABLE public.appointments
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN target_admin_id DROP NOT NULL,
  ALTER COLUMN handled_by DROP NOT NULL;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_user_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_appointments_user,
  DROP CONSTRAINT IF EXISTS appointments_target_admin_id_fkey,
  DROP CONSTRAINT IF EXISTS appointments_handled_by_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE SET NULL,
  ADD CONSTRAINT appointments_target_admin_id_fkey
  FOREIGN KEY (target_admin_id) REFERENCES public.users(id)
  ON DELETE SET NULL,
  ADD CONSTRAINT appointments_handled_by_fkey
  FOREIGN KEY (handled_by) REFERENCES public.users(id)
  ON DELETE SET NULL;

-- Notifications & Admin Profiles (Bersihkan karena khusus akun individual yang dihapus)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_notifications_user;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.admin_profiles
  DROP CONSTRAINT IF EXISTS admin_profiles_user_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_admin_profiles_user;

ALTER TABLE public.admin_profiles
  ADD CONSTRAINT admin_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE CASCADE;
