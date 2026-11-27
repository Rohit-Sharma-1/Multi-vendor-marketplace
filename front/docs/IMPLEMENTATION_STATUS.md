# Frontend implementation status

Updated: 2026-10-28

## Repository inspection

- `front/` existed but was empty. Backend is a strict TypeScript Express/Mongoose app in `../back`; frontend dependencies are isolated to this folder with npm.
- The backend CORS default permits `http://localhost:3000`; Vite is configured to bind port 3000 and proxy `/api/v1` to port 4000.
- The user requested a role-specific UI securely integrated with this backend. Real backend auth takes precedence over the source brief's localStorage demo-role mechanism.

## Frontend structure and phase status

| Phase | State | Work |
| --- | --- | --- |
| 0 — Inspect and plan | Complete | Inspected the empty frontend folder and backend route/data contracts. |
| 1 — App foundation and identity | Complete | Vite, React, TypeScript, Tailwind, router, theme, API client, auth provider, customer and vendor signup, login, refresh/logout, role guards. |
| 2 — Marketplace and role workspaces | Complete | Customer catalog/product/store/cart/account UI; vendor profile/store/catalog workspace; admin vendor/product/category moderation. |
| 3 — Checkout and order flow | Complete | Customer checkout, idempotent API checkout, payment simulation confirmation/detail, order list/detail and cancellation. |
| 4 — Backend expansion / broader marketplace features | Not started | No fake API workflows for features absent from the current backend. |

## Security and integration decisions

- Access tokens remain in memory rather than localStorage. The refresh token is only handled by backend `HttpOnly` cookie rotation.
- Frontend role guards provide navigation/UX only. The backend remains the authorization boundary, and each protected route calls its corresponding role-protected API.
- Vendor product setup checks `/vendors/me` and only opens the product editor when the vendor is approved and the product API confirms an active store. Vendor approval is rechecked every seven seconds and displayed with a direct setup link.
- Product categories load independently from vendor products, so a missing store or product-list error cannot hide categories. The category list refreshes when the product manager opens.
- Vite's same-origin dev proxy keeps the cookie usable and avoids loosening backend CORS.
- The admin role is not selectable or assignable in the app. Create the initial admin only through the backend bootstrap script.
- Theme preference is saved locally. Cart and marketplace data are server-backed.
- Checkout runs a simulated payment and asks for no card details. Address inputs are marked demo-only because the backend does not accept or store shipping fields.

## Known backend limits reflected in UI

- The backend lacks password-reset and email-verification endpoints, vendor order queues, customer administration, analytics/revenue, commission, earnings, and payout APIs.
- Product API records do not expose a store slug; product detail cannot resolve a public seller store link from the current product response.
- No image upload or image URL field exists in the backend; cards use product-name-based curated image URLs.

## Verification

Commands/checks actually run:

- `npm install` — dependencies installed; initial install reported two moderate React Router advisories.
- `npm install react-router-dom@^7.18.5` — upgraded Router and npm reported zero vulnerabilities.
- `npm run typecheck` — passed after implementation and after the Router upgrade.
- `npm run build` — passed; Vite split React, icons and charts into separate chunks. Rollup emits harmless annotation-position warnings from Zod source.
- `npm audit --audit-level=moderate` — passed with zero vulnerabilities after the Router upgrade.
- `npm run dev` — Vite served the app at `http://localhost:3000`; an HTTP request returned status 200 and the app shell/title. The API proxy returned HTTP 500 because the backend/MongoDB service was not running.
- No lint script is configured. In-app browser automation wasn't available in this environment, so visual inspection was limited to the running frontend HTTP smoke check and production build.

MongoDB-backed user journeys could not run without the backend connected to a replica set. No real account was created and no payment was made during frontend work.
