-- Migrate legacy role values to the new model:
-- ADMIN -> HR
-- SUPER_ADMIN -> PH

begin;

update public.users
set role = 'HR'
where role = 'ADMIN';

update public.users
set role = 'PH'
where role = 'SUPER_ADMIN';

alter table public.users
drop constraint if exists users_role_check;

alter table public.users
add constraint users_role_check
check (role in ('SENDER', 'HR', 'PH'));

-- Directory table should only contain HR and PH recipients.
delete from public.admin_profiles ap
using public.users u
where ap.user_id = u.id
  and u.role not in ('HR', 'PH');

commit;
