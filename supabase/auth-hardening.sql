-- Halo PSDM Supabase Auth Hardening
-- Goal: move auth to Supabase Auth (auth.users) while keeping app profile data in public.users.
-- This script assumes tables from supabase/bootstrap.sql already exist.

begin;

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select role
  from public.users
  where id = auth.uid()::text
  limit 1;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  raw_biro text;
  raw_jabatan text;
begin
  raw_name := coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'User'), '@', 1));
  raw_biro := coalesce(new.raw_user_meta_data ->> 'biro', 'INFOKOM');
  raw_jabatan := coalesce(new.raw_user_meta_data ->> 'jabatan', 'ANGGOTA_MUDA');

  begin
    insert into public.users (
      id,
      name,
      biro,
      jabatan,
      role,
      email,
      is_active,
      created_at
    )
    values (
      new.id::text,
      raw_name,
      raw_biro,
      raw_jabatan,
      'SENDER',
      new.email,
      true,
      now()
    )
    on conflict (id) do update
      set email = excluded.email,
          name = coalesce(public.users.name, excluded.name);
  exception when others then
    -- Never block auth signup if profile bootstrap fails.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = new.email
  where id = new.id::text;
  return new;
end;
$$;

drop trigger if exists trg_handle_auth_user_email_update on auth.users;
create trigger trg_handle_auth_user_email_update
after update of email on auth.users
for each row
execute function public.handle_auth_user_email_update();

-- Keep legacy column for compatibility but no longer required for auth.
alter table public.users alter column password_hash drop not null;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists phone_number text;
alter table public.users add column if not exists theme_preference text;
update public.users
set theme_preference = 'light'
where theme_preference is null or theme_preference not in ('light', 'dark');
alter table public.users alter column theme_preference set default 'light';
alter table public.users alter column theme_preference set not null;
alter table public.users drop constraint if exists users_theme_preference_check;
alter table public.users add constraint users_theme_preference_check check (theme_preference in ('light', 'dark'));

-- Report attachment metadata columns.
alter table public.reports add column if not exists attachment_url text;
alter table public.reports add column if not exists attachment_name text;
alter table public.reports add column if not exists attachment_path text;
alter table public.reports add column if not exists attachment_mime text;
alter table public.reports add column if not exists attachment_size bigint;

-- Storage bucket for report attachments.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-attachments',
  'report-attachments',
  true,
  10485760,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists report_attachments_select_auth on storage.objects;
create policy report_attachments_select_auth on storage.objects
for select
to authenticated
using (bucket_id = 'report-attachments');

drop policy if exists report_attachments_insert_own on storage.objects;
create policy report_attachments_insert_own on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists report_attachments_update_owner_or_admin on storage.objects;
create policy report_attachments_update_owner_or_admin on storage.objects
for update
to authenticated
using (
  bucket_id = 'report-attachments'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.current_app_role() in ('PH')
  )
)
with check (
  bucket_id = 'report-attachments'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.current_app_role() in ('PH')
  )
);

drop policy if exists report_attachments_delete_owner_or_admin on storage.objects;
create policy report_attachments_delete_owner_or_admin on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-attachments'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.current_app_role() in ('PH')
  )
);

-- Storage bucket for user profile pictures.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_pictures_select_auth on storage.objects;
create policy profile_pictures_select_auth on storage.objects
for select
to authenticated
using (bucket_id = 'profile-pictures');

drop policy if exists profile_pictures_insert_own on storage.objects;
create policy profile_pictures_insert_own on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-pictures'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists profile_pictures_update_own on storage.objects;
create policy profile_pictures_update_own on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-pictures'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'profile-pictures'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists profile_pictures_delete_own_or_admin on storage.objects;
create policy profile_pictures_delete_own_or_admin on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.current_app_role() in ('PH')
  )
);

-- Storage bucket for chat media attachments.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_media_select_auth on storage.objects;
create policy chat_media_select_auth on storage.objects
for select
to authenticated
using (bucket_id = 'chat-media');

drop policy if exists chat_media_insert_own on storage.objects;
create policy chat_media_insert_own on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists chat_media_update_own_or_admin on storage.objects;
create policy chat_media_update_own_or_admin on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat-media'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.current_app_role() in ('PH')
  )
)
with check (
  bucket_id = 'chat-media'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.current_app_role() in ('PH')
  )
);

drop policy if exists chat_media_delete_own_or_admin on storage.objects;
create policy chat_media_delete_own_or_admin on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-media'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.current_app_role() in ('PH')
  )
);

-- Revoke permissive grants/policies from bootstrap.
revoke select, insert, update, delete on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.report_status_history to authenticated;
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.admin_profiles to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

drop policy if exists users_open_access on public.users;
drop policy if exists reports_open_access on public.reports;
drop policy if exists report_status_history_open_access on public.report_status_history;
drop policy if exists chat_sessions_open_access on public.chat_sessions;
drop policy if exists chat_messages_open_access on public.chat_messages;
drop policy if exists admin_profiles_open_access on public.admin_profiles;
drop policy if exists appointments_open_access on public.appointments;
drop policy if exists notifications_open_access on public.notifications;

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin on public.users
for select
to authenticated
using (
  id = auth.uid()::text
  or public.current_app_role() in ('PH')
);

drop policy if exists users_insert_self_or_admin on public.users;
create policy users_insert_self_or_admin on public.users
for insert
to authenticated
with check (
  id = auth.uid()::text
  or public.current_app_role() in ('PH')
);

drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin on public.users
for update
to authenticated
using (
  id = auth.uid()::text
  or public.current_app_role() in ('PH')
)
with check (
  id = auth.uid()::text
  or public.current_app_role() in ('PH')
);

drop policy if exists reports_select_policy on public.reports;
create policy reports_select_policy on public.reports
for select
to authenticated
using (
  user_id = auth.uid()::text
  or public.current_app_role() in ('PH')
);

drop policy if exists reports_insert_sender_own on public.reports;
create policy reports_insert_sender_own on public.reports
for insert
to authenticated
with check (
  user_id = auth.uid()::text
  and public.current_app_role() in ('SENDER', 'HR')
);

drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports
for update
to authenticated
using (public.current_app_role() in ('PH'))
with check (public.current_app_role() in ('PH'));

drop policy if exists report_history_select_policy on public.report_status_history;
create policy report_history_select_policy on public.report_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.reports r
    where r.id = report_status_history.report_id
      and (
        r.user_id = auth.uid()::text
        or public.current_app_role() in ('PH')
      )
  )
);

drop policy if exists report_history_insert_policy on public.report_status_history;
create policy report_history_insert_policy on public.report_status_history
for insert
to authenticated
with check (
  public.current_app_role() in ('PH')
  or (
    changed_by = 'system'
    and exists (
      select 1
      from public.reports r
      where r.id = report_status_history.report_id
        and r.user_id = auth.uid()::text
    )
  )
);

drop policy if exists chat_sessions_select_policy on public.chat_sessions;
create policy chat_sessions_select_policy on public.chat_sessions
for select
to authenticated
using (
  user_id = auth.uid()::text
  or public.current_app_role() in ('PH')
);

drop policy if exists chat_sessions_insert_sender_own on public.chat_sessions;
create policy chat_sessions_insert_sender_own on public.chat_sessions
for insert
to authenticated
with check (
  user_id = auth.uid()::text
);

drop policy if exists chat_sessions_update_admin on public.chat_sessions;
create policy chat_sessions_update_admin on public.chat_sessions
for update
to authenticated
using (public.current_app_role() in ('PH'))
with check (public.current_app_role() in ('PH'));

drop policy if exists chat_messages_select_policy on public.chat_messages;
create policy chat_messages_select_policy on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_sessions s
    where s.id = chat_messages.session_id
      and (
        s.user_id = auth.uid()::text
        or s.assigned_admin_id = auth.uid()::text
        or public.current_app_role() in ('PH')
      )
  )
);

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member on public.chat_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()::text
  and exists (
    select 1
    from public.chat_sessions s
    where s.id = chat_messages.session_id
      and (
        s.user_id = auth.uid()::text
        or s.assigned_admin_id = auth.uid()::text
        or public.current_app_role() in ('PH')
      )
  )
);

drop policy if exists chat_messages_update_member on public.chat_messages;
create policy chat_messages_update_member on public.chat_messages
for update
to authenticated
using (
  sender_id = auth.uid()::text
  or public.current_app_role() in ('PH')
)
with check (
  sender_id = auth.uid()::text
  or public.current_app_role() in ('PH')
);

drop policy if exists admin_profiles_select_all_authenticated on public.admin_profiles;
create policy admin_profiles_select_all_authenticated on public.admin_profiles
for select
to authenticated
using (true);

drop policy if exists admin_profiles_insert_admin_only on public.admin_profiles;
create policy admin_profiles_insert_admin_only on public.admin_profiles
for insert
to authenticated
with check (public.current_app_role() in ('PH'));

drop policy if exists admin_profiles_update_self_or_super on public.admin_profiles;
create policy admin_profiles_update_self_or_super on public.admin_profiles
for update
to authenticated
using (
  user_id = auth.uid()::text
  or public.current_app_role() = 'PH'
)
with check (
  user_id = auth.uid()::text
  or public.current_app_role() = 'PH'
);

drop policy if exists admin_profiles_delete_super_only on public.admin_profiles;
create policy admin_profiles_delete_super_only on public.admin_profiles
for delete
to authenticated
using (public.current_app_role() = 'PH');

drop policy if exists appointments_select_policy on public.appointments;
create policy appointments_select_policy on public.appointments
for select
to authenticated
using (
  user_id = auth.uid()::text
  or public.current_app_role() in ('PH')
);

drop policy if exists appointments_insert_sender_own on public.appointments;
create policy appointments_insert_sender_own on public.appointments
for insert
to authenticated
with check (
  user_id = auth.uid()::text
);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select
to authenticated
using (user_id = auth.uid()::text);

drop policy if exists notifications_insert_admin_or_system on public.notifications;
create policy notifications_insert_admin_or_system on public.notifications
for insert
to authenticated
with check (
  public.current_app_role() in ('PH')
  or user_id = auth.uid()::text
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

commit;


