-- Promote one account to HR or PH.
--
-- EXPLANATORY GUIDE
-- 1) Edit the two values in input_params CTE:
--    - target_email: email user yang ingin dipromosikan.
--    - target_role : pilih 'HR' atau 'PH'.
-- 2) Jalankan script ini di Supabase SQL Editor.
-- 3) Script akan otomatis:
--    - validasi role hanya HR/PH,
--    - update role user,
--    - sinkronkan admin_profiles untuk role HR/PH,
--    - hapus admin_profiles jika role bukan HR/PH (guard tambahan).
-- 4) Cek hasil pada bagian "Verification Queries" di bawah.
--
-- NOTE:
-- - Admin directory dipakai untuk Janji Temu. Sesuai requirement terbaru,
--   role HR dan PH sama-sama boleh muncul di directory.
-- - wa_number diambil dari users.phone_number. Disarankan sudah format 62xxxxxxxxxx.

begin;

with input_params as (
  select
    'replace-with-user-email@example.com'::text as target_email,
    'HR'::text as target_role
),
validated_params as (
  select
    lower(trim(target_email)) as target_email,
    upper(trim(target_role)) as target_role
  from input_params
  where upper(trim(target_role)) in ('HR', 'PH')
),
target_user as (
  select u.id, u.name, u.jabatan, u.phone_number, vp.target_role
  from public.users u
  join validated_params vp
    on lower(u.email) = vp.target_email
  limit 1
),
updated_user as (
  update public.users u
  set role = tu.target_role
  from target_user tu
  where u.id = tu.id
  returning u.id, u.name, u.jabatan, u.phone_number, u.role
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
  case uu.jabatan
    when 'PENGURUS_HARIAN' then 'Pengurus Harian'
    when 'STAF_AHLI' then 'Staf Ahli'
    when 'STAF' then 'Staf'
    when 'ANGGOTA_MUDA' then 'Anggota Muda'
    else uu.jabatan
  end,
  coalesce(ap.availability_status, 'OFFLINE'),
  coalesce(nullif(uu.phone_number, ''), ''),
  coalesce(ap.avatar_url, ''),
  now()
from updated_user uu
left join public.admin_profiles ap
  on ap.user_id = uu.id
where uu.role in ('HR', 'PH')
on conflict (user_id) do update
set
  id = excluded.id,
  display_name = excluded.display_name,
  jabatan_display = excluded.jabatan_display,
  wa_number = excluded.wa_number,
  avatar_url = excluded.avatar_url,
  updated_at = now();

delete from public.admin_profiles ap
using updated_user uu
where ap.user_id = uu.id
  and uu.role not in ('HR', 'PH');

commit;

-- Verification Queries
-- 1) Pastikan role user sudah berubah:
-- select id, name, email, role from public.users
-- where lower(email) = lower('replace-with-user-email@example.com');
--
-- 2) Pastikan user tercatat di directory janji temu (HR/PH):
-- select ap.user_id, ap.display_name, ap.jabatan_display, ap.wa_number,
--        u.role, u.email
-- from public.admin_profiles ap
-- join public.users u on u.id = ap.user_id
-- where lower(u.email) = lower('replace-with-user-email@example.com');

