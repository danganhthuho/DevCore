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
```

`.env.local` is git-ignored. Never commit it.

### 4. Set up the database (first time only)

1. In Supabase, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
2. Under **Authentication → Users**, add a user with an email and password. A `profiles` row with the role `Staff` is created automatically.
3. To make a user a Manager, run this in the SQL Editor:
   ```sql
   update public.profiles set role = 'Manager' where username = 'manager@example.com';
   ```

### 5. Run

```bash
npm run dev     # start the dev server at http://localhost:3000
npm test        # run unit tests
npm run build   # production build
```

## Features

| Feature | Who can use it |
| --- | --- |
| Log in / log out (email + password) | Everyone |
| Automatic logout after 30 minutes of inactivity | Everyone |
| View and search inventory, filtered by category and status | Staff, Manager |
| Add / edit products, update quantity | Staff, Manager |
| Barcode lookup by camera or manual entry (unknown barcode → "add new product" with the barcode filled in) | Staff, Manager |
| Delete products | Manager |
| Inventory report and CSV export | Manager |

Roles are enforced twice: in the API routes (`requireRole`) and in the database through Supabase row-level security policies.

## Project structure

```
app/
  api/
    auth/            login, logout, me
    products/        CRUD, quantity update, barcode lookup
    reports/         inventory report (JSON or CSV)
  login/             Login page
  inventory/         Inventory list page
  products/          Add / Edit product pages
  reports/           Reports page
components/          BarcodeScanner, ProductForm
lib/
  auth/              login logic, session + role checks
  products/          validation, database service, categories
  inventory/         stock status (In stock / Low stock / Expired)
  reports/           report builder and CSV export
  supabase/          server-side Supabase client
  events.js          onProductChanged hook (used for alerts/forecasting)
middleware.js        session refresh, inactivity timeout, login redirect
supabase/schema.sql  tables, triggers, and RLS policies
tests/               unit tests (UT-01 – UT-07)
ProjectDocumentation/
```

## API

All endpoints require a logged-in session. Expired or missing sessions return `401`.

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Log in with `{ email, password }` |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Current user and role |
| GET | `/api/products?q=&category=&status=` | List and search products |
| POST | `/api/products` | Create a product |
| GET | `/api/products/:id` | Get one product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product (Manager only) |
| PATCH | `/api/products/:id/quantity` | Update stock quantity |
| GET | `/api/products/barcode/:code` | Look up a product by barcode |
| GET | `/api/reports/inventory?format=csv` | Inventory report, as JSON or CSV (Manager only) |

Validation errors return `400`. A duplicate barcode, or deleting a product that has purchase orders, returns `409`.

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

DevCore – CMPE 131, Section 05. Project manager: Dang Anh Thu Ho.
