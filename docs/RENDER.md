# Render preparation — local only

No service has been created, no SQL executed, and cloud synchronization remains disabled in both `sync/config.js` and the production server default. These settings are a deployment runbook, not authorization to deploy.

## Future web service settings

- Existing development branch: `roadledger-offline-sync`. Review the uncommitted security and hosting changes before any future commit/push.
- Node 24 LTS (Node 22 also supported by package engines); build `npm ci --omit=dev`; start `npm start`.
- Paid web service, exactly one instance/process. Use the Render-provided PORT; the listener binds `0.0.0.0`.
- Health path `/healthz`. Returns only process health and the cloud enablement state; it intentionally does not query Supabase or promise database readiness.
- `ROADLEDGER_ORIGIN=https://<exact application hostname>` without a trailing slash. Host matching is exact: redirect aliases/custom-domain alternatives at the ingress and choose one canonical origin.
- `ROADLEDGER_PROXY_MODE=render` only on Render's managed web service ingress. Startup requires `RENDER=true` and `RENDER_SERVICE_ID`. Render's TLS-terminating ingress must overwrite `X-Forwarded-Proto` and restrict direct ingress to the container. The mode explicitly trusts that ingress, not arbitrary forwarded IP headers. Validate these assumptions in staging before enabling authentication; never set this mode on a publicly reachable standalone HTTP listener. Alternatively configure exact `ROADLEDGER_TRUSTED_PROXY_IPS` for a controlled proxy, or `ROADLEDGER_TLS_KEY`/`ROADLEDGER_TLS_CERT` for direct TLS.
- Login client identification defaults to `ROADLEDGER_CLIENT_IP_MODE=auto`: Render uses account-only limits, not a shared ingress-IP bucket. Before production authentication, verify all actual ingress peers/hops, configure `ROADLEDGER_TRUSTED_PROXY_IPS` / `ROADLEDGER_TRUSTED_PROXY_CIDRS`, then set `ROADLEDGER_CLIENT_IP_MODE=trusted-chain`. Traversal is right-to-left and fails sign-in closed for untrusted/malformed chains. Do not guess address ranges, trust leftmost prefixes, or assume Cloudflare headers are authentic. The production launcher rejects enabling Render cloud authentication without explicit trusted-chain mode. See `docs/SUPABASE-HARDENING.md` for the security contract and staging checks.
- `ROADLEDGER_CLOUD_SYNC=disabled` (or omit). No Supabase settings or session disk are required while disabled. All `/api/` requests return 503; no provider is constructed or contacted. Frontend config stays disabled too.
- `/healthz` allows unauthenticated platform probes without forwarded HTTPS; other paths require the canonical host and verified HTTPS transport. No redirects use untrusted request headers.
- No-cache revalidation for shell assets and service worker; explicit public-file allowlist excludes SQL, tests, server code, secrets, and session data. No HTML catch-all for unknown paths.

Do not create an auto-deploying production service until authorized. After approval, use GitHub integration and staging branch deployment only after real CI checks pass; keep production promotion manual until approved. No Render Blueprint is included to avoid accidentally creating paid services or publishing this branch.

## Enabling cloud later — only after real database verification

Review `backend/supabase.sql` and `docs/SUPABASE-HARDENING.md`; complete real staging RLS/JWT/PostgREST/auth tests first. Configure confirmed accounts and production email delivery/reset flows. Then configure:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (never service-role).
- Persistent disk mounted at `/var/data`; `ROADLEDGER_SESSION_DIRECTORY=/var/data/roadledger-sessions`.
- `ROADLEDGER_SESSION_KEY`: base64 of 32 cryptographically random bytes, stored separately in server secrets and backed up securely. Keep the same key across restarts/deploys. Key rotation requires a planned session migration or reauthentication; never delete session files or rotate blindly.
- Only after approval/testing: `ROADLEDGER_CLOUD_SYNC=enabled` AND change frontend config to the `mode: 'cloud'`. Neither is enabled by this preparation.

Session identifiers use Secure/HttpOnly/SameSite=Strict cookies, with CSRF checks. Provider tokens remain AES-256-GCM encrypted on disk. Persistence is seven days, subject to provider validity, logout, and cookie retention. The disk contains sessions, not financial records. Keep tokens and credentials out of logs, frontend configuration, backups exported by the app, and Git.

Graceful SIGTERM drains requests and closes the session-directory lease. A forced kill may leave `.single-process`; startup deliberately fails closed. After verifying the old instance is stopped, an operator must inspect and remove only the stale lease, preserving session files and key. Do not automate deletion of an unverified lease. Persistent disks support only a single instance and introduce brief deployment downtime; offline queue recovery must be checked in staging. Multiple instances require shared encrypted session storage and distributed locking.

## PWA and data migration

The UI is unchanged. The manifest retains relative scope/start URL and now supplies 192/512 PNG icons plus the SVG. Apple has a 180px touch icon. Shell cache v3 includes these assets; activation retains the existing no-skipWaiting update behavior. API responses are never cached. Cloud synchronization is not required for offline shell/records. Maps, weather, AI and other remote features still require their respective connectivity/services.

Before changing away from GitHub Pages, export ordinary backups and synchronization recovery from every device/browser profile. localStorage/IndexedDB/caches are origin-specific; the new address cannot read the old site's records. Retain old data until deliberate migration, deduplication/conflict reconciliation and totals verification complete. Safari/Android can evict website storage: keep independent backups. Background synchronization while iOS suspends the app is not guaranteed; reopen the app online for reconnection.

## Local verification

`npm run test:render` checks the production listener, ingress/host rejection, public assets, health and disabled API. `node tests/render-browser.cjs` uses installed Chromium through a local simulated TLS-terminating ingress; it tests phone/tablet/desktop viewport and touch emulation with service-worker offline reload and localStorage persistence. It does not establish real TLS certificate validity or native Safari/Android behavior. Run `npm run test:security` and all existing browser regressions as documented in `tests/README.md`.

Before production: verify real Render TLS and forwarded headers, disk/redeploy/graceful and forced-stop recovery, session refresh/logout across devices, actual Windows Chrome/Edge, Android Chrome install/offline/relaunch, and iPhone/iPad Safari/Add to Home Screen/relaunch/storage behavior. Real Supabase tests remain mandatory. Local mocks cannot certify these services or physical platforms.

### Results in this workspace

All 17 local suites passed: six security/database/provider/session/API/pagination suites; eight existing accounting, expense-link, smoke, navigation, repair, synchronization, recovery and offline suites; and three new Render server/session/browser suites. Browser coverage used Linux Chromium with desktop, Android-sized, iPhone-sized and iPad-sized contexts; not native operating systems or Safari. The offline mock asset allowlist was updated for the PNG shell icons and offline/API suites rerun successfully. JavaScript syntax and `git diff --check` also passed. Existing development-tool installations supplied PGlite and Playwright; no live credentials or database were used.
