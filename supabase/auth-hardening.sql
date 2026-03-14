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
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
);

drop policy if exists users_insert_self_or_admin on public.users;
create policy users_insert_self_or_admin on public.users
for insert
to authenticated
with check (
  id = auth.uid()::text
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
);

drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin on public.users
for update
to authenticated
using (
  id = auth.uid()::text
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
)
with check (
  id = auth.uid()::text
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
);

drop policy if exists reports_select_policy on public.reports;
create policy reports_select_policy on public.reports
for select
to authenticated
using (
  user_id = auth.uid()::text
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
);

drop policy if exists reports_insert_sender_own on public.reports;
create policy reports_insert_sender_own on public.reports
for insert
to authenticated
with check (
  user_id = auth.uid()::text
  and public.current_app_role() = 'SENDER'
);

drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports
for update
to authenticated
using (public.current_app_role() in ('ADMIN', 'SUPER_ADMIN'))
with check (public.current_app_role() in ('ADMIN', 'SUPER_ADMIN'));

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
        or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
      )
  )
);

drop policy if exists report_history_insert_policy on public.report_status_history;
create policy report_history_insert_policy on public.report_status_history
for insert
to authenticated
with check (
  public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
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
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
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
using (public.current_app_role() in ('ADMIN', 'SUPER_ADMIN'))
with check (public.current_app_role() in ('ADMIN', 'SUPER_ADMIN'));

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
        or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
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
        or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
      )
  )
);

drop policy if exists chat_messages_update_member on public.chat_messages;
create policy chat_messages_update_member on public.chat_messages
for update
to authenticated
using (
  sender_id = auth.uid()::text
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
)
with check (
  sender_id = auth.uid()::text
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
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
with check (public.current_app_role() in ('SUPER_ADMIN'));

drop policy if exists admin_profiles_update_self_or_super on public.admin_profiles;
create policy admin_profiles_update_self_or_super on public.admin_profiles
for update
to authenticated
using (
  user_id = auth.uid()::text
  or public.current_app_role() = 'SUPER_ADMIN'
)
with check (
  user_id = auth.uid()::text
  or public.current_app_role() = 'SUPER_ADMIN'
);

drop policy if exists admin_profiles_delete_super_only on public.admin_profiles;
create policy admin_profiles_delete_super_only on public.admin_profiles
for delete
to authenticated
using (public.current_app_role() = 'SUPER_ADMIN');

drop policy if exists appointments_select_policy on public.appointments;
create policy appointments_select_policy on public.appointments
for select
to authenticated
using (
  user_id = auth.uid()::text
  or public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
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
  public.current_app_role() in ('ADMIN', 'SUPER_ADMIN')
  or user_id = auth.uid()::text
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

commit;
