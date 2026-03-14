-- Clear Halo PSDM account + profile footprint (safe-scoped by public.users)
-- Use this before enabling strict Supabase Auth migration if old/non-auth users already exist.
--
-- What this script clears:
-- - Application profile and relational data in public schema
-- - Auth account in auth.users (for UUID-compatible ids)
-- - Prepares target list for user-owned objects in storage buckets used by this app
--   (actual deletion must be done via Storage API)
--
-- Scope guard:
-- - Only users that currently exist in public.users are targeted.
-- - auth.users deletion only applies to ids that are valid UUID.

begin;

create temporary table tmp_halo_user_ids as
select id::uuid as auth_user_id
from public.users
where id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

create temporary table tmp_halo_user_ids_text as
select auth_user_id::text as user_id
from tmp_halo_user_ids;

-- Collect app storage objects owned by targeted users.
-- NOTE: Direct DELETE on storage.objects is blocked by Supabase (storage.protect_delete).
-- Use this target list with Storage API remove() or Dashboard bucket object delete.
create temporary table tmp_storage_cleanup_targets as
select bucket_id, name
from storage.objects
where bucket_id in ('profile-pictures', 'report-attachments', 'chat-media')
   and split_part(name, '/', 1) in (select user_id from tmp_halo_user_ids_text);

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

create temporary table tmp_cleanup_summary as
select
   (select count(*) from public.users) as public_users_remaining,
   (select count(*) from auth.users where id in (select auth_user_id from tmp_halo_user_ids)) as auth_users_remaining,
   (select count(*) from tmp_storage_cleanup_targets) as storage_objects_pending_api_delete;

-- Return summary rows before temp tables are dropped.
table tmp_cleanup_summary;

-- Return storage targets to delete via Storage API.
table tmp_storage_cleanup_targets;

drop table if exists tmp_halo_user_ids;
drop table if exists tmp_halo_user_ids_text;
drop table if exists tmp_storage_cleanup_targets;
drop table if exists tmp_cleanup_summary;

commit;

-- Optional verification:
-- select count(*) as public_users_remaining from public.users;
-- select count(*) as app_storage_remaining
-- from storage.objects
-- where bucket_id in ('profile-pictures', 'report-attachments', 'chat-media');
