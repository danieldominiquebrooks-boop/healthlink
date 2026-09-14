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
- Brand logo recreated as transparent interlocking gold+pink crosses with theme-aware wordmark (legible on light & dark).
- Fully responsive; custom SVG brand logo. Verified: backend pytest + full frontend E2E — 100% pass (iterations 1-6).

## Backlog
- P1: Rich-text article editor; article categories management UI.
- P2: Multi-country grouping layer above islands; localization.
- P2: Admin analytics (views, top providers); saved/favourite providers for visitors.
- P2: Shorter JWT expiry + refresh flow; tighten CORS for production.

## Next Tasks
- Await client content or bulk import; optionally add image upload.
