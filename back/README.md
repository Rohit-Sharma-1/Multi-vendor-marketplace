# MVM backend

Backend for a multi-vendor marketplace. Implemented scope: foundation/authentication, vendor onboarding/store/catalog/inventory, cart, checkout, orders, and simulated payments (Phases 0–3).

## Run locally

Requirements: Node.js 20+, npm, and MongoDB configured as a replica set. Transactions are required for inventory reservation, checkout, cancellation, and payment confirmation. A local single-node replica set is sufficient; standalone MongoDB is not.

1. Copy `.env.example` to `.env` and set a unique `JWT_ACCESS_SECRET` (at least 32 characters), MongoDB URI, and frontend origin allowlist.
2. Install dependencies with `npm install`.
3. Start the API with `npm run dev`.

The API listens on port 4000 by default. Health endpoints: `GET /health` and database readiness `GET /ready`. API documentation UI: `/docs`.

Create the first administrator explicitly with `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` (at least 16 characters) in the process environment, then run `npm run bootstrap:admin`. The script refuses to promote an existing non-admin account and has no default credentials. Do not reuse development credentials in production.

## API conventions

Routes use `/api/v1`. Successful JSON responses use `{ "data": ... }`; errors use `{ "error": { "code", "message" } }`. Lists include `pagination`. Money is integer paise; product prices come from MongoDB during checkout. Authenticated API requests use `Authorization: Bearer <access-token>`. Login returns a short-lived access token and sets a rotating opaque refresh token in an HttpOnly cookie.

Refresh cookies use `SameSite=Lax` by default and can be restricted to HTTPS with `COOKIE_SECURE=true`. Keep the frontend and API on same-site origins where possible; configure a narrow `CLIENT_ORIGINS` allowlist. For cross-site deployment, use `SameSite=None; Secure` and add a CSRF token/origin check before deployment. Never store payment card details; payment confirmation is simulated.

## Implemented API surface

| Area | Routes | Access |
| --- | --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` | Public/session or bearer as appropriate; login/refresh rate limited |
| Vendor | `POST /vendors/register`; `GET/PATCH /vendors/me`; `PUT /vendors/me/store` | Vendor; newly registered profiles remain pending |
| Catalog | `GET /products`, `/products/:productId`, `/categories`, `/stores/:storeSlug` | Public; only published products |
| Vendor products | `GET/POST /vendors/me/products`, `PATCH/DELETE /vendors/me/products/:productId` | Approved vendor, own products only; changes enter moderation |
| Admin onboarding/catalog | `GET /admin/vendors`, `PATCH /admin/vendors/:vendorId/status`; `POST /admin/categories`, `GET /admin/products`, `PATCH /admin/products/:productId/moderation` | Admin only |
| Cart | `GET/PUT /cart` | Customer only |
| Orders | `POST /orders/checkout`, `GET /orders`, `GET /orders/:orderId`, `POST /orders/:orderId/cancel` | Customer only; checkout requires `Idempotency-Key` |
| Payments | `POST /payments/:paymentId/confirm`, `GET /payments/:paymentId` | Owning customer; simulated provider |

Validation uses Zod. Prices and totals are integer paise. Checkout snapshots product name and price, splits sub-orders by vendor, reserves stock in a MongoDB transaction, creates a pending payment, and clears the cart. The client cannot send prices or status. Retrying a checkout with the same customer and idempotency key returns the original order/payment. Cancellation is allowed only before payment; it restores reserved quantities transactionally. Payment confirmation is idempotent for an already-succeeded payment.

## Current limits

Vendor/store and catalog APIs are present; no delivery, tax, discounts, or shipping calculation is modeled, so shipping is explicitly zero. Product inventory is held as a nonnegative stock count on each product and reservation uses conditional updates. Payment success is simulated. Phases 4–6 (ledger, commission accounting, refunds, payouts, Redis/RabbitMQ, deployment and comprehensive tests) are not implemented.
