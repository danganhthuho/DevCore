<p align="center"><img src="public/brand/devcore-logo.png" alt="DevCore" width="320"></p>

# DevCore – AI Inventory Tracker

Team project for CMPE 131 (Section 05).

A web app for tracking store inventory: staff can log in, add and edit products, scan barcodes, and update stock levels. Managers can also delete products and export inventory reports. Products are automatically flagged as **In stock**, **Low stock**, or **Expired**.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router, JavaScript) with React 19
- [Supabase](https://supabase.com/) for the Postgres database, authentication, and row-level security
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) for the camera barcode scanner
- [Vitest](https://vitest.dev/) for unit tests

## Getting started

### 1. Prerequisites

- Node.js 20 or newer
- Access to the team's Supabase project (ask the PM to invite you)

### 2. Install

```bash
git clone https://github.com/danganhthuho/DevCore.git
cd DevCore
npm install
```

### 3. Configure environment variables

Copy the example file and fill in the values from **Supabase → Project Settings → API**:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional
NEXT_PUBLIC_TIME_ZONE=America/Los_Angeles      # the store's time zone, for expiration dates
NEXT_PUBLIC_EXPIRATION_WARNING_DAYS=7          # days before expiry that count as "Almost Expired"
```

`.env.local` is git-ignored. Never commit it.

### 4. Set up the database (first time only)

1. In Supabase, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
   - **Database created before Nov 20, 2026?** Run the files in [`supabase/migrations/`](supabase/migrations/) instead, oldest first: `20261120_requirements_gaps.sql` (Owner role, waste tracking, TC-011 purchase-order statuses), then `20261121_display_name.sql` (nicknames), then `20261122_product_activity.sql` (product history), then `20261123_settings.sql` (store settings).
2. *(Optional, for QA)* Run [`supabase/seed.sql`](supabase/seed.sql) once: 5 suppliers, 120 products with edge cases (out of stock, at minimum, expired, expiring soon) and 90 days of sales history.
3. Under **Authentication → Users**, add a user with an email and password, and tick **Auto Confirm User**. A `profiles` row with the role `Staff` is created automatically.
4. Make the first Owner in the SQL Editor. After that, the Owner sets everyone else's role on the **Team** page:
   ```sql
   update public.profiles set role = 'Owner' where username = 'owner@example.com';
   ```
5. Two-step verification uses Supabase's TOTP MFA, which is on by default. Check **Authentication → Multi-Factor** if setup fails.

### 5. Run

```bash
npm run dev     # start the dev server at http://localhost:3000
npm test        # run unit tests
npm run build   # production build
```

## Features

Roles go Staff → Manager → Owner; each role can do everything the one before it can.

| Feature | Lowest role |
| --- | --- |
| Log in / log out, automatic logout after 30 minutes of inactivity | Staff |
| Profile menu (bottom of the sidebar) → Settings: nickname, two-step verification, Light / Dark / System theme | Staff |
| Collapse the sidebar to icons (button at its top, or ⌘\\) | Staff |
| Bulk actions on Inventory: set category, record expired stock as waste | Staff |
| Bulk delete products | Manager |
| Settings → Store: name, time zone, expiry-warning days, currency | Manager |

| Dashboard: stock, low-stock, expiring and open-order counts, alerts feed | Staff |
| Search inventory by name, category, status, supplier and expiration date (remembered between visits) | Staff |
| Add / edit products, scan barcodes, + / − stock buttons on the Inventory list | Staff |
| **⌘K / Ctrl+K** quick search for products, barcodes, pages and actions | Staff |
| USB / Bluetooth barcode scanners work on any page (scan → product opens, or "add new") | Staff |
| Import products from CSV with a preview (matching barcodes update existing products) | Staff |
| Per-product sales chart (13 weeks + forecast) and history (who changed what) | Staff |
| Record sales (feeds forecasting) and waste (expired / damaged items) | Staff |
| Alerts: low stock, expiring, expired, reorder, order status; unread count in the sidebar; mark all as read | Staff |
| Demand forecasts and reorder recommendations | Staff |
| Request a purchase order (starts as *Pending Approval*), or all recommended ones at once | Staff |
| Approve (→ *Submitted*) or cancel purchase orders; mock supplier delivery (adds the units to stock) | Manager |
| Delete products (with a few seconds to undo); manage suppliers | Manager |
| Inventory report with waste summary, CSV export | Manager |
| Settings → Team: change team members' roles | Owner |

Roles are enforced twice: in the API routes (`requireRole`) and in the database through Supabase row-level security policies.

Important events (logins, product and stock changes, order status, role changes, database errors) are logged as JSON lines to the server console; on Vercel see **Project → Logs**.

## Project structure

```
app/
  api/                 REST endpoints (see API below)
  dashboard/           Home screen
  inventory/           Inventory list with search and filters
  products/            Add / Edit product (+ record sale / waste)
  alerts/              Alerts, forecasts and reorder suggestions
  orders/              Purchase orders
  suppliers/           Supplier management (Manager)
  reports/             Inventory and waste report (Manager)
  settings/            Profile, Security, Appearance, Store (Manager), Team (Owner) tabs
  account/, team/      Redirect to the matching Settings tab
  login/               Sign in (+ MFA code step)
components/            AppShell, NavBar, Feedback (toasts/dialogs), ProductForm, StockActions, BarcodeScanner, Icons
lib/
  auth/                login, session + role checks, roles, MFA
  products/            validation, product service, sales/waste (stock.js)
  inventory/           stock status badge
  alerts/              alert rules and syncing
  forecast/, reorder/  demand forecast and reorder quantity
  orders/              purchase-order flow
  suppliers/, users/   supplier and team services
  reports/             report builder, waste summary, CSV export
  log.js               event logging
  events.js            onProductChanged hook (keeps alerts in sync)
middleware.js          session refresh, inactivity timeout, MFA gate, login redirect
supabase/
  schema.sql           tables, triggers and RLS policies
  migrations/          changes for existing databases
  seed.sql             QA test data
tests/                 unit tests (UT-01 – UT-13 and more)
```

## API

All endpoints require a logged-in session. Expired or missing sessions return `401`.

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Log in with `{ email, password }` |
| POST | `/api/auth/logout` | Log out |
| GET, PUT | `/api/settings` | Store settings / change them (Manager) |
| POST | `/api/products/bulk` | `{ action: 'category' \| 'waste-expired' \| 'delete', ids, category? }` |
| GET | `/api/dashboard/runway` | Days of stock left per product, grouped (dashboard) |
| GET, PATCH | `/api/auth/me` | Current user, nickname and role / change nickname with `{ display_name }` |
| GET, DELETE | `/api/auth/mfa` | MFA status / turn MFA off with `{ factorId }` |
| POST | `/api/auth/mfa/enroll` | Start MFA setup (returns a QR code) |
| POST | `/api/auth/mfa/verify` | Check a 6-digit code `{ factorId, code }` |
| GET | `/api/products?search=&category=&status=&supplier=&expires_by=` | List and search products |
| POST | `/api/products` | Create a product |
| GET | `/api/products/:id` | Get one product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product (Manager only) |
| PATCH | `/api/products/:id/quantity` | Set stock `{ quantity }` or add/remove `{ change: 1 }` |
| GET | `/api/products/barcode/:code` | Look up a product by barcode |
| GET, POST | `/api/products/:id/sales` | Daily sales for the last 90 days / record a sale `{ quantity, sale_date? }` |
| GET | `/api/products/:id/activity` | Product history, newest first |
| GET, POST | `/api/products/import` | CSV template / import `{ records, dryRun }` (preview when `dryRun` is true) |
| POST | `/api/products/:id/waste` | Record waste `{ quantity, reason, note? }` |
| GET | `/api/reports/inventory?format=csv` | Inventory report with 30-day waste summary, as JSON or CSV (Manager) |
| GET, POST | `/api/suppliers` | List suppliers / add one (Manager) |
| PUT, DELETE | `/api/suppliers/:id` | Edit / delete a supplier (Manager) |
| GET | `/api/alerts?unread=&type=&product_id=` | List alerts (also refreshes expiration and reorder alerts) |
| GET | `/api/alerts/count` | `{ unread }` for the sidebar badge |
| POST | `/api/alerts/read-all` | Mark every alert as read |
| PATCH | `/api/alerts/:id` or `/api/alerts/:id/read` | Mark an alert read |
| GET, POST | `/api/forecasts/:productId` | Latest forecast, or generate a new one |
| GET | `/api/reorder` or `/api/reorder/recommendations` | Reorder recommendations (`?all=true` for every product) |
| GET, POST | `/api/purchase-orders` | List orders / request one (starts as Pending Approval) |
| POST | `/api/purchase-orders/bulk` | Request several orders `{ items: [...] }` |
| PATCH | `/api/purchase-orders/:id` or `/:id/status` | Approve (`Submitted`) or cancel with `{ status }` (Manager) |
| POST | `/api/purchase-orders/:id/supplier` | Mock supplier: Submitted → Delivered, adds the units to stock (Manager) |
| GET | `/api/users` | Team members and roles (Owner) |
| PATCH | `/api/users/:id` | Change a role with `{ role }` (Owner) |

Validation errors return `400`. A duplicate barcode, or deleting a product that has purchase orders, returns `409`.

## Deploying to Vercel

`.env.local` is not in git, so Vercel needs the same values:

1. **Vercel → Project → Settings → Environment Variables:** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and `NEXT_PUBLIC_TIME_ZONE` if the store isn't on Pacific time) for Production, Preview and Development.
2. **Redeploy:** Deployments → ⋯ → Redeploy. `NEXT_PUBLIC_` values are built into the app, so old deployments don't pick them up.
3. **Supabase → Authentication → URL Configuration:** set Site URL to the Vercel domain.

Without the Supabase variables every page fails with `500: MIDDLEWARE_INVOCATION_FAILED`.

## Testing

```bash
npm test
```

Unit tests use a fake Supabase client (`tests/helpers/fakeSupabase.js`), so they don't need a database or `.env.local`.

| ID | Covers |
| --- | --- |
| UT-01 | Correct email and password logs in |
| UT-02 | Wrong credentials or empty fields are rejected |
| UT-03 | Valid product is created |
| UT-04 | Product with an empty name is rejected |
| UT-05 | Updated quantity is saved |
| UT-06 | Negative quantity is rejected |
| UT-07 | Product is deleted; a product with purchase orders can't be |

There are also tests for stock status and the inventory report/CSV export.

## Contributing

1. Branch off `main`: `git checkout -b feature/short-name` or `fix/issue-12-short-name`
2. Commit small, focused changes.
3. Run `npm test` and `npm run build` before pushing.
4. Open a pull request into `main`. Write `Fixes #12` in the description to close the linked issue.

## Team

DevCore – CMPE 131, Section 05. 

- Project manager: Dang Anh Thu Ho.
- Dev A: Thomas Johnson
