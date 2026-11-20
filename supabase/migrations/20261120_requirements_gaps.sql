-- Run once in Supabase → SQL Editor on a database created from the
-- original schema.sql. (Fresh databases: just run schema.sql, which
-- already includes these changes.)
--
-- 1. Owner role (PRD 2.2 #3)
-- 2. Purchase orders follow TC-011: Staff create "Pending Approval",
--    Managers approve to "Submitted", supplier delivers.
-- 3. waste_records table (PRD 4.1 #10, Waste Tracking)

begin;

-- 1. Owner role ------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('Staff', 'Manager', 'Owner'));

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('Manager', 'Owner')
  );
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'Owner'
  );
$$;

drop policy if exists "profiles: owners change roles" on public.profiles;
create policy "profiles: owners change roles" on public.profiles
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- 2. Purchase orders (TC-011) ----------------------------------------------

alter table public.purchase_orders drop constraint if exists purchase_orders_status_check;
alter table public.purchase_orders alter column status type varchar(20);
update public.purchase_orders set status = 'Pending Approval' where status = 'Pending';
update public.purchase_orders set status = 'Submitted' where status in ('Approved', 'Sent');
alter table public.purchase_orders alter column status set default 'Pending Approval';
alter table public.purchase_orders add constraint purchase_orders_status_check
  check (status in ('Pending Approval', 'Submitted', 'Delivered', 'Cancelled'));

drop policy if exists "purchase orders: managers" on public.purchase_orders;
drop policy if exists "purchase orders: read" on public.purchase_orders;
drop policy if exists "purchase orders: create" on public.purchase_orders;
drop policy if exists "purchase orders: managers update" on public.purchase_orders;
create policy "purchase orders: read" on public.purchase_orders
  for select to authenticated using (true);
create policy "purchase orders: create" on public.purchase_orders
  for insert to authenticated
  with check (created_by = auth.uid() and status = 'Pending Approval');
create policy "purchase orders: managers update" on public.purchase_orders
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

-- 3. Waste tracking --------------------------------------------------------

create table if not exists public.waste_records (
  id          serial primary key,
  product_id  int  not null references public.products (id) on delete cascade,
  quantity    int  not null check (quantity > 0),
  reason      varchar(20) not null check (reason in ('Expired', 'Damaged', 'Spoiled', 'Other')),
  note        varchar(200),
  recorded_by uuid not null references public.profiles (id),
  recorded_at timestamptz not null default now()
);

alter table public.waste_records enable row level security;

drop policy if exists "waste: read" on public.waste_records;
drop policy if exists "waste: add" on public.waste_records;
create policy "waste: read" on public.waste_records
  for select to authenticated using (true);
create policy "waste: add" on public.waste_records
  for insert to authenticated with check (recorded_by = auth.uid());

commit;
