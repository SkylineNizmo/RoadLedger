# Supabase/security repairs — local development only

The repairs remain local, on `roadledger-offline-sync`. No live Supabase SQL, deployment, publishing, Git push, or user-record deletion is part of this work. `sync/config.js` remains disabled. The production server was tested with mocked providers, never real credentials.

## Completed repairs

### Database and validation

- `backend/supabase.sql` is now one transaction and can be rerun. It creates missing objects, replaces the intended policies/functions, and adds counters without deleting, normalizing, or rewriting stored records/history. Existing accepted operations remain replayable before new validation/quotas are evaluated.
- All privileged functions use an empty search path and qualified objects. Private validation helpers are not executable by browser roles. Table writes remain revoked; authenticated table reads remain subject to ownership RLS; RPCs explicitly scope every write/read/receipt to the authenticated UUID.
- RPCs reject absent identities, Supabase anonymous users, and users without confirmed email or phone. The BFF additionally verifies identity against Supabase's user endpoint. JWT signature verification itself remains Supabase's responsibility; local database tests simulate only the verified-claims interface.
- Collection names, canonical key formatting, singleton `default` IDs, record/key ID agreement, object/array shapes, numeric types/ranges, percentages, real calendar dates, MPG ranges, mileage consistency, tire counts, axle counts, payer values, and expense-link types are checked. Dangling expense/load references are retained because records can arrive separately or a referenced load can have been deleted.
- Unknown legacy fields are preserved where compatible. Missing legacy row IDs receive stable IDs in the sync copy, not by rewriting original localStorage. Malformed, unsupported, oversized, or conflicting data is retained for correction/recovery, never silently truncated or discarded.
- New writes have a 64 KiB record-value limit. SQL measures PostgreSQL's JSON representation, while HTTP measures wire UTF-8 JSON; representation overhead can cause SQL to reject a boundary-sized value that passes the client check. That rejection pauses safely with data retained. Use some headroom rather than relying on the exact boundary.
- Account mutation limits: 120 evaluated write attempts/minute and 100 MiB of tracked logical record/history/replay content. Existing history contributes on first subsequent write. Accepted replay requests do not consume new quota. These are safeguards, not provider billing guarantees or physical disk-size accounting. No history pruning is enabled; quota exhaustion retains records and queues changes.

### Synchronization limits and recovery

- Shared `sync/protocol.js` validates browser, mock, and BFF messages. Request bodies are capped at 96 KiB. Pull pages are bounded by 100 events and a conservative 512 KiB budget. Streamed HTTP/provider responses stop above 768 KiB before JSON parsing can allocate an unbounded body.
- The SQL page builder uses committed per-user cursors and never skips an event to make a page fit. A historical event too large for even one page, missing history, invalid cursors, or unsupported record content causes a recovery error; records are not removed to proceed.
- Clients require strictly consecutive event cursors, valid revisions, schema-valid records, and consistent page endpoints before committing a page and its cursor in one IndexedDB transaction. Malformed/interrupted responses cannot partially advance the cursor. More pages download promptly, and downloaded records cannot be applied before pagination completes.
- Permanent validation, size, or history errors pause with a correction/recovery message rather than pretending to be temporary connectivity loss. Rate limits back off with the durable local queue retained. A problematic pending record can pause the synchronization cycle; it must be corrected or reviewed, not silently bypassed.
- The migration archive, outbox, deletion tombstones, conflict copies, interrupted-apply recovery, and manual apply behavior remain intact. No UI or accounting redesign was introduced; the only page change is loading the shared protocol module. Service-worker cache version was advanced for the changed shell.

### Authentication and sessions

- `backend/supabase-provider.cjs` accepts successful 204 logout responses and explicitly requests `scope=local`, preserving other device sessions. JSON-null tombstones continue to use the RPC `{data: null}` envelope.
- `backend/session-service.cjs` implements the existing `/api/sync/session`, `/push`, and `/pull` contract. The browser receives only the user ID, in-memory CSRF token, and an opaque `__Host-` cookie (`Secure`, `HttpOnly`, `SameSite=Strict`, path `/`, no domain). Provider access/refresh tokens and passwords never enter browser storage or API responses.
- Provider tokens reside only in `backend/session-store.cjs` server files encrypted/authenticated with AES-256-GCM and a separately supplied 32-byte key. Random session identifiers are hashed for filenames; file permissions are 0600, directory permissions 0700, writes use an atomic rename/fsync, and encryption is bound to the session filename. There is no plaintext fallback or generated production-key default.
- Refresh is serialized per session to avoid refresh-token rotation races. Sessions rotate on login, verify identity on protected requests, have a seven-day absolute lifetime, reject account/header mismatches, and preserve local application records on sign-out. Sign-in attempts are limited per normalized account and, when available, per verified direct/proxy client IP; provider errors are sanitized. Render cloud authentication requires explicit trusted-chain configuration as described below.
- Mutations require the exact configured Origin, JSON/client headers, and (after login) constant-time CSRF verification. Foreign origins and cross-site fetch metadata are rejected. Request bodies, response bodies, server headers, and request duration are bounded.
- Logout revokes the local session before contacting the provider. If upstream revocation fails, the session stays unusable and an encrypted revocation job is retained/retried. Expired provider access tokens can be refreshed server-side to finish revocation; invalid refresh tokens allow the pending session artifact to be removed. Deleting/revoking a session never touches financial records.

## Production host configuration still required

`backend/production-server.cjs` does not start on import. Its explicit launch requires:

| Setting | Purpose |
| --- | --- |
| `ROADLEDGER_ORIGIN` | Exact HTTPS browser origin, without a path |
| `SUPABASE_URL` | Reviewed HTTPS project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key; service-role/secret keys are rejected |
| `ROADLEDGER_SESSION_KEY` | Base64 encoding of 32 random bytes supplied by a server secret manager |
| `ROADLEDGER_SESSION_DIRECTORY` | Private persistent directory outside publicly served assets |
| `ROADLEDGER_TLS_KEY`, `ROADLEDGER_TLS_CERT` | Server TLS key/certificate file selectors, if TLS terminates here |
| `ROADLEDGER_TRUSTED_PROXY_IPS` | Alternatively, explicitly trusted reverse-proxy addresses; only these may assert HTTPS |

No production configuration values were created or filled in during this repair. Test keys were ephemeral fixtures only. Keep keys out of Git, browser scripts, ordinary JSON backups, and logs. `.gitignore` excludes common local secret/session artifacts. The app may be served statically; `/api/sync/` must route to this server on the same HTTPS origin. The disabled config now uses that absolute API path, avoiding subdirectory-relative routing mistakes.

The production server binds to `0.0.0.0` and the platform `PORT` (8080 if omitted), as Render requires. Public requests require direct TLS or a deliberately trusted HTTPS proxy; the non-sensitive `/healthz` probe is the sole transport-check exception. The loopback-only mock server is for development and must never be deployed. The `allowInsecureLoopbackForTests` factory option is used by tests only and is not exposed by the production launcher. Host/origin/proxy configuration must be verified in the actual deployment.

The encrypted file store is tested on a POSIX server filesystem (permissions and directory fsync); Windows browser clients are unaffected, but a Windows-hosted backend needs separate ACL/filesystem verification. It deliberately supports **one server process per session directory** and refuses a second live lease. This makes refresh rotation semantics explicit. For multiple instances/hosts, replace it with a shared encrypted session store and distributed atomic locking before scaling. After an unclean crash, inspect/remove the stale lease before restarting; do not remove a lease belonging to a running server. Keep a key-rotation, disk-full, session-revocation, and backup recovery procedure; losing the encryption key requires fresh sign-in and operator review of pending upstream revocations.

## Tests completed locally

- **`tests/database.cjs`**: Executes the actual migration in in-memory PostgreSQL via PGlite. Tests authenticated/anonymous/unverified users, owner-only table reads, denied direct mutations, cross-user records/cursors/receipts, stale updates, operation replay/misuse, tombstones/edit-delete protection, schema/key validation, private helpers, rerunning the migration without removing history, byte-limited pagination, and database quotas.
- **`tests/protocol.cjs`**: Invalid IDs/types/dates/Unicode, payload limits, preserved dangling links, count/byte page budgets, cursor gap/replay rejection, and response streaming bounds.
- **`tests/sessions.cjs`**: Uses loopback HTTP and a fictional provider. Tests secure cookie flags, identity/CSRF/origin checks, encrypted durable token storage, refresh serialization, host restart, cookie rotation, local sign-out/revocation retry, session tampering, account isolation, sanitized errors, and sign-in throttling.
- **`tests/pagination.cjs`**: Browser tests for 220 records including large payloads across multiple pages, atomic rejection/retry of malformed pages, no premature apply, and oversized local data retained in both localStorage and its queue.
- Existing provider, mock API, offline reload/reconnect, two-device conflict, interrupted apply, navigation, accounting, expense-link, backup/restore, and route/weather suites are also run.

Reproduce after installing the pinned **development-only** dependencies:

```sh
npm ci --ignore-scripts
npm run test:security
```

The browser tests need Chromium installed separately at `/usr/bin/chromium` in this workspace. `tests/README.md` describes the other suites and their local-server requirements. No test reads Supabase environment credentials or executes SQL on an external service.

## Verification still requiring an actual service/environment

1. Review the migration against the intended Supabase project/version, existing policies/functions, Auth configuration, and all legacy records. Do not assume the local emulator verifies deployed grants, project settings, JWT signature validation, or PostgREST behavior.
2. After separate authorization, run isolated staging database tests using real JWTs for two verified users, anonymous/unverified users, actual RLS roles, concurrent separate database connections, RPC error/status mapping, pagination, and rollback. PGlite is local PostgreSQL execution, not the managed Supabase platform or a multi-connection stress test.
3. Verify real token refresh/rotation, email/phone confirmation, password recovery, logout scope, upstream outage recovery, expiry, and session revocation. None of this work created user accounts, sent emails, or assumed credentials exist.
4. Verify HTTPS certificates, trusted-proxy boundaries, private persistent session storage, key management, process restart/lease recovery, monitoring and backups. Add perimeter request/abuse limits; the application limiter is single-process and database quotas do not bound all malformed requests or provider billing.
5. Test physical Windows/Edge/Chrome and iPhone/iPad Safari, suspension, cellular handoff, and browser storage eviction. Current mobile checks are Chromium viewport simulations.

Cloud remains disabled. Do not treat passing local tests as approval to deploy or permission to run the SQL against a live database.


## Authentication recovery and trusted client identities

Rotated access/refresh tokens are now written through the existing encrypted, atomic, fsynced session store **inside the per-session lock before** the next provider identity-verification request. A temporary verification outage leaves the rotated credentials available for retry and restart; it does not authorize the session without verification. Concurrent requests reuse the committed credentials rather than rotating the same old token twice. Every authenticated request still verifies the permanent account and original user identity. If persistence fails, the request fails closed before verification or a protected operation. A disk failure or process termination between provider rotation and durable storage can still require reauthentication: no local filesystem transaction can atomically commit with a remote token service.

### Proxy trust and login throttling

- `ROADLEDGER_PROXY_MODE=render` requires Render's injected `RENDER=true` and `RENDER_SERVICE_ID`. HTTPS forwarding is trusted only under the explicit Render ingress/network assumption; do not enable it on an Internet-accessible standalone HTTP listener. `X-Forwarded-Proto` must be exactly `https`. For a controlled non-Render proxy, use exact `ROADLEDGER_TRUSTED_PROXY_IPS` for HTTPS assertions or direct Node TLS. CIDRs below authorize client-chain traversal, not HTTPS assertions.
- `ROADLEDGER_CLIENT_IP_MODE=auto` is the default. Direct connections use their socket address and ignore forwarding headers. Render traffic (and explicitly trusted proxy peers) uses **per-account throttling only** until the proxy chain is verified. The ingress address is never substituted as a driver address, so unrelated drivers do not share its 20-attempt bucket. This fallback retains five attempts per account per 60 seconds but lacks a cross-account per-client limit; the production launcher therefore refuses to enable Render cloud authentication until `trusted-chain` is explicitly configured; use provider/perimeter abuse controls as well.
- After verifying the real staging ingress, use `ROADLEDGER_CLIENT_IP_MODE=trusted-chain` and configure **all actual trusted proxy hops**, including the immediate socket peer, through `ROADLEDGER_TRUSTED_PROXY_IPS` (comma-separated exact IPs) and `ROADLEDGER_TRUSTED_PROXY_CIDRS` (comma-separated verified networks). No Render/Cloudflare address, hop count, private network range, or header-replacement guarantee is guessed or automatically downloaded. Do not use Render outbound addresses as inbound proxy identities. Do not trust broad networks containing end users or untrusted tenants. `/0` ranges are rejected.
- In trusted-chain mode, an untrusted immediate peer cannot assert HTTPS and fails sign-in closed. The bounded `X-Forwarded-For` chain is parsed as IP addresses, traversed **right to left**, and traversal stops at the nearest untrusted address. Client-controlled prefixes to its left are not consumed. Missing, malformed, overlong, and all-trusted/no-client chains are rejected. `Forwarded`, `X-Real-IP` and `CF-Connecting-IP` cannot override identity. IPs are canonicalized, including equivalent IPv6 spellings and IPv4-mapped IPv6 socket addresses.
- Verified client addresses have 20 attempts per 60 seconds across accounts; normalized account names have five attempts per 60 seconds across clients. Buckets store hashes, not raw addresses/account names. All applicable buckets are checked before any are incremented. Restart clears this single-process in-memory limiter; distributed deployments require a shared limiter/store. Drivers genuinely sharing one public NAT address can share its client limit; distinct drivers behind Render's ingress do not all share the ingress bucket.

Render recommends `X-Forwarded-For` for client IPs, but a header alone is not proof of provenance. References: [Render edge and client-IP guidance](https://render.com/articles/how-render-handles-ddos-attacks), [MDN security guidance for trusted proxy chains](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For). Real Render peer addresses, chain rewriting/appending, multiple ingress routes, and spoofing resistance still require separately authorized staging verification. Environment flags are deployment configuration, not cryptographic proof of network origin.

`tests/auth-recovery.cjs` reproduces rotation followed by a temporary identity outage with strict single-use refresh tokens. It checks persistence before verification, restart/retry beyond a reuse grace window, concurrent recovery, encryption, disk-write failure and identity mismatch. `tests/proxy-identity.cjs` reproduces more than 20 independent drivers behind one ingress and checks trusted chains, spoofed prefixes/alternate headers, malformed chains, canonical IPs, account/client limits, window reset and safe account-only fallback. These tests use fictional providers and records; they execute no SQL.

Run `npm run test:auth` for these and the existing session suite. **`npm run test:security` includes `tests/database.cjs` and executes the SQL locally; do not run it without separate SQL authorization.** The database migration suite was not rerun for this authentication repair.
