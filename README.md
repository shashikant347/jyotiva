# Jyotiva

Jyotiva has a working public site, accounts, astrology tools, content, marketplace, wallet, chat and support/blog feature slices, plus an initial admin dashboard. See the phase notes below for what is implemented, verified and still outstanding.

## Run
```
npm run install:all   # installs root, backend and frontend dependencies
npm run dev           # backend on :4000 and frontend on :5173 (frontend proxies /api to the backend)
npm test              # backend auth tests (OTP limits, token rotation, reuse detection, deletion)
```
Or run each side alone: `npm run dev:backend` / `npm run dev:frontend`.

## Folders
```
jyotiva/
  frontend/   React 18 + Vite + TypeScript (the website)
  backend/    Node.js + Express + TypeScript (REST API, /api/v1)
```
Each folder has its own `package.json` and `node_modules`. Later: `admin/` (React) and `backend/src/jobs` for workers.
Open http://localhost:5173 and use **Sign in**. In development there is no SMS: the OTP is printed in the API
console and shown on the code screen ("Dev mode: your code is ..."). In production (`NODE_ENV=production`) the
API refuses to start without `JWT_SECRET` and `OTP_SECRET`, never exposes the code, and `send-otp` returns 503
until a real SMS provider is wired into `backend/src/sms.ts`.

Copy `backend/.env.example` to `backend/.env` to configure.

## What Phase 2 adds
**Backend** (`backend`, Express + TypeScript, `/api/v1`)
- `POST /auth/send-otp`, `/auth/verify-otp`, `/auth/refresh`, `/auth/logout`
- `GET/PATCH/DELETE /me`, `GET /me/export`, `GET/POST/PATCH/DELETE /me/birth-profiles`
- OTP: 6 digits, HMAC-hashed, 5 min expiry, 5 attempts, 30 s resend cooldown, 5 per hour per number
- JWT access token (15 min) + rotating refresh token (30 days, stored hashed); reuse of an old refresh token revokes the whole session family
- Rate limits per IP, request validation (zod) on every endpoint, helmet, CORS allow-list
- Account deletion erases birth data and sessions and frees the phone number; data export as JSON (DPDP)

**Frontend** (`frontend`)
- Login (mobile + OTP, explicit terms/privacy consent), protected routes (noindex), logout
- Profile settings: details, Light/Dark/Auto theme, English/Hindi, birth profiles (add, edit, delete, primary), data export, account deletion
- Account screens (UI only): Notifications, Wallet, Order History, Customer Support
- Header: account menu when signed in, language switch, theme toggle; preferences sync to the account

## Phase 3 (part 1): astrology engine, Free Kundli, Kundli Matching
**Engine** (`backend/src/astro`, pure functions with tests in `astro.test.ts`)
- Planet positions from `astronomy-engine` (MIT licence, so no AGPL question as with Swiss Ephemeris), converted to **sidereal Lahiri**. Rahu/Ketu use the **mean node**. Houses are **whole sign**. Ascendant from local sidereal time.
- Nakshatra and pada, retrograde flag, Vimshottari dasha (mahadasha and antardasha), Mangal dosha, Kaal Sarp, Sade Sati.
- Ashtakoota matching: Varna, Tara, Graha Maitri, Gana, Bhakoot, Nadi are scored. **Vashya (2) and Yoni (4) are deliberately NOT scored**: published tables disagree and no verified source was found, so totals are shown out of 30, not 36. Fill the two tables in `matching.ts` once an expert signs them off. Gana mixed cells also vary by tradition; one common table is used.
- Public API (rate limited, no login): `GET /api/v1/tools/places?q=`, `POST /api/v1/tools/kundli`, `POST /api/v1/tools/matching`. Time zone offset comes from the IANA zone, including historical DST.

**Frontend**: `/freekundli` (form, city type-ahead, North Indian SVG chart, planet table, doshas, dasha) and `/matchmaking`.

**What is verified**: ayanamsa values, Sun at Makar Sankranti / Mesha Sankranti 2026, a new moon conjunction, ascendant vs Sun at sunrise/sunset, dasha arithmetic, matching rules. **What is not**: no side-by-side check against a trusted program (e.g. Jagannatha Hora) or an expert's reference charts yet. Do that before launch.

**Known gaps**: city list is ~60 Indian cities (offline, `places.ts`); no server-generated PDF (the browser print dialog can save the current Kundli report as PDF); the new pages are English only; chart calculations still need comparison with trusted reference charts, and the chart layout needs browser review.

## Phase 3 (part 2): calculators
All 25 calculator routes are implemented via `POST /api/v1/tools/calc/:slug` (logic in `backend/src/astro/calculators.ts`): love, FLAMES, friendship, name compatibility, Pythagorean name numerology, Mulank, Destiny number, mobile and vehicle number, Lo Shu grid, age, Moon phase, lucky-name number, Sun sign, ascendant, Moon sign, Nakshatra, Vimshottari dasha, natal chart, transit chart, Atmakaraka/Darakaraka, Ishta Devata chart factors, Mangal dosha, Sade Sati and Kaal Sarp. Birth-based tools use the existing place autocomplete and clearly warn when birth time is unknown. Love, friendship and FLAMES are games and say so on the page. Lucky-name reports only the Pythagorean number and does not claim a name is lucky. Ishta Devata reports Karakamsha factors without guessing a deity because the mapping differs by tradition. Calculations are explicitly sidereal Lahiri; this does not replace an astrologer's interpretation.

## Phase 4 (part 1): Panchang
- Engine `backend/src/astro/panchang.ts` (tests in `panchang.test.ts`): sunrise, sunset, moonrise, moonset; tithi, nakshatra, yoga and karana at sunrise with exact end times (found by bisection to one second); weekday and lord; Rahu Kaal, Yamaganda, Gulika, Abhijit Muhurat; day Choghadiya; 24 Horas.
- API: `POST /api/v1/tools/panchang` with `date`, `latitude`, `longitude`, `timezone`. Cached in memory for 24 h per date and place (swap for Redis later).
- Pages: `/panchang/today-panchang`, `tomorrow-panchang`, `rahu-kaal`, `choghadiya`, `hora`, `tithi`, `vaar`, `karana`, `yoga`. All share one component with a date pager and city picker (default Delhi).
- Checked: Delhi sunrise and sunset against known values for 13 Nov and 21 Jun; tithi end time equals the astronomical full moon within 2 minutes; Purnima and Amavasya detection; karana sequence; weekday slot rules.
- Panchang now also shows Ritu/Ayana by the sidereal Sun sign, a sunrise planetary table and North Indian chart, plus Brahma Muhurat using the common fixed 48-minute window. Night Choghadiya uses a stated weekday convention. Lunar month and Samvat use an Amanta/Chaitradi convention, with optional Chandrabalam and Tarabalam counts. City landing URLs are available for top cities in the offline place list.
- **Phase 4 implementation is complete.** Final review should compare tithi/nakshatra/yoga times and the month assignment against a trusted regional almanac; real festival entries must be editor-verified before use.

## Phase 4 (part 2): horoscopes (admin CSV import)
You did not choose a content source, so this uses the safest option from the plan: an editor writes the text and imports it.
- **Data**: `horoscopes` table in the store (sign, period daily/weekly/monthly/yearly, category general/love/career/finance/health, language en/hi, date range, text, lucky number/colour, mood, four 1-5 scores, draft/published).
- **Admin**: set `ADMIN_PHONES=+91XXXXXXXXXX,...` (same format as stored phone numbers). Those numbers get the admin role at sign-in; numbers removed from the list lose it. Page: `/admin/horoscope` (upload or paste a CSV, "Check only", then Import). Import is all-or-nothing and reports row numbers. Sample: `docs/horoscope-sample.csv` (placeholder text, replace with original writing). API: `POST /api/v1/admin/horoscopes/import`, `POST /admin/horoscopes/publish`, `GET /admin/horoscopes`.
- **Public**: `GET /api/v1/horoscope/:period/:sign?date=&lang=&category=` and `GET /horoscope/:period?...` (all signs). Pages: daily, tomorrow, yesterday, weekly, monthly, yearly, yearly 2027, and the four daily love/career/finance/health pages, each with a sign picker at `/horoscope/<page>/<sign>`. Drafts are never visible.
- **No horoscope text is included.** Pages say "not published yet" until you import content. Do not copy text from other sites.
- Single-entry edit is now available in `/admin/horoscope`; scheduled entries publish automatically on `dateFrom` in India. Horoscope pages now request Hindi content when Hindi is selected, with an English fallback notice and sign/date-specific metadata. The home page already has a sign picker and now requests the selected language.
- Still pending: a content editor must create Hindi entries; sitemap/structured data are in later SEO work. No rule-based or AI horoscope text is generated, to avoid publishing unreviewed predictions.

## Phase 5 (part 1): astrologer marketplace (demo data)
Your plan's question "real marketplace or demo first?" is still open, so this ships with **demo astrologers**.
- **Demo data**: 6 fictional profiles named "Demo Astrologer A..F", flagged `isDemo`, labelled "Demo profile, not a real astrologer" on cards and profiles, with **no ratings, reviews or order counts** (nothing invented). Seeded on first start in development (`SEED_DEMO=false` to skip; never in production unless `SEED_DEMO=true`). Remove with the "Remove demo profiles" button on `/admin/astrologers` or `DELETE /api/v1/admin/astrologers/demo`.
- **Public API**: `GET /api/v1/astrologers` (filters: category, skill, language, gender, minExperience, maxPrice in paise, mode chat/call, online, q; sort: popular/rating/price/experience; paging), `GET /astrologers/:slug` (with similar), `GET /astrologers/:slug/reviews`, `GET /astrologers/categories`.
- **Apply and approve**: `POST /astrologers/apply` (signed in; one application per user; price limits 5 to 200 rupees per minute; rejected applicants can re-apply), `GET /astrologers/me/profile`, `PATCH /astrologers/me/status` (online/offline, approved only). Admin: `GET /admin/astrologers?status=`, `POST /admin/astrologers/:id/status` (approved/rejected/suspended; approval sets role `astrologer`, suspension restores `user` and forces offline).
- **Pages**: `/chat-with-astrologer`, `/talk-to-astrologer`, `/astrologer/:category`, `/best-astrologer/:slug`, `/astrologer-signup`, `/astrologer-panel`, `/admin/astrologers`.
- Chat is live from Phase 7; voice call buttons remain disabled until call integration is configured. Reviews require a completed session.
- Weekly availability can be managed in `/astrologer-panel` and displayed on public profiles with its IANA timezone. It is informational; astrologers still control online/offline status manually.
- Super admins can assign or clear the public `Featured` and `Rising Star` labels from `/admin/astrologers`; changes are audit logged. These are editorial labels, not performance or identity guarantees.
- Approved astrologers can update chat/call prices in `/astrologer-panel` (₹5–₹200 per minute). Existing session requests retain their price snapshot.
- Users can subscribe to an offline/busy astrologer's availability alert from the public profile and cancel it there. The watch is stored per user and astrologer; when the astrologer becomes available, the watch is consumed and a persistent in-app notification is created and sent over Socket.IO. The Notifications page lists alerts and marks them read. Notifications are retained for 90 days; each user may hold up to 25 active watches. This is in-app only; email/SMS/web push are not configured.
- **Presence uses authenticated Socket.IO connections:** public listings/profiles and new chat requests treat a real astrologer as online only while a socket is connected. With `REDIS_URL`, socket IDs are shared in Redis sorted sets and refreshed with a 60-second TTL; disconnect cleanup is atomic, so a crashed API process eventually expires from presence. Reconnecting an opted-in astrologer triggers pending availability alerts. Without `REDIS_URL`, local development falls back to in-process presence. Demo astrologers keep their seeded preview status. For multi-instance deployment, configure both Redis and the shared MongoDB store; the JSON file is single-instance only.
- **Astrologer photos:** approved astrologers can upload JPEG/PNG/WebP profile photos (5 MB maximum) in the astrologer panel. The API checks the file signature and serves the image from local disk; marketplace cards and public profiles show it, with the original illustrated portrait as a fallback. This local storage is not suitable for ephemeral/serverless or multi-instance production deployments; move it to object storage/CDN before launch. Identity documents are not accepted or stored. Earnings and payouts are implemented in Phase 9.
- **Verification:** backend TypeScript and frontend production builds pass after these Phase 5 changes. Tests and browser walkthrough remain deferred to the requested final verification pass.

## Phase 6: wallet and payments
- **Ledger** (`backend/src/wallet/service.ts`): balances and amounts are integer **paise**. Every change goes through one function that writes a transaction row with the balance after it, never allows a negative balance, and is **idempotent per business event** (a payment can credit only once, however many times confirm and webhook arrive). `debitWallet` is ready for Phase 7 sessions. With PostgreSQL later, wrap these in a transaction with a row lock on the wallet.
- **Recharge**: Rs 10 to Rs 50,000. `POST /api/v1/wallet/recharge` creates a gateway order and a `created` payment (no money credited). Credit happens only when payment is proven: browser `POST /wallet/recharge/confirm` (checks the Razorpay HMAC signature of `order_id|payment_id`) or the **webhook** `POST /api/v1/payments/webhook/razorpay` (checks the HMAC of the raw body, and refuses an amount that differs from the order). `payment.failed` marks failed and never credits.
- **Mock mode**: with no `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` the API uses a mock gateway so you can click through the flow ("Test mode" banner, no real money). In production with no keys, payments are disabled instead.
- **Coupons**: percent (with a cap) or flat bonus, minimum amount, validity window, total usage limit, one use per user. Bonus is credited only after payment. Admin: `POST /api/v1/admin/coupons`, `GET /admin/coupons`, `POST /admin/coupons/:code/active`. User: `POST /api/v1/coupons/apply` (preview).
- **Admin wallet adjustment/refund**: `POST /api/v1/admin/wallet/:userId/adjust` needs a written reason, cannot overdraw, and is written to `auditLogs`.
- **Wallet page** `/my-wallet`: balance, presets, custom amount, coupon check, Razorpay Checkout (loaded from checkout.razorpay.com; allow it in any CSP you add), transaction history. If the browser confirm fails after payment, the user is told the webhook will still credit it.
- **Account deletion** is blocked while the wallet has money (user must use it or ask support for a refund). Payment and ledger rows are kept for legal retention.
- **Set up for real payments**: create Razorpay keys, set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and register the webhook URL `https://<your-api>/api/v1/payments/webhook/razorpay` for `payment.captured`, `order.paid` and `payment.failed`.
- **Not verified**: the live Razorpay API call and Checkout were not run here (no keys or network access to Razorpay). Signature logic is unit tested with HMACs computed the documented way. Do a test-mode payment with your own keys before launch.
- **Not done**: GST invoices (tax treatment of wallet top-ups needs your accountant), receipts/PDF, refund-to-original-payment-method (admin credits the wallet only), payment reconciliation job for orders left in `created`, Hindi strings on the wallet page.

## Homepage v2 (landing page redesign)
`frontend/src/pages/Home.tsx` + `home.css`. Animated night-sky hero (zodiac wheel with orbiting planets, starfield, glass cards), stat strip, nakshatra marquee, **live Today's Panchang** (Delhi, from `/tools/panchang`), bento service grid, how-it-works, astrologers from the API, category chips, **real horoscope picker** (published entries only, otherwise "not published yet"), 12 calculators, Vedic glossary, trust promises, 6-question FAQ, final CTA. No invented stats, reviews or ratings. The old "out of 36" claim was corrected (matching is scored out of 30). English only for now.

## Phase 7 (part 1): live chat BACKEND (frontend not built yet)
Backend is done and tested (`npm test`: 78 pass, 12 new in `backend/src/sessions/sessions.test.ts`, including a real Socket.IO test).
- **Service** `backend/src/sessions/service.ts`: request, accept, reject, cancel, end; per-minute billing charged at the start of each minute (idempotent wallet debit per minute, so ticking twice never double-charges); balance ends the chat exactly at the end of the paid minute; request timeout 90 s; both sides offline 60 s ends the chat; restart recovery; free chat (5 min, once per number, kept after account deletion via a phone HMAC); commission split (`PLATFORM_COMMISSION_PERCENT`, default 30); reviews (once, after the chat, never for demo profiles); 1-2 stars flag a refund for admin review.
- **REST** `/api/v1/sessions`: `GET /status`, `GET /mine`, `GET /incoming` (astrologer), `POST /`, `GET /:id`, `GET /:id/messages`, `POST /:id/accept|reject|cancel|end|review`. Admin: `GET /admin/sessions?flagged=true`, `POST /admin/sessions/:id/refund`, `POST /admin/sessions/:id/refund-decline`.
- **Socket.IO** (`sessions/socket.ts`, JWT auth): `session:join`, `message:send`, `typing`, `message:read`, `session:end`; server sends `session:requested`, `session:update`, `message:new`, `balance:update`, `balance:low`. The astrologer never receives the user's phone number.
- **Demo bot** (development only, `DEMO_BOT=false` to turn off): demo astrologers auto-accept and reply with a message labelled "[Demo]". Never in production.
- **Decisions for you**: free-chat payout to astrologers is Rs 0 (`FREE_CHAT_PAYOUT_PAISE`); commission 30%.

## Phase 7 (part 2): live chat FRONTEND
- **Pages**: `/chat-with/:slug` (start a chat: pick or add birth details, free-chat checkbox, cost and balance check, request), `/chat/:id` (chat room, used by both sides; also shows an old chat read-only), `/free-astrology-chat` (online astrologers and how the free chat works).
- **Chat room**: live messages, typing indicator, "Seen", birth details card, timer, charged amount and next-minute countdown, wallet balance, low-balance banner (Add money opens in a new tab so the chat stays open), reconnect banner, End chat, waiting screen with 90 s countdown and Cancel, astrologer Accept/Decline, review form after the chat (1-2 stars say plainly that a team reviews it for a refund; demo profiles cannot be reviewed).
- **Chat buttons** on cards and profiles are now live for online astrologers ("Busy" / "Offline" otherwise). Call buttons still say "Call soon".
- **Astrologer panel**: live "Chat requests" (socket), accept or decline, open the live chat, recent chats with earnings. The page can now receive a browser push alert for a new chat request even when it is closed, after the astrologer enables push and the server has VAPID keys configured.
- **Order History > Chats**: your real chats with status, length, amount, refund state, View chat, Rate, Chat again.
- **Dev proxy**: `vite.config.ts` now forwards `/socket.io` with `ws: true`.
- **Socket auth**: `chat/socket.ts` reads the access token on every connect and, when the server answers UNAUTHORIZED, refreshes the token and reconnects.
- **Browser push**: `/my-notifications` has an opt-in/out control in English and Hindi. The service worker (`frontend/public/sw.js`) displays alerts and opens their in-app destination. The API stores up to 10 subscriptions per account, removes expired endpoints and deletes subscriptions on account deletion. New chat requests and availability alerts are sent. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in `backend/.env`; generate a persistent pair with `npx web-push generate-vapid-keys` from `backend`. Push stays disabled until all three values are present. Use HTTPS outside localhost; browsers require a secure context and an active service worker.
- **Verification status**: backend TypeScript and frontend production builds pass after the push changes. Tests and browser walkthrough remain deferred to the requested final verification pass. Actual push delivery needs VAPID keys, HTTPS and a browser subscription.
- **Hindi**: all chat screens (start chat, chat room, free chat, review box, astrologer requests, Order History > Chats, Chat/Busy/Offline buttons on cards) have English and Hindi strings (`chat.*`, `sc.*`, `fc.*`, `pr.*`, `oh.*`, `card.*` in `i18n/*.json`). The Hindi text was written by me and should be read by a native speaker before launch. Still English: error messages that come from the server, the astrologer profile page, and the page titles of the chat pages.
- **Kundli quick view**: the chat room has a collapsed "Kundli at a glance" (North Indian chart, Lagna, Moon sign, Nakshatra, planet table) for both sides. It is calculated only when opened, from the birth details of that chat, using the public `/tools/kundli` endpoint. It is not shown if the saved birth place has no coordinates.
- **New-request alert (astrologer)**: a short beep and the number of waiting requests in the browser tab title, plus optional Web Push when the astrologer has enabled it. The beep can stay silent until the astrologer has clicked on the page (browser rule).
- **Order History** no longer shows the "Preview screen" notice, because Chats are real now. Calls, Reports and Recharges tabs still point to later phases or the wallet.
- **Not done**: voice calls and a waiting queue. Chat report intake and support review are implemented below. In-app and configurable browser availability alerts are implemented.

## Deliberate shortcuts (replace in later phases)
- **Storage:** the API uses a JSON file (`backend/data/db.json`, git-ignored) behind `store.ts`, not PostgreSQL/Prisma. Shapes follow plan section 7. Local JSON mode keeps one last-good `.bak` snapshot and restores it if the primary file is missing or malformed. Both files contain plaintext phone numbers and birth data; they are permission-restricted, but use local JSON mode for development only.
- **Refresh token** is kept in `localStorage`. Before launch consider an httpOnly cookie plus CSRF protection.
- **Birth place** is free text; city search with coordinates and timezone arrives with Free Kundli (Phase 3).
- **Free chat:** the phone-HMAC tombstone keeps a used free chat ineligible after account deletion and re-registration.
- **Hindi** covers all new screens, the header and account menu. Homepage copy, nav item names, footer and server error messages are still English.
- Frontend dependencies stay minimal (React, React Router). Tailwind, TanStack Query, Zustand, React Hook Form and react-i18next from the plan are not added yet.

## Phase 1 leftovers (now done)
- Static pages: About, Terms, Privacy, Refund and cancellation, Disclaimer (`frontend/src/content/legal.ts`). This is DRAFT copy with `[bracketed]` placeholders (company name, address, grievance officer, jurisdiction, retention periods). Have a lawyer review it before launch.
- Real 404 page. Menu links to features built in later phases still show the "later phase" placeholder (list in `PLANNED_ROUTES`, `data.ts`); any other unknown URL is a 404. Both are `noindex`.
- Breadcrumbs on every page except home, login and logout.
- `usePageMeta` hook sets the page title, description and robots tag. Static pages are English only for now.

All astrologer, horoscope and review data on the homepage is SAMPLE data. Change the brand name in `frontend/src/data.ts` (`BRAND`) and the OTP SMS text in `backend/src/auth/service.ts`.

## Listing preview data
`npm run dev` now also adds 9 more fictional DEMO astrologers with sample ratings (`backend/src/astrologers/seedPreview.ts`, data in `previewData.ts`), so `/chat-with-astrologer` shows a full page. They are flagged Demo and removed with `DELETE /api/v1/admin/astrologers/demo`. Avatars are original illustrations made from the slug (`frontend/src/astrologers/portrait.ts`) until real photos are uploaded.

## MongoDB Atlas storage
Set `MONGODB_URI` (and optionally `MONGODB_DB`, default `jyotiva`) in `backend/.env`. On start the API connects, loads every model collection into memory, and saves changes back to MongoDB a fraction of a second after each change (only changed documents are written). Mongoose schemas live one per collection in `backend/src/models/*.schema.ts`; their model map is checked against the `DB` collection type so newly added collections cannot be silently left out. MongoDB is authoritative when configured; the local JSON file is not read unless Atlas is completely empty, in which case existing local records are imported. Production now requires `MONGODB_URI`; local JSON remains a development fallback.
- Run **one** backend instance only: data is cached in memory, so two instances would overwrite each other.
- `npm test` still uses the JSON file; `src/persist.test.ts` tests the MongoDB sync logic with a fake database.
- Not yet tested against a real Atlas cluster. Check it once on your machine (see the steps in the chat).

## Phase 8 (part 1): support tickets and blog
- **Support** (`backend/src/routes/support.ts`, page `/customer-support`): create a ticket (topic, subject, message), message thread, close. Statuses: open (waiting for us), pending (we replied), resolved. Max 5 unresolved tickets per user and 40 ticket messages per hour. Users only see their own tickets. Account deletion removes the user's tickets and messages. Admin: `/admin/support` (list by status, reply, mark resolved, reopen); every reply and status change goes to the audit log.
- Admin replies create a persistent notification for the ticket owner, delivered in-app and over Socket.IO; Web Push is also sent when the owner enabled it and VAPID is configured.
- **Blog** (`backend/src/routes/blog.ts`, pages `/astrology-blog` and `/astrology-blog/:slug`): category filter, pagination, related articles, SEO title and description, drafts hidden until published, the first publish date is kept when you edit. Admin: `/admin/blog` (create, edit, publish, delete) includes a formatting toolbar and preview for headings, bold, italic, bullet lists and quotes. The public renderer converts this safe subset to React elements and never interprets HTML. Three short original sample articles are added in development (`blog/seed.ts`); replace them with your own writing.
- Published article pages include Schema.org Article JSON-LD. Cover image uploads use JPEG/PNG/WebP signature validation (5 MB max) and local disk storage; move media to object storage/CDN before multi-instance or ephemeral hosting. Remaining: file attachments on tickets, Hindi text for these pages, and a public sitemap.
- Tests: `backend/src/support/support.test.ts` (written, not yet run on a real machine).

## Phase 9 (part 1): admin dashboard
- `/admin` is an admin-only overview with user, astrologer, chat, payment, support and published-content metrics, plus the latest five sessions and links to the existing admin tools.
- `GET /api/v1/admin/dashboard` reports counts from persisted application data. Deleted accounts and demo astrologers are excluded from real-user/astrologer totals; paid recharge amounts are shown separately from session platform fees.
- This was the first slice of Phase 9. User directory, audit-log and report features are documented in the following parts.

## Phase 9 (part 2): user directory
- `/admin/users` provides an admin-only, paginated directory searchable by name or phone, with role filtering and an opt-in deleted-account view.
- The API returns only directory fields, wallet balance and session count; birth details and email are not included. Pagination is capped at 100 users per request.
- Profile data in the directory is read-only. Super admins can assign admin scopes to existing admin accounts; bootstrap admin accounts by adding their phone to `ADMIN_PHONES`. Account status controls are covered in part 7.

## Phase 9 (part 3): audit logs
- `/admin/audit-logs` is a read-only, paginated view of admin actions with search and record-type filtering.
- `GET /api/v1/admin/audit-logs` is admin-only and returns actor name/ID, action, entity, record ID, metadata and timestamp. Search does not include phone numbers or metadata.
- Audit browsing is complete; see the payout and account status workflows below.

## Phase 9 (part 4): downloadable reports
- `/admin/reports` exports payment records or session billing summaries as CSV for a UTC date range.
- `GET /api/v1/admin/reports/export?type=payments|sessions&from=YYYY-MM-DD&to=YYYY-MM-DD` is admin-only, validates dates, limits ranges to 366 days and files to 50,000 rows, and escapes CSV fields (including spreadsheet formula-like values).
- Payment amounts and session charges are exported in integer paise.

## Phase 9 (part 5): admin roles and permissions
- Admin accounts can have one of four scopes: `super_admin`, `support`, `content` or `finance`. Existing admin accounts without a saved scope retain super-admin access; `ADMIN_PHONES` remains the bootstrap list.
- Support admins can manage support tickets; content admins can manage horoscopes and blog posts; finance admins can manage coupons, wallet adjustments, refunds and financial exports. Super admins retain full access, including user/admin-role management, audit logs and astrologer approvals.
- Super admins can change the scope of another active admin account from `/admin/users`. Self-demotion and demotion of the last super admin are blocked.

## Phase 9 (part 6): astrologer payouts
- Approved astrologers can view earnings and submit payout requests from `/astrologer-panel`. Requested and approved amounts are reserved from available earnings; rejected requests release the reserve.
- Finance admins can approve/reject requests and record a manual settlement reference at `/admin/payouts`. The app does not collect bank details or initiate transfers.
- Suspended or unapproved astrologers cannot request payouts.

## Phase 9 (part 7): user status controls
- Super admins can suspend/reactivate non-admin accounts from `/admin/users`. Suspension is blocked while a user or astrologer has an open chat, revokes refresh tokens, and forces astrologers offline.
- Suspended accounts are denied sign-in, API access and new Socket.IO connections. Reactivated users must sign in again.
- Every status change is written to the admin audit log.
- Admin accounts cannot be suspended through this control; remove their phone from `ADMIN_PHONES` to revoke the admin grant on their next sign-in.

## Phase 9 status
The Phase 9 deliverables in the plan are implemented: dashboard, user management, admin scopes, financial reports, audit-log browsing and payout review. Payout settlement remains a manual external transfer recorded by reference; the application does not move funds.

## Phase 10: performance and accessibility
- Page components are loaded with route-level dynamic imports and a polite loading state; calculator and Panchang slug routes retain their existing planned-page and not-found behavior.
- A keyboard-visible “Skip to main content” link moves focus to the main landmark.
- Client-side route changes announce the updated document title through a polite screen-reader status region.
- API startup validates numeric ranges, CORS origin syntax, production HTTPS origins, proxy hop count and complete optional payment/push credential sets; malformed supplied JWT/OTP secrets fail instead of silently falling back to development secrets.
- API responses include a generated `X-Request-ID`; unexpected server errors log the same ID and return it in the generic error payload for support diagnostics. The health endpoint is no-store and reports process uptime.
- SIGINT/SIGTERM stops background jobs and Socket.IO/HTTP intake, waits for connections to close, then flushes and closes Redis/MongoDB; shutdown exits nonzero if storage close fails or the 30-second deadline expires.
- Development-only local JSON persistence keeps one previous good snapshot, uses mode `0600` for data/backup files, and restores from the snapshot after a missing or malformed primary file. Production data uses MongoDB; configure Atlas automated backups and verify restores separately.
- The frontend production build completes with the route chunks split.

## Phase 3 status update (2026-11-16)
- The 13 remaining calculator pages are now connected to the API and the shared astrology engine. Birth-based tools reuse the Kundli birth form; transit charts accept a separate date.
- Added zodiac compatibility pages and server-drawn Tarot spreads (single, three-card, love, career and finance). The 78-card deck uses original short reflection prompts; these pages state that results are entertainment and not predictions.
- Kundli now returns D1 plus D2/D3/D7/D9/D10/D12/D16/D20/D24/D27/D30/D60 placements, with North and South Indian chart views. Signed-in users can save/reopen/delete Kundlis at `/freekundli/result/:id`; saved entries are included in data export and removed at account deletion. The result can be printed or saved as PDF through the browser print dialog.
- **Phase 3 implementation status: complete.** `npm run build` passed for backend and frontend, including Vite production bundling. Tests were deliberately skipped for the final test pass; no browser walkthrough was performed.
- **Release checks still pending:** compare chart calculations with trusted reference charts, have an astrologer review them, and resolve the unscored Vashya/Yoni tables before relying on matching scores. Current PDF output uses the browser print dialog.

## Phase 4 progress update (2026-11-16)
- Horoscope admin supports single-entry editing and scheduling. The API process publishes scheduled entries once their `dateFrom` arrives in India. Public horoscope pages request Hindi entries; editors must supply the Hindi writing.
- Panchang adds Ritu, Ayana, Brahma Muhurat, sunrise planetary positions/chart, an Amanta lunar month and a Chaitradi Vikram Samvat estimate. Month assignment uses the sidereal solar ingress within the new-moon lunation; Amanta/Purnimanta and regional new-year conventions differ. Optional Chandrabalam and Tarabalam use the visitor's selected natal Moon sign/nakshatra and show common relative-count categories. Festival calendar/detail pages and content-admin create/edit/publish/delete tools are available at `/festival` and `/admin/festivals`; real festival dates must be entered by editors from a verified regional almanac. Calendar background: [IMD Rashtriya Panchanga](https://packolkata.imd.gov.in/panchang/en/explanation) and [IGNCA, The Hindu Calendar](https://ignca.gov.in/Asi_data/34958.pdf).
- Day and night Choghadiya now show eight local sunrise/sunset-based periods. The night sequence uses a common weekday-specific table; regional conventions can vary. Reference: [Choghadiya weekday tables](https://mahadasha.com/panchang/choghadiya).
- `/shubh-muhurat` provides daylight screening intervals after excluding Rahu Kaal, Yamaganda and Gulika. The UI and API say this is not a complete ceremony-specific muhurta calculation.
- Verification: production build passed for backend and frontend. Tests and browser checks remain deferred to the requested final test pass.
- Development preview seeds (`SEED_DEMO`): 240 clearly labelled fictional horoscope samples cover every sign, period and category; three festival-card examples are prominently marked as fake placeholder dates. These are refreshed on local development startup and never seed automatically in production. Astrologers and blog already have separate labelled demo seeds.
- **Phase 4 implementation is complete.** Almanac comparison, deeper ceremony-specific muhurta rules, and editor-verified festival content are release/content tasks. The Panchang values use the conventions described above.
- **Phase 5 implementation is complete:** marketplace listing, profile, filters, reviews, registration/approval and astrologer panel are implemented. Presence supports Redis sharing when configured, with a local-development fallback. Photo upload currently uses local disk; object storage/CDN and identity-document review workflows remain production follow-ups.

## Phase 7 progress update (2026-11-16)
- Browser Web Push is implemented for new chat requests and availability alerts. Users opt in from `/my-notifications`; service-worker clicks open the relevant in-app route. VAPID keys are optional configuration, so delivery stays off until configured.
- Chat participants can report an active or completed real chat once, select a reason and explain the issue. Support admins review the report and the last 50 chat messages at `/admin/chat-reports`, then record an action or dismissal note; decisions are audit logged. Demo chats cannot be reported.
- Backend TypeScript and frontend production builds pass after the push and report changes. Tests and browser walkthrough remain deferred to the requested final verification pass; live push delivery needs VAPID configuration.
- Other Phase 7 deliverables, including chat reports, support review, push alerts and phone-HMAC protection for free-chat eligibility after account deletion, are implemented. **Voice calls and a waiting queue remain intentionally deferred** per user instruction.

## Phase 8 status (2026-11-16)
- Blog cover image upload/display is implemented, in addition to the editor formatting/preview, Article structured data and support-reply notifications.
- **Phase 8 is on hold** per user instruction. Ticket attachments, Hindi blog content and a public sitemap remain.

## Remaining roadmap work
- Phase 3: implementation complete; trusted reference-chart and astrologer review plus scoring-table review remain release checks.
- Phase 4 release/content: verified festival entries and comparison of computed times/month labels against a regional almanac. Shubh Muhurat is a preliminary exclusion-window tool, not a full ceremony-specific muhurta engine.
- Phase 5-6 deployment: onboard real astrologers, move local media to object storage, and configure real payment keys/reconciliation.
- Phase 7: only voice calls and a waiting queue remain; both are intentionally deferred.
- Phase 8 on hold: ticket attachments, Hindi content and a public sitemap remain. Blog cover images, formatting/preview, Article structured data and support reply notifications are implemented.
- Phase 9-10: production database/worker architecture, operational monitoring, legal review and complete launch hardening. The current JSON/MongoDB in-memory sync is a development shortcut, not multi-instance production storage.
