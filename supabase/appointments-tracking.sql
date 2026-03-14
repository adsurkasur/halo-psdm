-- Appointment tracking upgrade
-- Adds full status lifecycle for PH follow-up: OPEN -> DONE / DISMISSED.

begin;

alter table public.appointments
  add column if not exists status text not null default 'OPEN';

alter table public.appointments
  add column if not exists status_note text;

alter table public.appointments
  add column if not exists handled_by text references public.users(id) on delete set null;

alter table public.appointments
  add column if not exists handled_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_status_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_status_check
      check (status in ('OPEN', 'DONE', 'DISMISSED'));
  end if;
end
$$;

update public.appointments
set status = 'OPEN'
where status is null;

drop policy if exists appointments_update_ph_only on public.appointments;
create policy appointments_update_ph_only on public.appointments
for update
to authenticated
using (public.current_app_role() in ('PH'))
with check (public.current_app_role() in ('PH'));

create index if not exists idx_appointments_status on public.appointments(status);

commit;
