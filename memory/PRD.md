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

## Backlog
- P1: Rich-text article editor; article categories management UI.
- P2: Multi-country grouping layer above islands; localization.
- P2: Admin analytics (views, top providers); saved/favourite providers for visitors.
- P2: Shorter JWT expiry + refresh flow; tighten CORS for production.

## Next Tasks
- Await client content or bulk import; optionally add image upload.
