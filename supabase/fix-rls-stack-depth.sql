-- Hotfix: prevent recursive RLS calls causing `stack depth limit exceeded`
-- Run this in Supabase SQL Editor for already-deployed environments.

begin;

create or replace function public.current_app_role()
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select role
  from public.users
  where id = auth.uid()::text
  limit 1;
$$;

commit;
