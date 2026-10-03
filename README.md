# GetPatang

Pakistan-focused kite marketplace, tournament and community platform.

| Folder     | What it is                                                 | Stack                                         |
|------------|------------------------------------------------------------|-----------------------------------------------|
| `backend/` | REST API for every client                                  | NestJS 12, Prisma 6, SQLite (dev) / PostgreSQL |
| `web/`     | Customer website + seller dashboard (`/seller`) + admin dashboard (`/admin`) | Next.js 16, React 19, Tailwind CSS 4 |
| `mobile/`  | Android and iOS app                                        | Flutter 3.44, Riverpod 3, go_router, Dio       |
| `docs/`    | Design tokens and project docs                             |                                               |

## Run it locally

Prerequisites: Node.js 24+, Flutter 3.44+.

```bash
# 1. API — http://localhost:4000/api/v1, docs at http://localhost:4000/api/docs
cd backend
npm install
cp .env.example .env            # then replace both secrets (command is in the file)
npx prisma migrate dev          # creates prisma/dev.db
npm run db:seed                 # roles, permissions, categories and the first Super Admin
npm run db:seed:demo            # optional: demo shops, products and coupon DEMO10 (refuses to run in production)
npm run start:dev

# 2. Website — http://localhost:3000
cd web
npm install
cp .env.example .env.local
npm run dev

# 3. Mobile (USB phone or emulator). In VS Code just press F5 ("GetPatang app (local API)").
cd mobile
flutter pub get
powershell -File tool/connect-devices.ps1   # phone's 127.0.0.1:4000 -> this computer (adb reverse)
flutter run
```

The app talks to `http://127.0.0.1:4000/api/v1` in development. `adb reverse` makes that address reach the API on this
computer over USB, for real phones and emulators alike. Run `connect-devices.ps1` again after reconnecting the phone;
without it every screen keeps loading and then shows "Could not reach the server".

In development, verification and password-reset codes are **printed in the API terminal**
(`[DEV ONLY — not sent] VERIFY_ACCOUNT code for …`). The API refuses to start with this
setting in production; a real email/SMS provider is added in the notifications phase.

The seeded Super Admin is `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `backend/.env`.
Change that password before sharing any environment.

Demo data (`npm run db:seed:demo` in `backend`) exists only so the marketplace can be explored before sellers can list products (Phase 3).
Every demo shop says "Demo shop for development" in its description. Demo sellers sign in with
`<shop-slug>@demo.kiteplatform.local` / `DemoSeller123`.

## Tests and checks

```bash
cd backend && npm run lint && npm test && npm run test:e2e   # unit + end-to-end tests
cd web && npm run lint && npm test && npm run build
cd mobile && flutter analyze && flutter test
```

- **Backend end-to-end tests** run the real API against throwaway SQLite files. `test/global-setup.ts` migrates and
  seeds a template database once per run and each test file copies it, so the whole suite runs in parallel in about
  1.5 minutes. Coverage: `npx vitest run --config vitest.config.e2e.ts --coverage` (about 85% of lines).
- **Route security sweep** (`test/security.e2e-spec.ts`) calls every registered route: without a token everything must
  answer 401 except a short reviewed list of public routes; a member without staff roles must get 403 on every
  `/admin` route and every seller tool. A new public or leaky endpoint fails the build until it is deliberate.
- **Unit tests** cover the pure rules: banned-material matching, order status transitions, upload type detection,
  settings validation, email escaping, bracket seeding and ranking points (backend); kite geometry, the open-redirect
  guard, page rendering and the kite preview (web); API model parsing, validators, kite painter and notification links
  (mobile). The kite geometry is asserted with the same numbers on web and mobile so both draw identical designs.
- **CI** (`.github/workflows/ci.yml`) runs all of the above on every push and pull request.
- `THROTTLE_DISABLED=true` switches off rate limiting for the route sweep only; the API refuses to start with it in
  production.

## Architecture notes

- **API contract.** Success is `{ data }` (lists add `meta` with page info). Errors are
  `{ error: { code, message, details? } }`. `message` is always safe to show users; clients branch on `code`.
- **Auth.** Short-lived JWT access token (15 min) + opaque refresh token (30 days), stored hashed and
  rotated on every use. Replaying an old refresh token signs that login out everywhere.
  The website keeps both tokens in httpOnly cookies and never exposes them to browser JavaScript; the app
  uses the device keystore.
- **Authorization.** Endpoints require permissions (`users.read`, `tournaments.manage`, …), not role names.
  Roles map to permissions in the database, so they can be reconfigured without code changes.
  The backend checks every request; web and app checks only decide what to show.
- **Mock services.** Only one exists: the console OTP channel in `backend/src/modules/auth/otp/otp-channel.ts`.
  No payments, orders, results or rankings are faked anywhere.
- **Payments.** Methods live behind `PaymentProvider` (`backend/src/modules/payments/payment-providers.ts`).
  Cash on delivery is on by default; bank transfer switches on once an admin stores real account details
  (setting `payments.bank_transfer`). Every payment starts as PENDING until confirmed. Online gateways plug in as new providers.
- **Orders.** Checkout creates one order per shop. Totals are always computed on the server. Stock is reserved
  with conditional updates inside one transaction, and a client-generated `checkoutId` makes "Place order" safe to retry.
  Allowed status changes are in `backend/src/modules/orders/order-status.ts`.
- **Uploads.** Files go to object storage behind `StorageService` (local disk in development, `backend/uploads/`).
  The real file type is detected from its bytes, not its name. Product photos and logos are public; seller documents
  (CNIC) are private and only reachable through `GET /api/v1/uploads/:id/file` by the owner or staff with
  `sellers.review`. The website forwards uploads through `/api/uploads` so the access token never reaches browser JavaScript.
- **Seller onboarding.** Apply → Waiting for review → Under review → Approved (gets the Seller role) or Changes needed
  (seller fixes and resubmits). Approved shops can be suspended, which hides their products immediately.
- **Product safety.** Listings that mention banned materials (setting `products.banned_keywords`, e.g. manjha,
  glass-coated or metal string) are rejected. With `products.require_approval` on, new products and changes to a live
  product's title, description, photos or category wait for a moderator; price and stock changes go live at once.
- **Earnings** are computed from delivered orders minus `marketplace.commission_percent` (0% until the business sets it).
  Payouts are not automated yet.
- **Tournaments.** Only legally permitted events go public: publishing requires a local-authority permit reference,
  safety rules and approved materials (checked against the banned-materials list). Registration checks the age limit
  (date of birth), requires accepting the rules, fills spots then a waiting list (promoted automatically on withdrawals);
  paid entries stay "pending" until the organizer confirms the fee was received.
- **Brackets and matches.** Single elimination with standard seeding; byes go to the top seeds (`tournaments/bracket.ts`,
  unit-tested). Only the assigned match official or a tournament manager can start a match or record the official
  result; every result and correction is kept in `match_results`. A player can dispute their match until the next
  round starts (24 hours for the final); a manager upholds or overturns it.
- **Rankings** are the sum of `ranking_points` rows written when a tournament completes. The formula is the setting
  `rankings.points`; `POST /admin/rankings/recalculate` reapplies it. Byes and walkovers never count as wins.
- **Community.** Posts with up to 4 photos or one video (video type detected from its bytes; 8 MB photos, 50 MB videos),
  likes, one level of comment replies, shares, follows and blocks. Blocking hides both people's content from each
  other and removes follows. Posts and comments are checked against the banned-materials list.
- **Reports and moderation.** Anything (post, comment, user, product, shop, match, order) can be reported once per person.
  Posts and comments with `community.auto_hide_reports` (default 5) open reports from different people are hidden until a
  moderator decides. Moderators dismiss, hide, remove or restore from `/admin/community`; every decision closes the
  reports and is audited. Other report types link to their admin tool (user, shop, product, order, match); suspending a
  user closes their user reports. Reporters are told when their report was reviewed.
- **Admin access.** The admin menu shows only sections the person's permissions allow (`/auth/me` returns them); every
  API call is checked again. Suspending or banning someone revokes all their sessions at once. Only a Super Admin can
  change admin accounts or grant admin roles; nobody can change their own status or roles. Seller and Customer roles come
  from shop approval and sign-up, not the roles editor.
- **Settings** at `/admin/settings` are validated per setting and audited. The core safety words in
  `products.banned_keywords` cannot be removed, only added to.
- **Content pages** (`/about`, `/faq`, `/contact`, `/terms`, `/privacy`) are written in Admin → Content as plain text
  (blank line = paragraph, `## ` = heading, `- ` = list item) and show "coming soon" until published. The legal text
  itself must come from the business and its lawyer.
- **Events.** Festivals, exhibitions, workshops and gatherings are created as drafts by staff with `events.manage` and
  published once final. Name, description and rules are checked against the banned-materials list; safety notes are
  required on every event. Capacity counts guests; when full, people join a waiting list that moves up on cancellations.
  Fees are paid to the organizer, not through the platform.
- **Custom kites.** A design is plain data (shape, size, colours, pattern, text, optional logo upload) drawn identically by
  `web/src/components/designer/kite-preview.tsx` and `mobile/lib/features/designer/kite_design.dart`. A request copies
  the design, so later edits don't change what the shop saw. Shops (opt out in Shop settings) ask questions, quote a total
  price with a validity period, or decline. Accepting an unexpired quote creates a normal order (quote + delivery fee,
  same payment methods) that follows the usual order flow.
- **Notifications.** Every service calls `NotificationsService.send()` after its own work is saved; delivery problems are
  logged and never fail the request. In-app rows are always written (unless the person turned a category off); email goes
  through SMTP when `MAIL_TRANSPORT=smtp` (with `console` — development only — emails are only logged). Push is not sent
  yet: devices can register (`POST /devices`), and sending starts once a Firebase project is configured. Links are web
  paths; the app maps them to screens (`appRouteFor` in `mobile/lib/features/notifications`).
- **Payments.** Cash on delivery is marked paid when the shop marks the order delivered. Bank transfers stay unpaid until
  the customer sends the transaction reference (and an optional private receipt) and payments staff verify it at
  `/admin/payments`; shops cannot start preparing a bank-transfer order before that. Cancelling or returning an order
  closes unpaid payments and turns money already received into a pending refund, which staff complete with the refund
  reference. No online gateway is connected yet; card/wallet providers plug into `payments/payment-providers.ts` once
  merchant accounts exist.
- **Delivery fees and other settings** have defaults in `backend/src/modules/settings/settings.service.ts`;
  rows in the `settings` table override them without a deploy.
- **Database.** Development and tests use SQLite; production uses PostgreSQL. The PostgreSQL schema and migrations in
  `backend/prisma/postgres/` are generated from `schema.prisma` with `npm run db:pg -- <name>`; CI checks they match.
- **Production** runs with Docker Compose behind Caddy (automatic HTTPS). The API refuses to start in production
  without real email (SMTP) and with any development-only setting. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Roadmap

Development follows the phase order in the product spec:

1. **Foundation** — done: project setup, design system, auth, roles and permissions, navigation, API structure
2. **Marketplace** — done: shops, categories, products, search, filters, wishlist, follow, reviews, cart, checkout, orders
3. **Seller platform** — done: registration and approval, document uploads, products with options and photos, moderation, inventory, order fulfilment, dashboard and analytics, earnings, customers, reviews, shop customization
4. **Tournament system** — done: tournaments with compliance gate, registration and waiting list, brackets, match officials, results, disputes, rankings, player profiles and badges
5. **Community** — done: feed, photo and video posts, likes, comments and replies, shares, follows, blocks, reports, auto-hide and moderation queue
6. **Events and custom kites** — done: events with registration, guests, capacity and waiting list; admin event management; kite designer (web SVG + mobile painter, same geometry); saved designs; quote requests with shop conversation, clarify/quote/reject; accepting a quote creates a normal order
7. **Notifications and payments** — done: in-app inbox with unread badge, per-category in-app/email settings, SMTP email delivery, device-token registration (push sending waits for a Firebase project); bank-transfer proof, staff verification, refunds on cancelled/returned paid orders, admin payments page
8. **Admin and moderation** — done: dashboard work queues, user management (suspend/ban/restore with sign-out, roles with Super Admin protection), all-orders view with staff cancellation, analytics, validated platform settings, content pages (About/FAQ/Terms/Privacy/Contact), audit log viewer, permission-filtered admin menu, report links to the right admin tool
9. **Testing** — done: faster parallel e2e (template database), route security sweep, unit tests for safety and payment rules, web tests (Vitest + Testing Library), mobile model tests, GitHub Actions CI
10. **Deployment** — done: PostgreSQL production schema and migrations, Docker images for API and web, Compose stack with HTTPS (Caddy), backups, Android release signing, CI container smoke test. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
