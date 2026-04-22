-- ============================================================
-- ARSC SHARED DATABASE — CLEAN SCHEMA
-- Script 02: Migrate Data from Old Schema
-- ⚠️  Jalankan SETELAH Script 01 selesai
-- ⚠️  Jalankan di project BARU yang sudah ada skema bersih
-- ⚠️  Script ini membaca dari schema "old" (linked via Supabase
--     foreign data wrapper atau manual copy-paste hasil export)
--
-- CARA TERMUDAH:
-- 1. Export data dari project lama via Table Editor → CSV
-- 2. Import ke project baru via Table Editor → Import CSV
-- 3. Urutan import: users → admin_profiles → reports →
--    report_status_history → chat_sessions → chat_messages →
--    appointments → notifications
-- ============================================================


-- ============================================================
-- JIKA PAKAI SATU PROJECT YANG SAMA (rename tabel lama dulu)
-- Jalankan bagian ini kalau migrasi in-place di project lama
-- ============================================================

-- Rename tabel lama jadi _old
ALTER TABLE IF EXISTS users              RENAME TO users_old;
ALTER TABLE IF EXISTS admin_profiles     RENAME TO admin_profiles_old;
ALTER TABLE IF EXISTS reports            RENAME TO reports_old;
ALTER TABLE IF EXISTS report_status_history RENAME TO report_status_history_old;
ALTER TABLE IF EXISTS chat_sessions      RENAME TO chat_sessions_old;
ALTER TABLE IF EXISTS chat_messages      RENAME TO chat_messages_old;
ALTER TABLE IF EXISTS appointments       RENAME TO appointments_old;
ALTER TABLE IF EXISTS notifications      RENAME TO notifications_old;


-- ============================================================
-- KEMUDIAN jalankan Script 01 untuk buat tabel baru
-- ============================================================


-- ============================================================
-- MIGRATE DATA: users
-- Catatan: hapus password_hash (unused), hapus phone_number
--          (pindahkan ke admin_profiles.wa_number kalau perlu)
-- ============================================================
INSERT INTO public.users (
  id, name, email, biro, jabatan, role, avatar_url, is_active, created_at, updated_at
)
SELECT
  id::uuid,
  name,
  email,
  COALESCE(biro, ''),
  COALESCE(jabatan, ''),
  CASE
    WHEN role = 'SENDER' THEN 'MEMBER'
    WHEN role = 'ADMIN'  THEN 'ADMIN'
    ELSE 'MEMBER'
  END,
  avatar_url,
  is_active,
  created_at,
  created_at -- updated_at diisi dari created_at karena kolom lama tidak ada
FROM users_old
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- MIGRATE DATA: admin_profiles
-- Catatan: hapus kolom `id` redundan, hapus wa_number_encrypted
-- ============================================================
INSERT INTO public.admin_profiles (
  user_id, display_name, jabatan_display, availability_status, wa_number, updated_at
)
SELECT
  user_id::uuid,
  display_name,
  COALESCE(jabatan_display, ''),
  COALESCE(availability_status, 'OFFLINE'),
  wa_number, -- pakai wa_number plain, buang encrypted
  updated_at
FROM admin_profiles_old
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================
-- MIGRATE DATA: reports
-- Catatan: strip prefix dari ID tidak diperlukan —
--          kita generate uuid baru dan simpan old ID di case_id
--          kalau case_id belum dipakai sebagai display ID,
--          gunakan old ID sebagai case_id
-- ============================================================
INSERT INTO public.reports (
  id, case_id, user_id, category, urgency, kronologi,
  status, admin_notes,
  attachment_url, attachment_name, attachment_path, attachment_mime, attachment_size,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),    -- UUID baru
  COALESCE(case_id, id),  -- pakai case_id lama, fallback ke id lama sebagai display
  user_id::uuid,
  category,
  COALESCE(urgency, 'NORMAL'),
  kronologi,
  COALESCE(status, 'RECEIVED'),
  COALESCE(admin_notes, ''),
  attachment_url, attachment_name, attachment_path, attachment_mime, attachment_size,
  created_at,
  COALESCE(updated_at, created_at)
FROM reports_old;

-- ⚠️  Setelah insert ini, ID reports berubah!
-- Gunakan case_id untuk lookup kalau perlu join dengan data lama.


-- ============================================================
-- MIGRATE DATA: report_status_history
-- Catatan: report_id perlu di-resolve via case_id
-- ============================================================
INSERT INTO public.report_status_history (
  id, report_id, old_status, new_status, changed_by, note, created_at
)
SELECT
  gen_random_uuid(),
  r.id,                      -- UUID baru dari tabel reports yang sudah dimigrate
  rsh.old_status,
  rsh.new_status,
  rsh.changed_by::uuid,
  COALESCE(rsh.note, ''),
  rsh.created_at
FROM report_status_history_old rsh
JOIN public.reports r ON r.case_id = rsh.report_id -- join via case_id
  OR r.case_id = (
    SELECT COALESCE(case_id, id) FROM reports_old WHERE id = rsh.report_id LIMIT 1
  );


-- ============================================================
-- MIGRATE DATA: chat_sessions
-- ============================================================
INSERT INTO public.chat_sessions (
  id, report_id, user_id, assigned_admin_id, status, created_at, closed_at
)
SELECT
  gen_random_uuid(),
  CASE WHEN cs.report_id IS NOT NULL THEN
    (SELECT r.id FROM public.reports r
     JOIN reports_old ro ON r.case_id = COALESCE(ro.case_id, ro.id)
     WHERE ro.id = cs.report_id LIMIT 1)
  ELSE NULL END,
  cs.user_id::uuid,
  cs.assigned_admin_id::uuid,
  COALESCE(cs.status, 'OPEN'),
  cs.created_at,
  cs.closed_at
FROM chat_sessions_old cs;


-- ============================================================
-- MIGRATE DATA: chat_messages
-- Catatan: session_id perlu di-resolve — ini bagian paling kompleks
-- Karena ID chat_sessions juga berubah, kita perlu mapping table
-- ============================================================

-- Buat temporary mapping: old session id → new session id
CREATE TEMP TABLE session_id_map AS
SELECT
  co.id AS old_id,
  cn.id AS new_id
FROM chat_sessions_old co
JOIN public.chat_sessions cn
  ON cn.user_id = co.user_id::uuid
  AND cn.created_at = co.created_at; -- match by user + timestamp

INSERT INTO public.chat_messages (
  id, session_id, sender_id, content, type,
  media_url, media_name, is_read, read_at, created_at
)
SELECT
  gen_random_uuid(),
  sim.new_id,
  cm.sender_id::uuid,
  COALESCE(cm.content, ''),
  COALESCE(cm.type, 'TEXT'),
  cm.media_url,
  cm.media_name,
  COALESCE(cm.is_read, false),
  cm.read_at,
  cm.created_at
FROM chat_messages_old cm
JOIN session_id_map sim ON sim.old_id = cm.session_id;

DROP TABLE IF EXISTS session_id_map;


-- ============================================================
-- MIGRATE DATA: appointments
-- ============================================================
INSERT INTO public.appointments (
  id, user_id, target_admin_id, status, status_note,
  handled_by, handled_at, wa_redirect_logged_at, created_at
)
SELECT
  gen_random_uuid(),
  user_id::uuid,
  target_admin_id::uuid,
  COALESCE(status, 'OPEN'),
  status_note,
  handled_by::uuid,
  handled_at,
  wa_redirect_logged_at,
  created_at
FROM appointments_old;


-- ============================================================
-- MIGRATE DATA: notifications
-- ============================================================
INSERT INTO public.notifications (
  id, user_id, type, payload, title, message, link, is_read, created_at
)
SELECT
  gen_random_uuid(),
  user_id::uuid,
  type,
  COALESCE(payload, '{}'),
  title,
  message,
  link,
  COALESCE(is_read, false),
  created_at
FROM notifications_old;


-- ============================================================
-- VERIFIKASI
-- Jalankan query ini untuk cek jumlah data sebelum & sesudah
-- ============================================================
SELECT
  'users'                 AS tabel, COUNT(*) AS count_baru,
  (SELECT COUNT(*) FROM users_old) AS count_lama
FROM public.users
UNION ALL
SELECT 'reports', COUNT(*), (SELECT COUNT(*) FROM reports_old)
FROM public.reports
UNION ALL
SELECT 'chat_sessions', COUNT(*), (SELECT COUNT(*) FROM chat_sessions_old)
FROM public.chat_sessions
UNION ALL
SELECT 'chat_messages', COUNT(*), (SELECT COUNT(*) FROM chat_messages_old)
FROM public.chat_messages
UNION ALL
SELECT 'notifications', COUNT(*), (SELECT COUNT(*) FROM notifications_old)
FROM public.notifications
UNION ALL
SELECT 'appointments', COUNT(*), (SELECT COUNT(*) FROM appointments_old)
FROM public.appointments;


-- ============================================================
-- CLEANUP: hapus tabel lama setelah verifikasi OK
-- ⚠️  Jangan jalankan sampai kamu yakin data sudah benar
-- ============================================================

-- DROP TABLE users_old CASCADE;
-- DROP TABLE admin_profiles_old CASCADE;
-- DROP TABLE reports_old CASCADE;
-- DROP TABLE report_status_history_old CASCADE;
-- DROP TABLE chat_sessions_old CASCADE;
-- DROP TABLE chat_messages_old CASCADE;
-- DROP TABLE appointments_old CASCADE;
-- DROP TABLE notifications_old CASCADE;
