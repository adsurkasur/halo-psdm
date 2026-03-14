-- Halo PSDM Supabase Bootstrap
-- Purpose: create the schema required by current app code in AuthContext/DataContext.
-- Run this in Supabase SQL Editor for the target project.

begin;

create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  name text not null,
  biro text not null check (biro in ('KETUM', 'ADKEU', 'PSDM', 'PENKOM', 'RISTEK', 'INFOKOM')),
  jabatan text not null check (jabatan in ('PENGURUS_HARIAN', 'STAF_AHLI', 'STAF', 'ANGGOTA_MUDA')),
  role text not null default 'SENDER' check (role in ('SENDER', 'ADMIN', 'SUPER_ADMIN')),
  email text not null unique,
  avatar_url text,
  password_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id text primary key,
  case_id text not null unique,
  user_id text not null references public.users(id) on delete cascade,
  category text not null check (category in ('KONFLIK', 'BEBAN_KERJA', 'KESEJAHTERAAN', 'AKADEMIK', 'LAINNYA')),
  urgency text not null check (urgency in ('RENDAH', 'SEDANG', 'TINGGI')),
  kronologi text not null,
  attachment_url text,
  attachment_name text,
  attachment_path text,
  attachment_mime text,
  attachment_size bigint,
  status text not null default 'RECEIVED' check (status in ('RECEIVED', 'IN_PROGRESS', 'NEEDS_CLARIFICATION', 'DONE')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_status_history (
  id text primary key,
  report_id text not null references public.reports(id) on delete cascade,
  old_status text check (old_status in ('RECEIVED', 'IN_PROGRESS', 'NEEDS_CLARIFICATION', 'DONE')),
  new_status text not null check (new_status in ('RECEIVED', 'IN_PROGRESS', 'NEEDS_CLARIFICATION', 'DONE')),
  changed_by text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id text primary key,
  report_id text references public.reports(id) on delete set null,
  user_id text not null references public.users(id) on delete cascade,
  assigned_admin_id text references public.users(id) on delete set null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.chat_messages (
  id text primary key,
  session_id text not null references public.chat_sessions(id) on delete cascade,
  sender_id text not null references public.users(id) on delete cascade,
  content text not null default '',
  type text not null default 'TEXT' check (type in ('TEXT', 'IMAGE', 'FILE')),
  media_url text,
  media_name text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  id text unique,
  display_name text not null,
  jabatan_display text not null,
  availability_status text not null default 'OFFLINE' check (availability_status in ('ONLINE', 'AWAY', 'OFFLINE')),
  wa_number text,
  wa_number_encrypted text,
  avatar_url text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  target_admin_id text not null references public.users(id) on delete cascade,
  wa_redirect_logged_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  type text not null check (type in ('NEW_REPORT', 'STATUS_UPDATED', 'NEW_CHAT_SESSION', 'NEW_CHAT_MESSAGE', 'NEW_CHAT_REPLY', 'SESSION_CLOSED', 'APPOINTMENT_REQUEST', 'REPORT_DONE')),
  payload jsonb not null default '{}'::jsonb,
  title text,
  message text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated;

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_reports_user_id on public.reports(user_id);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_created_at on public.reports(created_at desc);
create index if not exists idx_report_status_history_report_id on public.report_status_history(report_id);
create index if not exists idx_chat_sessions_user_id on public.chat_sessions(user_id);
create index if not exists idx_chat_sessions_assigned_admin_id on public.chat_sessions(assigned_admin_id);
create index if not exists idx_chat_messages_session_id on public.chat_messages(session_id);
create index if not exists idx_chat_messages_created_at on public.chat_messages(created_at);
create index if not exists idx_appointments_user_id on public.appointments(user_id);
create index if not exists idx_appointments_target_admin_id on public.appointments(target_admin_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reports_touch_updated_at on public.reports;
create trigger trg_reports_touch_updated_at
before update on public.reports
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_admin_profiles_touch_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_touch_updated_at
before update on public.admin_profiles
for each row
execute function public.touch_updated_at();

alter table public.users enable row level security;
alter table public.reports enable row level security;
alter table public.report_status_history enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;

drop policy if exists users_open_access on public.users;
create policy users_open_access on public.users
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists reports_open_access on public.reports;
create policy reports_open_access on public.reports
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists report_status_history_open_access on public.report_status_history;
create policy report_status_history_open_access on public.report_status_history
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists chat_sessions_open_access on public.chat_sessions;
create policy chat_sessions_open_access on public.chat_sessions
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists chat_messages_open_access on public.chat_messages;
create policy chat_messages_open_access on public.chat_messages
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists admin_profiles_open_access on public.admin_profiles;
create policy admin_profiles_open_access on public.admin_profiles
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists appointments_open_access on public.appointments;
create policy appointments_open_access on public.appointments
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists notifications_open_access on public.notifications;
create policy notifications_open_access on public.notifications
for all
to anon, authenticated
using (true)
with check (true);

commit;
