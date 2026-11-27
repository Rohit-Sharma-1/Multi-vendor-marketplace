# Marketday frontend

React + Vite + TypeScript marketplace UI in `front/`. The frontend uses the real Phase 1–3 backend API; it does not include demo-role login or treat a client-side role as authorization.

## Start locally

1. Start MongoDB as a replica set and run the backend in `../back` (`npm.cmd install`, configure `back/.env`, then `npm.cmd run dev` in Windows PowerShell). Checkout requires replica-set transactions.
2. In this folder, run `npm.cmd install` and `npm.cmd run dev` in Windows PowerShell (use `npm` in shells where the npm script is enabled).
3. Open `http://localhost:3000`.

Vite proxies `/api/v1` to `http://localhost:4000` so the browser can use the backend's HttpOnly refresh cookie without a separate frontend origin. The backend's default CORS allowlist already includes `http://localhost:3000`. To use another API URL, set `VITE_API_BASE` in a local `.env` (copy `.env.example`).

Create customer accounts at `/signup`, apply as a seller at `/signup/vendor`, then sign in at `/login`. Seller accounts start pending and need an admin to approve them. There are no seeded demo credentials. Bootstrap the first admin through the backend's configured `npm run bootstrap:admin` script; do not create an admin role in the frontend.

## Authentication and data

The access JWT stays in memory and is sent as a Bearer token. The backend sets and rotates the HttpOnly refresh cookie; the frontend requests it with `credentials: include`, restores sessions through `/auth/refresh` and `/auth/me`, and clears the user view when refresh fails. The theme choice is the only persisted frontend preference. Role routes improve navigation but backend middleware remains the actual authorization boundary.

The cart, catalog, checkout, orders, vendor management, and admin moderation use the backend endpoints. Checkout submits product IDs and quantities with a unique idempotency key; the server recalculates totals, reserves stock, and creates the simulated payment. The UI collects delivery fields for form-flow demonstration only: the current backend does not accept or store them. Do not enter real address or phone data. No card details are requested.

## API coverage and current limits

- Customer: registration, login/refresh/logout/me, public catalog/categories/stores, cart, checkout, order listing/detail/cancellation, payment confirmation/detail.
- Vendor: registration, own profile, store upsert, own product list/create/update/unpublish.
- Admin: vendor directory/status changes, product moderation, category creation.
- The backend does not currently expose password recovery, email verification, vendor order queues, customer directories, analytics, commissions, earnings, or payout APIs. The corresponding UI is not presented as live backend functionality.
- Product API responses do not include a store slug, so product detail pages cannot link from a product to its public seller page. Store pages work when opened with a known slug.
- Product imagery uses curated Unsplash URLs based on product name; the backend currently has no image field or upload service.

## Checks

Run `npm run typecheck` and `npm run build` from this folder. The application expects the backend and a MongoDB replica set for live marketplace actions.
