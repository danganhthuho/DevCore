-- Run once in Supabase → SQL Editor (after 20261121_display_name.sql).
-- Fresh databases: schema.sql already includes this.
--
-- Product history: one row per change (created, edited, quantity, sale,
-- waste, order). actor_name is copied in when the row is written, so
-- everyone can see who did it without reading other users' profiles.

begin;

create table if not exists public.product_activity (
  id         bigserial primary key,
  product_id int  not null references public.products (id) on delete cascade,
  user_id    uuid not null references public.profiles (id),
  actor_name varchar(100) not null,
  action     varchar(20)  not null,
  detail     varchar(300),
  created_at timestamptz  not null default now()
);

create index if not exists product_activity_product_idx
  on public.product_activity (product_id, created_at desc);

alter table public.product_activity enable row level security;

drop policy if exists "activity: read" on public.product_activity;
drop policy if exists "activity: add" on public.product_activity;
create policy "activity: read" on public.product_activity
  for select to authenticated using (true);
create policy "activity: add" on public.product_activity
  for insert to authenticated with check (user_id = auth.uid());

commit;
