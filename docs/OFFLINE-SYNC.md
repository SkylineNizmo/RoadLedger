# RoadLedger offline-first synchronization preparation

Status: development branch `roadledger-offline-sync`, based on the verified expense/accounting repairs. Nothing is merged or deployed. Cloud connections are **disabled by default** in `sync/config.js`. No external account, payment method, cloud database, or credential was created or assumed.

## What works locally

- The existing application, financial records, navigation, and CSS remain intact. A collapsible **Sync & Offline** card is added within Settings.
- Existing synchronous saves continue to localStorage. IndexedDB independently persists a record-level replica, pending operations, server revisions, change-feed position, conflicts, resolution history, and an untouched copy of the original localStorage snapshot.
- The migration copies all seven existing record datasets: loads/equipment, settings/MPG, mileage, expenses/maintenance/fleet/documents/IFTA, tires, route defaults, and ordered route stops. It preserves IDs, expense-to-load references, unknown equipment fields, and extra metadata. It never clears or rewrites the original data just to migrate.
- Successful local writes trigger a capture; startup rescans saved localStorage. A tab closing before its asynchronous IndexedDB mirror finishes does not erase its successfully saved localStorage data. Failed IndexedDB transactions roll back atomically and a subsequent capture can recover the local edit.
- A versioned service worker caches only the static app shell, enabling offline reopening after one successful online load. The release cache version must be bumped when shell assets/schema change; a new worker waits for old tabs to close rather than replacing running code. It never caches API/session/weather responses or financial records. An install manifest supports a standalone browser app. HTTPS or localhost is required.
- With the local mock enabled, the same browser client authenticates, uploads queued changes, downloads remote revisions, and automatically retries after reconnect/foreground return. Retry delay grows from roughly 1 second to 60 seconds with jitter; successful sessions poll every 15 seconds. Requests time out after 15 seconds. Session expiry pauses uploads and asks for sign-in.
- Downloaded data stays in the replica until **Apply downloaded records** is chosen. Applying checks for newer local saves, uses the existing recoverable multi-key restore journal, records an IndexedDB projection checkpoint, then reloads. Saved work is captured first. The confirmation explicitly asks the user to save form drafts before reloading.
- **Export sync recovery** downloads the replica, pending edits, conflicts, original migration snapshot, current localStorage bytes, and any restore journal, even if migration/apply is blocked. No passwords, access tokens, refresh tokens, or CSRF tokens are persisted in that export or sync database.

This is a working local prototype and production architecture preparation, **not an enabled production synchronization service**.

## Storage and protocol

```text
Existing forms
  -> checked localStorage write (legacy format retained)
  -> capture event + startup reconciliation
  -> IndexedDB transaction: replica + dirty operation + operation ID
  -> authenticated same-origin HTTP API
  -> revision-checked per-user records + durable change log + replay receipts
  -> IndexedDB downloaded records / explicit conflict review
  -> checked, journaled localStorage projection + reload when requested
```

Records have canonical keys `[collection, id]`. Loads, mileage trips, and each extra ledger entry synchronize individually, preventing an unrelated new receipt on one device from replacing a load added on another. Equipment defaults and pay settings are conservative single documents; route stops are one ordered document. Tire and route-spec defaults synchronize per equipment/profile. Existing list ordering is preserved for known records; newly received records are appended in stable ID order. A later UI release can sort them by date without altering records.

A pending record has a stable operation ID and its base server revision. The server derives the owner from the authenticated session/JWT and checks the expected revision atomically. An acknowledged operation retried after a dropped response receives the same acknowledgement, without duplicating a receipt. Reusing an operation ID for different data is rejected. A newer local edit made while an earlier request is in flight stays queued after that earlier acknowledgement.

Deletion is a retained JSON-null tombstone, not a physical erase. Server change cursors follow commit order for each account. The prepared SQL serializes that account's writes with a head-row lock; pagination advances only through committed changes and blocks projection while more pages remain. Old events and retry responses cannot regress known record revisions.

## Conflict policy

There is no clock-based last-write-wins policy for financial data. Two changes to the same record from the same base revision produce a conflict containing both values, including edit-versus-delete conflicts. Unrelated records merge independently. Even changes to different fields of one record require review in this preparation version.

Settings shows both versions and offers **Use this device's version** or **Use cloud version**. Choosing a version archives both originals and the decision before changing replica state. Keeping the local version retries against the latest remote revision; another concurrent cloud edit can cause another conflict. Keeping the cloud version waits for explicit apply before changing the visible legacy record. Both versions can be downloaded for manual combination; there is no automatic financial-field merging or automatic creation of duplicate linked records.

A crash before projection changes leaves the old view intact. A crash after projection commit completes its checkpoint on restart. If a crash is followed by additional edits that make the apply outcome ambiguous, synchronization stops and retains all evidence. Recovery export remains available; an operator must review the snapshots before resuming. No snapshot is guessed away or deleted.

## Authentication and isolation

The local mock demonstrates sign-in with server-held sessions, HttpOnly/SameSite cookies, CSRF verification, same-origin restrictions, request-size limits, per-session ownership, workspace-identity checks, session expiry, sign-out, and rejection of a different account attempting to bind an already-owned local workspace.

A workspace is bound to the first explicitly signed-in user. A pre-existing session cookie cannot automatically bind an unowned local workspace or upload its legacy records; initial binding requires the sign-in action. Account switching is refused rather than uploading one person's local financial records into another person's account. Use a different OS/browser profile for a different account. Signing out stops the client and invalidates the current server session, but intentionally retains existing device records and its offline queue. A request already accepted before sign-out may have committed; idempotent replay handles it after the same user signs back in.

For production, a same-origin backend-for-frontend (BFF) must own authentication tokens. It must use Secure + HttpOnly + SameSite cookies, verify origin and CSRF tokens on mutations, refresh provider tokens server-side, rotate session IDs, validate current identity, enforce request limits/rate limits, and avoid credential/record logging. Refresh tokens belong in encrypted server-side session storage, never localStorage, IndexedDB, browser-readable cookies, URLs, or service-worker caches. `X-Workspace-User` is only a mismatch check; it never establishes authorization.

`backend/supabase-provider.cjs` provides tested server-only login, refresh, user verification, logout, and RPC request mapping. The transport forwards the individual user's JWT and refuses service-role keys; the browser never needs a privileged key. `backend/supabase.sql` prepares per-user row-level policies, RPC-only mutations, revision checks, tombstones, paged changes, and idempotency receipts. Owner IDs always come from `auth.uid()`, not a client argument. JSON-null tombstones are wrapped for RPC transport to avoid accidental SQL NULL conversion.

**Updated by the local security repairs:** a production BFF/session handler, encrypted single-process server session store, private SQL validators, database quotas, bounded pages, and local PostgreSQL/RLS tests now exist. See `SUPABASE-HARDENING.md`. Real-provider integration, hosting/TLS/proxy configuration, real authentication/recovery flows, managed Supabase grants/RLS, multi-connection concurrency, and backup operations still need separately authorized staging verification. The mock server must never be exposed publicly or deployed.

## Backend comparison and recommendation

Pricing checked against official pages on 2026-10-18. Quotas, provider policies, and prices may change; recheck before setup. USD estimates exclude taxes, separate hosting, and email delivery.

| Option | No-cost starting point | Fit and limitations |
| --- | --- | --- |
| **Supabase — recommended** | $0/month Free: 500 MB database, 50,000 monthly active users, 5 GB egress. Pro starts at $25/month. | Integrated Auth + PostgreSQL/RLS and transactional RPCs fit the revision/receipt protocol. Free projects can pause after a week of inactivity and do not include automatic database backups. The client queues safely during an outage. A production BFF/session host still needs setup. |
| Firebase Auth + Cloud Firestore | Spark no-cost plan; standard Firestore quotas include 50,000 document reads and 20,000 writes per day. | Strong SDK/offline tooling and authentication. Financial reconciliation still needs explicit conflict semantics, security rules, and cross-device tests. Some server features require Blaze billing, so avoid assuming cloud functions are free or available without billing. |
| Cloudflare Workers + D1 | D1 on Workers Free includes 5 million rows read and 100,000 rows written daily, with 5 GB total storage. | Low-cost SQL and a natural API host, but managed user authentication and secure session/refresh handling require an additional identity service or more custom work. More components than Supabase for this application. |

Sources: [Supabase pricing](https://supabase.com/pricing), [Firebase pricing](https://firebase.google.com/pricing), [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

**Cost of completed work: $0 in backend/service charges.** All service tests use local mock processes or stubbed fetches. A small personal deployment can start on a free backend tier if its requirements/quotas fit. No paid plan is required by this branch. Do not assume a production BFF host, SMTP delivery, backups, or operational monitoring are included in that $0 estimate. Paid upgrades, accounts, and live deployment remain separate user decisions.

## Run the local mock

Use Node.js 20+ (no backend packages or accounts required):

```sh
node backend/mock-server.cjs --data /tmp/roadledger-demo-cloud.json
```

Open `http://127.0.0.1:8000/?sync=mock`, then Settings -> Sync & Offline. The only fictional demo logins are `driver@example.test` and `other@example.test`, both using `local-demo-only`. They are test fixtures, not real accounts. The server binds only to 127.0.0.1. Its optional JSON file is local mock state; it contains test records, not production credentials. Without `--data`, the mock's records are memory-only. Mock sessions expire after one hour and do not survive a server restart; records and operation receipts do survive if `--data` is used.

Use two separate browser profiles to simulate two devices signing in as the same demo user. Export backups first if intentionally experimenting with existing data. Work offline in one profile, reconnect, inspect conflicts, synchronize, then apply downloaded records. A different origin/port has separate browser records and cache. Do not expose the HTTP mock on a LAN or tunnel it to phones as a production service.

## Actual cloud setup still required

1. Review this branch and export both ordinary JSON backups and sync recovery files on every device. Do not erase old browser data. First migration is copy-only; duplicate IDs or malformed legacy JSON stop migration for review.
2. If Supabase is selected, the user creates a Free project/account and supplies its HTTPS project URL and publishable/anon key through server configuration. No project or credentials exist from this work.
3. Review and test `backend/supabase.sql` in that isolated project; verify that two users cannot select, mutate, or replay each other's records. The revised SQL has been executed only in an isolated local PostgreSQL engine with simulated verified claims; managed Supabase/PostgREST/JWT behavior remains unverified.
4. Configure and review the implemented BFF/session host and encrypted single-process session store; supply production keys and private persistent storage server-side. Complete email verification, recovery, logout/revocation, rate limiting, and provider-expiration tests. Do not put tokens or a service-role key in `sync/config.js`.
5. Serve the app, manifest/service worker, and `/api/sync/*` API under the **same HTTPS origin and application path**. GitHub static hosting by itself cannot implement those authenticated endpoints. The live website remains unchanged until publishing is separately approved.
6. After configuration/security review, change `sync/config.js` to `mode: 'cloud'` in a future approved build. Sign in on the device holding the original records, upload, review conflicts, and apply only after verifying totals. Bring each additional device's local records into the same account; existing matching IDs are reconciled by revisions and conflicts, not silently replaced.
7. Test actual Windows Edge/Chrome, Safari on iPhone, Safari on iPad, and installed Home Screen mode. Verify suspend/resume, quota denial, re-authentication, device clock skew, cellular handoff, offline restart, recovery downloads, touch input, and safe multi-tab behavior. Current viewport tests use Chromium, not native Safari/WebKit or physical devices.
8. Establish database and downloaded-backup retention, monitoring, cost alerts, restore drills, and an explicit history/tombstone cleanup policy. No automatic deletion or history compaction is implemented because an old offline device may need those revisions.

## Limits of this preparation

- localStorage remains the compatibility save path; its IndexedDB mirror is asynchronous. Startup rescan repairs the queue after interruption, but browser/device destruction can remove both stores. IndexedDB is transactional; multi-key localStorage uses a recovery journal, not a true cross-storage transaction. Ordinary save conflict checks are not a distributed lock between simultaneously writing browser processes.
- **Apply downloaded records is explicit**, preserving form drafts and making the prototype reviewable. Automatic background projection into a running editor is not enabled. Sync network reconnection is automatic once the mock/cloud connection is configured and the session can resume.
- Browsers may suspend background tabs or installed apps, particularly iOS. No always-on or closed-app upload guarantee is made. Foreground reopening and reconnection resume the queue. Initial offline launch requires a previously cached shell. Browser eviction, private-mode restrictions, or storage clearing remain possible; persistent-storage permission is requested only through its Settings button and may be denied.
- Local records are protected by the OS/browser profile, not app-level at-rest encryption or a local lock screen. Cloud transport/storage security is not end-to-end encryption. Shared-device account switching intentionally needs separate profiles; automatic workspace switching is not prepared.
- Record IDs remain unchanged to preserve links. Existing IDs colliding across unrelated device histories require conflict review; there is no automatic identity remapping. A legacy snapshot with duplicate IDs or invalid JSON is kept untouched and cannot sync until repaired.
- Replica/queue/conflict archives currently share one IndexedDB state transaction. This favors correctness and testability for a personal ledger; large fleets need normalized stores, pagination/size benchmarking, and retention design. The mock and revised SQL both return pages bounded by 100 events and 512 KiB; all HTTP/provider response reads are bounded. Histories, operation receipts, tombstones, and recovery copies grow rather than being silently pruned.
- Sync recovery export is a forensic/recovery format, not an ordinary JSON backup to import directly. Use the normal backup for the visible ledger, retain recovery exports to review pending/conflicting versions, and complete a reviewed recovery/import workflow before production rollout.
- Theme preference and session-only GPS destination/stop inputs remain device-local. This branch does not add live load boards, ELD integrations, commercial routing, paid AI services, or secure document uploads.


The latest local-only security changes, limits, test results, and production-session configuration are detailed in [SUPABASE-HARDENING.md](SUPABASE-HARDENING.md). They have not been deployed or run against live Supabase.
