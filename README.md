# Jyotiva

Phase 0-1 (foundation + public site shell), **Phase 2 (auth and account)** and the first part of **Phase 3 (astrology engine, Free Kundli, Kundli Matching)**.

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

**Known gaps**: city list is ~60 Indian cities (offline, `places.ts`); no PDF report; no divisional charts (Navamsa etc.); South Indian chart style; the new pages are English only; the chart layout has not been checked in a real browser.

## Phase 3 (part 2): calculators
12 calculators at their menu URLs, via `POST /api/v1/tools/calc/:slug` (logic in `backend/src/astro/calculators.ts`, tested): love, FLAMES, friendship, name compatibility, name numerology (Pythagorean), Mulank, Destiny number, mobile number, vehicle number, Lo Shu grid, age, Moon phase with tithi. Love, friendship and FLAMES are games and say so on the page. The other 13 menu calculators (e.g. Sun sign, Rashi, Nakshatra, Dasha, Mangal dosha, Sade Sati, lucky name) still show the "later phase" placeholder; most can reuse the kundli engine. Lucky-name numerology is skipped until a standard number-friendship table is chosen.

## Deliberate shortcuts (replace in later phases)
- **Storage:** the API uses a JSON file (`backend/data/db.json`, git-ignored) behind `store.ts`, not PostgreSQL/Prisma. Shapes follow plan section 7. Phone numbers and birth data are plaintext in that file, so use it for development only.
- **Refresh token** is kept in `localStorage`. Before launch consider an httpOnly cookie plus CSRF protection.
- **Birth place** is free text; city search with coordinates and timezone arrives with Free Kundli (Phase 3).
- **Free chat:** deleting an account then re-registering would grant a second free chat. Fix with a phone-hash tombstone in Phase 7.
- **Hindi** covers all new screens, the header and account menu. Homepage copy, nav item names, footer and server error messages are still English.
- Frontend dependencies stay minimal (React, React Router). Tailwind, TanStack Query, Zustand, React Hook Form and react-i18next from the plan are not added yet.

## Phase 1 leftovers (now done)
- Static pages: About, Terms, Privacy, Refund and cancellation, Disclaimer (`frontend/src/content/legal.ts`). This is DRAFT copy with `[bracketed]` placeholders (company name, address, grievance officer, jurisdiction, retention periods). Have a lawyer review it before launch.
- Real 404 page. Menu links to features built in later phases still show the "later phase" placeholder (list in `PLANNED_ROUTES`, `data.ts`); any other unknown URL is a 404. Both are `noindex`.
- Breadcrumbs on every page except home, login and logout.
- `usePageMeta` hook sets the page title, description and robots tag. Static pages are English only for now.

All astrologer, horoscope and review data on the homepage is SAMPLE data. Change the brand name in `frontend/src/data.ts` (`BRAND`) and the OTP SMS text in `backend/src/auth/service.ts`.
