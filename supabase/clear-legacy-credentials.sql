-- Clear legacy credentials/users for Halo PSDM only (safe-scoped)
-- Use this before enabling strict Supabase Auth migration if old non-auth users already exist.
-- IMPORTANT: This script only deletes users that exist in public.users (app scope),
-- then removes matching auth.users rows by id.

begin;

create temporary table tmp_halo_user_ids as
select id::uuid as auth_user_id
from public.users
where id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

delete from public.notifications
where user_id in (select id from public.users);

delete from public.report_status_history
where report_id in (select id from public.reports);

delete from public.chat_messages
where session_id in (select id from public.chat_sessions)
   or sender_id in (select id from public.users);

delete from public.chat_sessions
where user_id in (select id from public.users)
   or assigned_admin_id in (select id from public.users);

delete from public.appointments
where user_id in (select id from public.users)
   or target_admin_id in (select id from public.users);

delete from public.admin_profiles
where user_id in (select id from public.users)
   or id in (select id from public.users);

delete from public.reports
where user_id in (select id from public.users);

delete from public.users;

delete from auth.users
where id in (select auth_user_id from tmp_halo_user_ids);

drop table if exists tmp_halo_user_ids;

commit;

-- Optional verification:
-- select count(*) from public.users;
-- select count(*) from auth.users where id in (select auth_user_id from tmp_halo_user_ids);
