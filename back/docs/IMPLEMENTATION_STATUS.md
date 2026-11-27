# Implementation status

Updated: 2026-10-28

## Repository inspection (Phase 0)

- Workspace started with only an empty `back/` directory. No existing source, frontend, package manager lockfile, Git repository metadata, or `AGENTS.md` was present.
- Created this backend as a TypeScript/Express modular monolith under `back/`; npm is the package manager.
- MongoDB/Mongoose is the persistent data layer. Checkout and payment/order state changes use MongoDB transactions and therefore require a replica set deployment.
- API responses use `{ data }` or `{ error: { code, message } }`; API prefix is `/api/v1`; Zod handles input and environment validation.
- Security baseline: bcrypt hashes, short-lived JWT access tokens, opaque rotating refresh cookie, explicit CORS origins, Helmet, auth rate limiting, role checks, and ownership filters.
- Financial data is integer INR paise. Checkout snapshots product name and price. No commission, tax, discount, shipping fee, settlement, or ledger behavior is implemented in these phases.

## Phase completion

| Phase | State | Scope |
| --- | --- | --- |
| 0 — Inspection and architecture | Complete | Repository findings, boundaries, API conventions, and decisions documented. |
| 1 — Foundation and authentication | Implemented; local execution depends on MongoDB/env | Express/TypeScript, config validation, logger, database lifecycle, auth, roles, health/readiness, Swagger UI foundation, controlled admin bootstrap. |
| 2 — Vendors, stores, catalog, inventory | Implemented; requires API checks | Vendor onboarding/moderation, store management, product CRUD/moderation, categories, public search/filter/pagination, vendor ownership, stock validation. |
| 3 — Cart, checkout, orders, payment simulation | Implemented; requires replica-set MongoDB to execute | Cart, vendor-split parent order, server-side price calculation, transactional stock reservation/restore, idempotent checkout, simulated payment confirmation and cancellation transitions. |
| 4 — Ledger, commissions, refunds, payouts | Not started (out of scope for this request) | Do not start until requested. |
| 5 — Redis, RabbitMQ, service extraction | Not started | Requires explicit later approval. |
| 6 — Integration and release readiness | Not started | Requires explicit later approval. |

## Important decisions and constraints

- A single `User` identity has a role; vendor business data lives in `VendorProfile`. Public registration creates customers only; vendor signup creates a pending vendor profile. Admin role assignment is only through `npm run bootstrap:admin`, requiring configured credentials and refusing promotion of a non-admin user.
- A vendor must be approved and have an active store before creating products. Products begin pending; admins publish/reject them. Updates return products to pending moderation.
- Inventory is represented by the product's stock counter in these phases. Reservation uses `stock >= quantity` conditional atomic updates inside a transaction. The transaction boundary avoids overselling when deployed on a replica set.
- Checkout has no client-provided price, total, or vendor information. A unique `(customerId, idempotencyKey)` prevents duplicate parent orders.
- The refresh cookie is HttpOnly and SameSite configurable. For cross-site deployments, configure Secure cookies and add a CSRF token/origin check before going live.
- Payment success is a simulation; no card information or real transfer is involved. `/docs` describes the implemented API operations, key validation rules, and authorization requirements.

## Commands/checks

Commands run:

- `npm install` — installed dependencies; initial install reported a high-severity advisory for Zod 3.
- `npm install zod@^4.6.7` — upgraded to patched Zod 4.6.7; npm reported zero vulnerabilities.
- `npm run typecheck` — passed after implementation and after the Zod upgrade.
- `npm run build` — passed after implementation and after the Zod upgrade.
- `npm audit --audit-level=high` — passed; zero vulnerabilities.
- MongoDB availability check — no local `mongod` executable, MongoDB service, or `MONGODB_URI` was available. Database-backed endpoint execution and transaction verification could not be performed.

No automated test suite was added or run. To manually verify checkout and payment flows, configure the environment and start MongoDB as a replica set, run the server, then use `/docs` with customer/vendor/admin tokens. Checkout expects an `Idempotency-Key` header and an approved vendor's published product with sufficient stock.
