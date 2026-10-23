# RCA — provider-finder-19 — /admin login "incorrect password" after secret change

## Problem statement
User changed ADMIN_EMAIL/ADMIN_PASSWORD in production Secrets and redeployed, but login at /admin still reports incorrect password. Hypothesis from reporter: admin user is seeded from env only on first startup (empty users collection), so changing the secret did not update the already-existing admin document in production MongoDB.

## Findings (info-only, no deploy/secret changes made)

### 1. Secret NAMES currently configured in production (active run fc1431d4-db1a-4fe4-b9cc-112ede88b001)
Both target secrets EXIST and are non-empty:
- ADMIN_EMAIL — present, is_empty=false
- ADMIN_PASSWORD — present, is_empty=false

(Values are never revealed. Full key list also includes: CORS_ORIGINS, DB_NAME, EMAIL_FROM_NAME, EMERGENT_EMAIL_KEY, EMERGENT_LLM_KEY, ENABLE_HEALTH_CHECK, INTEGRATION_PROXY_URL, JWT_SECRET, MONGO_URL, REACT_APP_BACKEND_URL, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT, WDS_SOCKET_PORT.)

### 2. Most recent redeploy
- Active/most-recent run: fc1431d4-db1a-4fe4-b9cc-112ede88b001, type=redeploy, status=SUCCESS.
- Completed at 2026-10-23T14:58:26Z (started 14:54:13Z).
- Note: a secret_change run (7149940c, type=secret_reuse) succeeded just before at 14:53:15Z — this reused the existing image (no new code), consistent with the secret edit.

### 3. Backend startup log lines for admin seeding/sync
- Searched active run logs (filter: seed|admin|sync, last 1440 min): ZERO matches.
- Full startup sequence observed only: "Starting FastAPI backend...", "Storage initialized", "Application startup complete", "Uvicorn running".
- NO "Seeded admin", "Admin email synced", or "Admin password synced" lines present.
- Confirms POST /api/auth/login returning 401 Unauthorized repeatedly in production logs.

## Root cause
The currently-running production image does NOT contain the env-sync-on-startup logic — its boot log emits no admin seed/sync lines, only "Storage initialized". Because the admin user already exists in the production MongoDB (seeded on an earlier first-boot), the one-time seed path is skipped, and changing ADMIN_EMAIL/ADMIN_PASSWORD secrets alone never rewrites the existing user document. Hence /admin still rejects the new credentials. This matches the reporter's hypothesis exactly.

## Fix
The newly-added code to sync email/password from env on every startup is not yet in the deployed image. A redeploy is required to build and ship that code. After redeploy, verify boot logs show "Admin email synced" / "Admin password synced" and retry /admin login. No secret change is needed — both ADMIN_EMAIL and ADMIN_PASSWORD are already present and non-empty.
