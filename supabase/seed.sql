-- Test data for QA (Test Plan: "standard test dataset with 100+ products,
-- including edge cases such as zero quantity, expired items and invalid
-- barcodes", plus sales history for forecasting).
--
-- Run ONCE in Supabase → SQL Editor, after schema.sql (and the migration).
-- Dates are relative to today, so expiring/expired items stay realistic.
-- Running it twice fails on the unique barcodes and changes nothing.
--
-- What you get:
--   5 suppliers
--   120 products (24 items × 5 pack sizes) across all 8 categories, with
--     - ~7 at quantity 0, ~6 exactly at their minimum (TC-005 edge case),
--     - expired and almost-expired perishables (TC-004),
--     - barcodes 200000000001 … 200000000120 (try 999999999999 for "not found")
--   ~7,000 sales records over the last 90 days (TC-006 / TC-007),
--     except every 25th product, which only has 4 days of sales so the
--     "not enough sales history" message can be tested.

begin;

insert into public.suppliers (name, contact_email, phone) values
  ('Bay Area Dairy Co.',      'orders@bayareadairy.example',   '(408) 555-0101'),
  ('Golden State Produce',    'sales@gsproduce.example',       '(408) 555-0102'),
  ('Sunrise Bakery Supply',   'orders@sunrisebakery.example',  '(408) 555-0103'),
  ('Pacific Wholesale Foods', 'orders@pacificwholesale.example', '(408) 555-0104'),
  ('Coastal Meats & Frozen',  'orders@coastalmeats.example',   '(408) 555-0105');

with base(n, name, category, price, shelf_days, supplier) as (
  values
    ( 1, 'Whole Milk',        'Dairy',     3.49,  10, 'Bay Area Dairy Co.'),
    ( 2, 'Greek Yogurt',      'Dairy',     1.29,  21, 'Bay Area Dairy Co.'),
    ( 3, 'Cheddar Cheese',    'Dairy',     5.99,  45, 'Bay Area Dairy Co.'),
    ( 4, 'Butter',            'Dairy',     4.79,  60, 'Bay Area Dairy Co.'),
    ( 5, 'Bananas',           'Produce',   0.69,   6, 'Golden State Produce'),
    ( 6, 'Fuji Apples',       'Produce',   1.49,  25, 'Golden State Produce'),
    ( 7, 'Baby Spinach',      'Produce',   3.99,   7, 'Golden State Produce'),
    ( 8, 'Roma Tomatoes',     'Produce',   1.99,   9, 'Golden State Produce'),
    ( 9, 'Sourdough Bread',   'Bakery',    4.49,   5, 'Sunrise Bakery Supply'),
    (10, 'Bagels',            'Bakery',    3.29,   7, 'Sunrise Bakery Supply'),
    (11, 'Croissants',        'Bakery',    5.49,   4, 'Sunrise Bakery Supply'),
    (12, 'Jasmine Rice',      'Grocery',  12.50, null, 'Pacific Wholesale Foods'),
    (13, 'Spaghetti',         'Grocery',   1.89, null, 'Pacific Wholesale Foods'),
    (14, 'Black Beans',       'Grocery',   1.19, null, 'Pacific Wholesale Foods'),
    (15, 'Olive Oil',         'Grocery',   9.99, null, 'Pacific Wholesale Foods'),
    (16, 'Orange Juice',      'Beverage',  4.29,  14, 'Golden State Produce'),
    (17, 'Sparkling Water',   'Beverage',  0.99, null, 'Pacific Wholesale Foods'),
    (18, 'Cold Brew Coffee',  'Beverage',  3.99,  30, 'Pacific Wholesale Foods'),
    (19, 'Chicken Breast',    'Meat',      8.99,   4, 'Coastal Meats & Frozen'),
    (20, 'Ground Beef',       'Meat',      6.49,   3, 'Coastal Meats & Frozen'),
    (21, 'Salmon Fillet',     'Meat',     11.99,   3, 'Coastal Meats & Frozen'),
    (22, 'Frozen Peas',       'Frozen',    2.29, 180, 'Coastal Meats & Frozen'),
    (23, 'Vanilla Ice Cream', 'Frozen',    5.49, 120, 'Coastal Meats & Frozen'),
    (24, 'Paper Towels',      'Other',     7.99, null, 'Pacific Wholesale Foods')
),
sizes(s, label, factor) as (
  values (1, 'Small', 0.8), (2, 'Regular', 1.0), (3, 'Large', 1.6), (4, 'Family', 2.4), (5, 'Bulk', 4.0)
),
items as (
  select
    (b.n - 1) * 5 + z.s as k,  -- 1..120, fixed order
    b.*, z.label, z.factor
  from base b cross join sizes z
)
insert into public.products
  (name, category, quantity, minimum_quantity, price, expiration_date, barcode, location, supplier_id)
select
  i.name || ' (' || i.label || ')',
  i.category,
  case
    when i.k % 17 = 0 then 0                          -- out of stock
    when i.k % 19 = 0 then 8 + (i.k * 7) % 15         -- exactly at minimum
    else (i.k * 37) % 90                              -- spread, some below minimum
  end,
  8 + (i.k * 7) % 15,
  round((i.price * i.factor)::numeric, 2),
  case
    when i.shelf_days is null then null
    -- mostly fresh, but some already expired and some within 7 days
    else current_date + (((i.k * 13) % (i.shelf_days + 12)) - 4)
  end,
  '2' || lpad(i.k::text, 11, '0'),
  'Aisle ' || (1 + i.k % 8) || ', Shelf ' || chr(65 + i.k % 4),
  (select id from public.suppliers s where s.name = i.supplier)
from items i
order by i.k;

-- 90 days of sales. Busier items sell more; about two days in three have sales.
insert into public.sales_records (product_id, quantity_sold, sale_date)
select
  p.id,
  1 + (p.id * 7 + d * 3) % (2 + p.id % 9),
  current_date - d
from public.products p
cross join generate_series(0, 89) as d
where p.barcode like '2%'
  and (p.id + d) % 3 <> 0
  and (p.id % 25 <> 0 or d < 4);  -- every 25th product: too little history

commit;
