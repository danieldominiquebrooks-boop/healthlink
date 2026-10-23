# My Healthcare Link (Horizon Health) — PRD

## Original Problem Statement
Responsive Caribbean healthcare directory web app for phone/tablet/desktop. Provider & services directory with search/filtering, provider profiles, secure admin dashboard (CRUD), health blog, events, and moderated reviews. Brand: Blush Pink, Navy, Gold. Content scalable/tagged by Caribbean island.

## User Choices
- Theme: dark navy hero sections + warm light content areas (combines both mockups)
- Auth: JWT email/password admin login (no public registration)
- Data: starts empty; admin adds all content
- Reviews: visitors submit → admin approves before public display
- Island tagging + global island filter from day one

## Architecture
- Backend: FastAPI + MongoDB (motor), single server.py, all routes under /api. JWT (HS256) via bcrypt; admin seeded from env. Public routes + admin routes (`/api/admin/*`, Bearer-protected). Reviews aggregate → provider rating computed from approved reviews.
- Frontend: React 19 + React Router + Tailwind + shadcn/ui + framer-motion. AuthContext (localStorage token), IslandContext (global filter). Sonner toasts.

## Personas
- Visitor: searches/filters providers & services by island/specialty/category, reads blog, views events, submits reviews.
- Admin (client rep): manages providers, services, categories/niches, articles, events, and moderates reviews.

## Implemented (2026-06-14)
- Auth: /api/auth/login, /api/auth/me; admin seeded (danieldominiquebrooks@gmail.com).
- Providers: public list (filters: island, specialty, category, in_network, q, sort) + detail; admin CRUD.
- Services, Categories, Articles (blog + detail), Events (list + detail): public read + admin CRUD.
- Reviews: public submission (pending), admin moderation (approve/reject/delete), approved shown publicly, rating aggregation.
- Global island filter (header dropdown + pill bar) across all content pages.
- Public pages: Home, Directory, Provider detail, Services, Blog, Article, Events, Event detail, Reviews.
- Admin dashboard with tabbed generic CRUD + review moderation.
- Provider/Article/Event photo upload via Emergent object storage (POST /api/admin/upload, GET /api/files/*).
- Bulk CSV provider import (POST /api/admin/providers/bulk) with downloadable template.
- Saved Providers: visitor favourites (localStorage), heart toggles on cards + detail, header counter, /saved page.
- Light/Dark mode toggle (header, persisted via localStorage) across all content areas.
- Rich text article editor (headings, bold, italic, lists, links) in admin; rendered as HTML on public article pages.
- Directory Map View (Leaflet/OpenStreetMap) plotting providers by lat/lng or island centroid; List/Map toggle.
- Island selection centralized to a single header selector; in-section island filter bars removed; all sections scoped to the chosen island.
- Public Services section removed (Directory covers discovery); admin Services tab removed.
- Admins can toggle a provider's Featured status directly from the list (star button).
- Map pins include a "Get directions" link to Google Maps; rich text editor supports inline images in article bodies.
- Installable PWA ("Get the app" button): manifest + service worker + icons; native install on Android/Chrome, Add-to-Home-Screen guidance on iOS.
- Theme-aware header banner (light/dark) driven by the header toggle; article preview before publishing; large brand logo in the home hero.
- Install nudge (one-time mobile banner); offline-ready service worker (cache-fallback) + offline banner; map/detail directions fall back to written address when coordinates are missing.
- Brand logo recreated as transparent interlocking gold+pink crosses with theme-aware wordmark (legible on light & dark); favicon + installed-app icons use the crosses.
- Provider opening hours (per-day editor) with "Open now"/"Closed" badges on cards and a full hours panel on provider profiles.
- Featured articles: admins pin articles to the top of the Health Blog with a "Featured" badge.
- Location model: content categorized by Country and a second-level Parish/Island (region); header has a Country selector plus a dependent Parish/Island selector; all sections scope to the selection.
- Admin: bulk-select and bulk-delete providers; Categories tab lists all categories (GET /admin/categories).
- Simplified categories: seeded starter set (Specialty, General Practitioner, Hospital, Clinic, Pediatrics), add-by-name only, and each category shows its assigned provider count.
- Fully responsive; custom SVG brand logo. Verified: backend pytest + full frontend E2E — 100% pass (iterations 1-9).
- Auto-geocoding (Nominatim/OpenStreetMap): providers auto-resolve address→lat/lng on create/update; admin "Auto-locate" bulk backfill (POST /admin/providers/geocode); admin single lookup (GET /admin/geocode). Map pin clustering (leaflet.markercluster) + MiniMapPicker in admin form. Verified iteration-11 (100% backend+frontend).
- (2026-06) Perf fix: geocode_address now uses httpx.AsyncClient (async, non-blocking) instead of sync requests.get — bulk backfill no longer freezes the event loop; server stays responsive during geocoding. Verified via concurrent request test.
- (2026-06) Directory map view removed (list-only Directory + provider-profile "Get directions"); admin map tools (MiniMapPicker, Auto-locate) hidden, lat/lng retained in backend.
- (2026-06) Admin account security: admins can change their own login email/password (PUT /admin/account); seed_admin no longer overwrites a portal-changed password. Email-based 2FA on EVERY admin login: POST /auth/login emails a 6-digit code (Emergent Resend), POST /auth/verify-2fa issues the JWT. Hardened against Resend 429s: fresh challenges reused within 90s (no duplicate emails), challenge stored only after successful send, one retry w/ backoff on 429, older unused challenges invalidated.
- (2026-06) Editable site content from admin Settings tab: site_title, hero_heading, hero_subheading (Home hero), about_text, contact_email/phone/address, and Facebook/Instagram/TikTok links (rendered in Footer). GET /settings public, PUT /admin/settings.
- (2026-06) Admin providers list filterable by Country, Parish/Island, Category (client-side).
- (2026-06) Visitor analytics: VisitTracker (in Layout) posts /track per route + /track/duration on leave; backend resolves country/city from IP via ipapi.co in a background task (track returns <1s); admin Analytics tab shows sessions (IP, country/city, pages, time-on-site).
- (2026-06) Newsletter: popup on Blog & Events (every visit until subscribed), POST /subscribe; admin Subscribers tab (add/toggle-active/delete); per-article/event "Notify subscribers" (POST /admin/{articles|events}/{id}/notify) emails active subscribers with a one-click unsubscribe link (GET /newsletter/unsubscribe -> sets active=false). Emails go through the Resend guardrail gate. Verified iteration-12 (100% backend+frontend).
- (2026-06) Welcome email: POST /subscribe now sends a friendly branded welcome email (background task, with unsubscribe link) on new subscribe and on reactivation. Verified 202 for real address (Resend rejects example.com test addresses with 422, handled gracefully).
- (2026-06) GEO DEFAULT: LocationContext detects the visitor's country CLIENT-SIDE (ipwho.is -> ipapi.co fallback, using the real browser IP because the server sits behind a proxy) and defaults the country + matched parish/island; falls back to "All Countries" when outside the 12 supported Caribbean countries. Cached per session (sessionStorage hl_geo). Testing/demo override: /?geo=CC (e.g. ?geo=JM). Verified via /?geo=JM showing Jamaica + parish selector. Backend /api/geo/detect exists but is unreliable behind the proxy (returns datacenter IP) so the frontend does not depend on it.
- (2026-06) ABOUT PAGE: public /about (heading, rich-text story, hero image, team members grid); editable in Admin -> Settings -> About editor. GET /about, PUT /admin/about. Added to nav (NAV_LINKS) + footer.
- (2026-06) QUIZ SYSTEM: admin Quizzes tab - create/edit/delete quizzes, only ONE active at a time (enforced server-side). Quiz collects name+email -> age -> multiple-choice questions; admin sets popup_delay_seconds + custom result_message. Site-wide QuizModal (in Layout) shows the active quiz after the delay, once per visit (sessionStorage hl_quiz_dismissed), never again on a device that completed it (localStorage hl_quiz_done_<id>); "No thanks" dismisses for the visit. Completing adds email to subscribers and emails a result (custom message + answer summary via Resend). Newsletter popup on Blog/Events is suppressed while an active quiz is pending. Quiz Analysis view: per-question option-count bars, age distribution, respondent list, date-range filter. Endpoints: /quiz/active, /quiz/submit, /admin/quizzes CRUD, /admin/quizzes/{id}/analysis. Verified iteration-13 (100% backend+frontend).
- (2026-06) ANALYTICS date range: /admin/analytics and quiz analysis accept start/end (YYYY-MM-DD); admin UIs have a DateRangeBar filter. Verified iteration-13.
- (2026-06) QUIZ ENHANCEMENTS: scheduling (start_date/end_date gate /quiz/active), answer POINTS per option ({text,points}), score-based result TIERS (result_tiers [{min_points,message}] -> highest matching tier's message emailed, else default; **bold** markdown supported), colorful/fun redesigned QuizModal (gradient header, progress bar, animated options, points badge in email), CSV export of responses (/admin/quizzes/{id}/responses.csv, UTF-8 BOM), and REGION provider counts (/regions/counts?country=) shown next to each parish/island in the header selector. Verified iteration-14 (100% backend+frontend). Note: run its pytest with -n 0 (single-active-quiz is global).
- (2026-06) ON-SCREEN QUIZ RESULT: /quiz/submit now returns {points, max_points, result_message}; QuizModal shows a celebratory ResultView (animated score badge, %, bold-rendered tier message, Done button) right after submit, in addition to the email. Verified via curl (points/max/message returned).
- (2026-06) AUTO-ANNOUNCE: creating a published article/event auto-emails active subscribers (background _send_newsletter); publishing a previously-draft item via update also fires once. Guarded by an `announced` flag so edits don't re-send. Manual "Notify subscribers" button retained. Verified via curl (announced=true + send fired).
- (2026-06) Split specialties: combined specialty cells (e.g. "Cardiology;Internal Medicine/Pediatrics") are split on [;|/] into a `specialties` array on providers (CSV import, admin create/update, one-time startup backfill). Primary `specialty` = first value. /specialties lists each individually, specialty filter + search match the array, category sync creates separate specialty categories. Verified via curl.
- (2026-06) WEB PUSH + CAMPAIGN ANALYTICS: (1) PWA web push — header bell (NotifyBell / lib/push.js) lets visitors opt in; self-generated VAPID keys in backend .env; endpoints GET /push/vapid-public-key, POST /push/subscribe (upsert by endpoint), POST /push/unsubscribe, GET /admin/push/count. sw.js handles `push` + `notificationclick`. When an article/event is published or "Notify" is hit, `_announce()` creates a tracked `campaigns` row and dispatches BOTH email and web push (each push/email recipient gets a unique token). Expired push subs (404/410) auto-pruned. (2) Analytics — email opens via 1x1 GIF pixel (GET /track/open/{token}.gif, deduped), email+push clicks via tracked redirect (GET /track/click/{token} -> 302 to campaign link; a click also counts as an open). Counters live on the campaign doc (email_sent/opened/clicked, push_sent/clicked). Admin: new "Campaigns" tab (CampaignsManager: 5 summary cards + per-campaign table + push-subscriber count) and inline stats (CampaignInline) under each article/event row. Collections: campaigns (idx ref_id), campaign_recipients (token unique), push_subscriptions (endpoint unique). Both create/update AND manual notify endpoints use `_announce`. Verified iteration-15 (backend 12/12 after notify fix, frontend 100%). Note: email dispatch uses LIVE Resend — keep active-subscriber count at 0 when testing publish to avoid sending real emails.

- (2026-06) COUNTRY-WIDE VISIBILITY: providers/articles/events/services saved WITHOUT a parish/island (region empty/null/missing) now surface in EVERY parish of their country. Backend helper `apply_region_filter(query, region)` matches the selected region OR no-region items via a `$and`+`$or` clause (coexists with the `q` search `$or`). Parish-specific items still only appear in their own parish. Verified via curl (Kingston filter shows country-wide + Kingston items, hides St. Andrew-only).
- (2026-06) COUNTRY-WIDE UX: visitor cards (ProviderCard, Blog article cards, Events cards) show a "Country-wide · {Country}" tag when an item has no parish/island. Admin content form shows a helper note under the Parish/Island field ("Leave blank to make this visible in every parish of the country"). Verified via screenshots on Directory, Blog, Events (desktop + mobile).

## Backlog
- P1: Rich-text article editor; article categories management UI.
- P2: Multi-country grouping layer above islands; localization.
- P2: Admin analytics (views, top providers); saved/favourite providers for visitors.
- P2: Shorter JWT expiry + refresh flow; tighten CORS for production.

## Next Tasks
- Await client content or bulk import; optionally add image upload.

## 2026-06 — Iteration 16
- Home hero: removed "Countries Covered" counter (providers + articles only).
- Search tracking: `POST /api/search/track` (from Directory search), admin "Search Gaps" tab (`GET/DELETE /api/admin/search-gaps`) showing terms, counts, zero-result counts, countries, date range filter.
- Article categories: `GET /api/articles/categories`, Blog category chips filter, admin Articles category datalist input, Categories "Used for" (Providers | Articles/Blog) with article_count badge.
- Tested: /app/test_reports/iteration_16.json (all pass).
- Backlog unchanged: Payment integration (Kanoo/SunCash — awaiting user scoping), Share Provider, Provider Timezone, Hours Copy, Featured Carousel, Country Landing Pages, Merge Categories.
- Handover export (2026-06): `GET /api/admin/export/handover` -> ZIP (data/*.json for 13 collections minus secrets, uploads/ images from object storage, brand/ assets, HANDOVER.md, ENV_VARIABLES.md, restore_data.py). Button in Admin > Settings ("Handover package"). Self-tested via curl + screenshot.
