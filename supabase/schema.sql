-- AI Inventory Tracker schema (SFDS 7.1.2).
-- Change from the SFDS: Supabase Auth stores passwords in auth.users, so the
-- SFDS `users` table becomes `profiles` (username + role, no password_hash).

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   varchar(100) not null unique,
  role       varchar(10)  not null default 'Staff' check (role in ('Staff', 'Manager')),
  created_at timestamptz  not null default now()
);

create table public.suppliers (
  id            serial primary key,
  name          varchar(100) not null,
  contact_email varchar(100),
  phone         varchar(30)
);

create table public.products (
  id               serial primary key,
  name             varchar(100)  not null check (length(trim(name)) > 0),
  category         varchar(50),
  quantity         int           not null default 0 check (quantity >= 0),
  minimum_quantity int           not null default 0 check (minimum_quantity >= 0),
  price            numeric(10,2) not null check (price >= 0),
  expiration_date  date,
  barcode          varchar(50) unique,
  location         varchar(50),
  supplier_id      int references public.suppliers (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.sales_records (
  id            serial primary key,
  product_id    int  not null references public.products (id) on delete cascade,
  quantity_sold int  not null check (quantity_sold > 0),
  sale_date     date not null
);

create table public.demand_forecasts (
  id               serial primary key,
  product_id       int  not null references public.products (id) on delete cascade,
  forecast_date    date not null,
  predicted_demand int  not null check (predicted_demand >= 0),
  generated_at     timestamptz not null default now()
);

create table public.alerts (
  id         serial primary key,
  product_id int not null references public.products (id) on delete cascade,
  type       varchar(20) not null check (type in
               ('LOW_STOCK', 'EXPIRING', 'EXPIRED', 'REORDER', 'ORDER_STATUS')),
  message    text    not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.purchase_orders (
  id          serial primary key,
  product_id  int  not null references public.products (id) on delete restrict,
  supplier_id int  not null references public.suppliers (id),
  created_by  uuid not null references public.profiles (id),
  quantity    int  not null check (quantity > 0),
  status      varchar(12) not null default 'Pending' check (status in
                ('Pending', 'Approved', 'Sent', 'Delivered', 'Cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Every new auth user gets a Staff profile. Promote managers by hand:
--   update public.profiles set role = 'Manager' where username = 'manager@example.com';
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'Manager'
  );
$$;

-- Row Level Security: nothing is readable without a logged-in user.
alter table public.profiles         enable row level security;
alter table public.suppliers        enable row level security;
alter table public.products         enable row level security;
alter table public.sales_records    enable row level security;
alter table public.demand_forecasts enable row level security;
alter table public.alerts           enable row level security;
alter table public.purchase_orders  enable row level security;

create policy "profiles: read own, managers read all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_manager());

create policy "suppliers: read" on public.suppliers
  for select to authenticated using (true);
create policy "suppliers: managers write" on public.suppliers
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "products: read" on public.products
  for select to authenticated using (true);
create policy "products: add" on public.products
  for insert to authenticated with check (true);
create policy "products: edit" on public.products
  for update to authenticated using (true) with check (true);
create policy "products: managers delete" on public.products
  for delete to authenticated using (public.is_manager());

create policy "sales: read" on public.sales_records
  for select to authenticated using (true);
create policy "sales: add" on public.sales_records
  for insert to authenticated with check (true);

-- Forecasts and alerts are written by Dev B's modules while any user is logged in.
create policy "forecasts: all" on public.demand_forecasts
  for all to authenticated using (true) with check (true);
create policy "alerts: all" on public.alerts
  for all to authenticated using (true) with check (true);

-- Manager-only per the SFDS. TC-011 lets Staff create orders: open question.
create policy "purchase orders: managers" on public.purchase_orders
  for all to authenticated using (public.is_manager()) with check (public.is_manager());
