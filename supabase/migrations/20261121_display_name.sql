-- Run once in Supabase → SQL Editor (after 20261120_requirements_gaps.sql).
-- Fresh databases: schema.sql already includes this.
--
-- Adds a nickname (display_name) shown instead of the login email.
-- Users change it through set_my_display_name(), which can only touch
-- their own display_name, never their role.

begin;

alter table public.profiles add column if not exists display_name varchar(40);

create or replace function public.set_my_display_name(new_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set display_name = nullif(trim(new_name), '')
  where id = auth.uid();
end;
$$;

revoke all on function public.set_my_display_name(text) from public;
grant execute on function public.set_my_display_name(text) to authenticated;

commit;
