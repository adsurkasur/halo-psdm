-- Promote one account to HR or PH.
-- Usage:
-- 1) Replace target_email and target_role values.
-- 2) Run in Supabase SQL editor.

begin;

with target_user as (
  select id, name, jabatan
  from public.users
  where lower(email) = lower('replace-with-user-email@example.com')
  limit 1
),
target_role as (
  select 'HR'::text as role
),
updated_user as (
  update public.users u
  set role = tr.role
  from target_user t
  cross join target_role tr
  where u.id = t.id
  returning u.id, u.name, u.jabatan, u.role
)
insert into public.admin_profiles (
  user_id,
  id,
  display_name,
  jabatan_display,
  availability_status,
  wa_number,
  avatar_url,
  updated_at
)
select
  uu.id,
  uu.id,
  uu.name,
  uu.jabatan,
  'OFFLINE',
  '',
  '',
  now()
from updated_user uu
where uu.role = 'HR'
on conflict (user_id) do update
set
  id = excluded.id,
  display_name = excluded.display_name,
  jabatan_display = excluded.jabatan_display,
  updated_at = now();

delete from public.admin_profiles ap
using updated_user uu
where ap.user_id = uu.id
  and uu.role <> 'HR';

commit;

