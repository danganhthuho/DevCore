-- Run once in Supabase → SQL Editor (after 20261122_product_activity.sql).
-- Fresh databases: schema.sql already includes this.
--
-- Store-wide settings (one row): store name, time zone, how many days
-- before expiration count as "Almost Expired", and currency.
-- Everyone can read them; only Managers/Owners can change them.

begin;

create table if not exists public.app_settings (
  id                      smallint primary key default 1 check (id = 1),
  store_name              varchar(60) not null default 'My Store',
  time_zone               varchar(64) not null default 'America/Los_Angeles',
  expiration_warning_days int         not null default 7 check (expiration_warning_days between 1 and 60),
  currency                char(3)     not null default 'USD',
  updated_at              timestamptz not null default now(),
  updated_by              uuid references public.profiles (id)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "settings: read" on public.app_settings;
drop policy if exists "settings: managers update" on public.app_settings;
create policy "settings: read" on public.app_settings
  for select to authenticated using (true);
create policy "settings: managers update" on public.app_settings
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

commit;
