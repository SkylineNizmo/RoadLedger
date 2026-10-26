# Navigation proxy skeleton — LOCAL ONLY

Base: `feature/here-navigation` at `b69b2fcf4ba5272e1dad15a0a942981e9735a438`.
Final local review passed; the reviewed checkpoint is authorized for a local
commit. Deployment and real-provider activation require separate approval. It does not alter the separate radar or
maintenance branches. There is no HERE network transport, credential binding,
production identity, billing activation, migration or external service change.
The existing cloud-sync configuration remains disabled.

## Gates and architecture

`backend/navigation-service.cjs` is a separate handler, not an addition to the
fleet/sync BFF. Its default mode returns 503 without authentication/provider
execution. The only other accepted mode is `local-mock`; `live` is rejected.
Local mode requires a loopback HTTP origin, matching Host and Origin, a loopback
socket, and the actual mock-auth/mock-provider objects created by these modules.
Arbitrary objects claiming the same kind are rejected. No forwarded identity or
proxy headers are trusted. The launcher binds only 127.0.0.1 on an ephemeral port.
There is no deployment manifest or production launcher configuration added.

```
node backend/navigation-server.cjs
```

This starts a disabled, loopback-only skeleton, printing only its local origin
and disabled status. It cannot enable HERE or mint a session through HTTP.
Stop with Ctrl+C. Local automated tests use
`startLocalNavigation({enableMock:true})` and issue fictional sessions directly
through the returned in-process fixture auth object. Do not expose this service,
its test authentication or a local development port to other devices/the internet.
No manual account login or private key is needed or supported.

The mock provider returns fixed HERE-shaped fixtures. Its behavior/error options
are constructor-only local test settings; incoming JSON cannot select a scenario,
provider, URL, headers or identity. It imports no HTTP client. The existing
browser simulation still runs directly and offline without the proxy.

## Fixed contract

Only POST `/api/navigation/geocode` and POST `/api/navigation/route` exist.
Queries, alternate paths, unsupported methods and unknown JSON fields are denied.
CORS is intentionally unsupported: no wildcard, credentials or allow-origin
headers; this models a same-origin pilot, not a working cross-origin Pages login.

Both endpoints require a random, RAM-only mock-session cookie plus its matching
CSRF token in `X-Navigation-CSRF`, exact Origin/Host, and
`X-RoadLedger-Navigation: 1`. Session expiry/revocation and the operation-specific
`geocode`/`route` scope are checked before body handling, again before admission,
and after the provider result, including replay. Client user/role headers do not
authorize access. There is no HTTP login/session-issuance route. Session fixtures
are bounded to 32 sessions/eight fictional identities; they are not real accounts,
JWT validation, MFA or fleet authorization. Expired sessions are removed.

- Geocode JSON: exactly `{requestId, query}`; nonempty query <=500 characters,
  no controls. It returns up to five fixed sample candidates, not search results.
- Route JSON: exactly `{requestId, origin, destination, stops, vehicle, confirmed}`.
  Origin contains numeric latitude/longitude/accuracy/timestamp. It must be fresh
  within 30 seconds, no more than five seconds in the future, and <=100 m accuracy.
  Destination/stops are explicit coordinate pairs; up to five stops. The local
  browser simulation still permits 20 text stops; no text is silently geocoded or
  truncated by this separate contract.
- Vehicle: exactly `heightFt,widthFt,lengthFt,actualLoadedWeightLb,axleCount,
  trailerCount`, all numeric; dimensions >0 and <=1000 ft, mass >0 and <=1,000,000 lb,
  whole axles 1–30 and trailer count 0–1. At most three decimal places for converted
  values. These are conservative local planning input bounds, not HERE limits.
- `confirmed` must be the boolean true. This is a driver assertion, not proof of
  actual physical measurements, authorization or regulatory compliance.
- Request IDs are 8–80 ASCII letters/digits/dashes/underscores. They are opaque
  idempotency identifiers, not authorization. Reusing one with changed normalized
  input returns 409. Freeze the body and ID when retrying the same action.

Exact rational arithmetic with BigInt converts feet to centimetres (x30.48) and
actual loaded pounds to kilograms (x0.45359237), rounding upward. For example,
14 ft ->427 cm, 8.5 ft ->260 cm, 60 ft ->1829 cm and 40,000 lb ->18,144 kg.
The normalized fields are deliberately neutral (`heightCm`, `actualLoadedMassKg`,
etc.). No `vehicle[currentWeight]`/`vehicle[grossWeight]`, axle-load or other
unverified HERE parameter is guessed or emitted. Unknown GVWR/rating fields are
rejected rather than substituted for actual mass. No per-axle load is inferred
by dividing gross mass. Actual provider serialization remains absent.

Responses always identify simulation and `safeForNavigation:false`. Successful
responses contain only whitelisted fixture geometry, summaries, instructions,
notices or sample geocoding candidates. All supplied route alternatives are
validated. Private/unknown provider fields are discarded. The fixed route still
ignores the requested destination/origin/stops, with NOT SAFE FOR REAL NAVIGATION
warnings. Bad responses, provider exceptions and empty routes return controlled
codes without echoing raw errors or input.

## Resource, replay and cancellation controls

Defaults (mock policy values, NOT HERE account allowances):

| Control | Default |
| --- | --- |
| JSON request | 16 KiB, strict UTF-8, no compression |
| Body deadline | 2 seconds |
| Provider deadline | 2 seconds |
| Serialized fixture response | 256 KiB |
| All incoming requests (including unauthenticated) | 120/global fixed minute |
| Authenticated arrival rate | 10/account and 40 globally per fixed minute |
| Daily total admitted operations | 25/account, 100 globally, UTC |
| Additional global product ceilings | 100 geocodes, 50 routes/day |
| Concurrent provider jobs | 2/account, 4 globally |
| Concurrent body readers | 16 |
| Receipt slots | 64; 30-second replay retention after completion |

Every enabled-handler request counts against the ingress cap before auth.
Malformed authenticated input/replays also count against the authenticated
arrival rate. Quota is reserved only for a newly admitted provider job. Admission
checks and all counter increments are synchronous without an intervening await.
Quota reservation covers the combined global total and individual product ceiling.
Server budget time never moves backward when the OS clock rolls back. Quota is
not refunded on cancellation, error or timeout: a future real provider might
already have charged. These counters are per-process RAM; restart loses them and
multiple processes do not share them. They are not a production spending guarantee.

Receipts are scoped by fixture account, operation and request ID, with a SHA-256
normalized-input fingerprint. Concurrent identical requests share one execution;
different payloads conflict. Replays still require current session/scope/CSRF.
Capacity exhaustion fails closed; unresolved jobs are not pruned. Completed
receipts expire on later request activity. Success/error bodies remain in bounded
RAM only; there is no disk/database/log cache of requests or routes. Replay
protection is bounded to that retention/process lifetime, not permanent billing
idempotency.

A disconnected duplicate waiter does not cancel another waiter. Losing the last
waiter aborts the provider job. Deadline/cancel returns a controlled result, but
concurrency remains reserved until the actual underlying promise settles, even
if the fixture ignores AbortSignal. Late responses cannot replace an already
failed/timed-out result. Partial bodies time out/cancel without leaking reader
slots or causing unhandled request-stream errors. The HTTP launcher also bounds
headers, connections and request time. If a provider never settles, its slot
remains unavailable; that safe failure needs monitoring/recovery in a real system.

No raw request/error/URL/body logs exist. Stats contain counters only. Error JSON
contains fixed codes/messages, not coordinates, addresses, cookies or CSRF tokens.
The launcher prints only its generated loopback origin. Future real HTTPS response
streaming must enforce byte limits before JSON allocation; this stage bounds only
already-created local fixture objects, because it has no network transport.

## Frontend boundary and preservation

`roadledger-navigation-live.js` exposes a frozen, disabled adapter. Both calculate
and geocode reject before reading/serializing input or using networking. No option,
credential, environment flag or constructor argument can enable it. The GPS UI
shows a disabled HERE connection option and selects the local mock by default.
Even changing the select programmatically goes through the disabled adapter,
clears old sample data and makes no API request. No proxy mock authentication is
wired into the browser or persisted there.

Every existing SIMULATED/NOT SAFE FOR REAL NAVIGATION label remains. Tracking,
shared fresh fixes, browse/follow and equipment confirmation are unchanged. There
are no writes to equipment, records, backups, localStorage or IndexedDB by these
new modules. Existing sync transport remains null. Nothing is automatically
uploaded. The service-worker shell is versioned `here-proxy-local-v1` and adds
only the new static adapter; all 29 static entries remain available offline.
The existing waiting-update, same-origin static-only cache and API exclusions are
preserved. There is no skipWaiting, private-response cache or record cleanup.

## Exact changed-file inventory (13)

1. `backend/navigation-contract.cjs` — strict local schema/conversions/response filter.
2. `backend/navigation-mock-auth.cjs` — RAM-only fictional session fixtures.
3. `backend/navigation-mock-provider.cjs` — bounded fixed geocode/route fixtures.
4. `backend/navigation-service.cjs` — disabled handler, protections and accounting.
5. `backend/navigation-server.cjs` — loopback-only disabled launcher/test harness.
6. `roadledger-navigation-live.js` — disabled browser boundary.
7. `roadledger-gps.js` — disabled connection selector/adapter selection.
8. `index.html` — load the disabled adapter before GPS.
9. `sw.js` — static adapter and new shell version.
10. `tests/navigation-proxy.cjs` — contract and real-loopback HTTP security tests.
11. `tests/navigation-live.cjs` — fail-closed adapter tests.
12. `tests/here-navigation-browser.cjs` — disabled-option bypass/offline regression.
13. `docs/HERE-NAVIGATION-PROXY-LOCAL.md` — this report.

## Local testing

```
node tests/navigation-proxy.cjs
node tests/navigation-live.cjs
node tests/here-navigation.cjs
NODE_PATH=/workspace/RoadLedger/node_modules node tests/here-navigation-browser.cjs
```

HTTP tests exercise actual loopback requests, constructor/default gates, rejected
Host/Origin/CSRF/sessions/scopes, expiry/revocation during work/replay, malformed
JSON/UTF-8/schema, input/body/response limits, unit conversion, unknown fields,
account-scoped replay/conflicts, quotas, mixed-product total caps, concurrent
admission, shared-request cancellation, last-waiter abort, ignored-abort timeouts,
reader cleanup and private-error filtering. Mock identities are fictional; these
are not real JWT, MFA, tenant/RLS or provider-security tests. Host tests use Node's
raw HTTP client because fetch overrides custom Host in this environment; the test
was corrected to send the actual hostile header rather than weaken the check.

The updated browser regression uses real Leaflet/Chromium with mocked GPS/weather
and tiles, covers desktop/phone/tablet, the disabled selector (including devtools
changes), no HERE/backend call, unchanged records/queues/conflicts/archives, and
offline reload. It does not certify Safari, Windows hardware or location sensors.
The Phase 1 regression harness in a temporary copy runs 21 original suites plus
four navigation suites. Its test-only public asset allowlist includes the added
adapter; no production backend is modified. Final validation: 25/25 suites passed (21 existing Phase 1 suites + four
navigation suites), all 26 JavaScript/CJS syntax checks, all 29 static shell
entries, eight unchanged vendor hashes, targeted credential patterns, whitespace
and the 13-file inventory passed. The v4 -> here-proxy-local-v1 worker-upgrade
check preserved legacy datasets, payment status/theme and IndexedDB operation
IDs/conflicts/archives, then reopened offline. No failing tests remain. Vendor
assets are unchanged in this stage.

## Blockers before any real HERE connection

1. Separate review/approval for implementation, credentials and an isolated pilot.
   No current change enables production or asks for private keys in chat.
2. Real authenticated identities, revocation/expiry and server permissions. Do not
   deploy this mock auth. The existing fleet BFF/cloud-sync gate and its unresolved
   production requirements are not bypassed or repurposed.
3. Approved TLS hosting and same-origin pilot topology; if keeping GitHub Pages,
   separately design cross-origin identity/CORS without relying on third-party
   cookies in Safari. CORS/origin checks alone do not protect a paid proxy.
4. HERE account/product entitlements, current contract/parameter units and weight
   semantics, truck coverage, map-display/cache terms and real per-product prices,
   limits, trial/overage settings and administrative controls. No exact allowance
   is inferred from these fixture budgets. No purchase/billing change occurred.
5. Server-held scoped secrets, rotation/recovery, fixed HTTPS upstream hosts,
   redirect/SSRF protection, bounded response streaming, raw-URL/error redaction,
   audited geocoding/route serialization and real-provider tests. This code has no
   such transport and must not be presented as a deployable real proxy.
6. Durable atomic distributed quotas/idempotency, trusted clock/identity/IP policy,
   multi-instance/restart behavior, upstream cancellation accounting, alerting and
   kill switches. Rate/quota maps here cover only one local process.
7. Explicit geocoding candidate/entrance confirmation and a real response parser;
   never change a real response to `simulation:true` or relabel fixtures as live.
   A 100 m demo fix is not a proven navigation-quality accuracy threshold.
8. Physical-device tests and independent foreground guidance/speech/rerouting
   review. Background/locked-screen browser tracking remains unsupported here.
9. Deployment packaging: backend/tests must not be bundled into a public static
   release. GitHub Pages serves files; it does not execute/protect this Node code.
   No build/deployment is performed by this stage. Existing live Pages, weather
   Worker, Render, Supabase and the private backup are untouched.

Conclusion: the final local review passed with a fresh 25/25-suite rerun,
26 syntax checks, security/static checks and the offline upgrade check. The
13 reviewed files are authorized for a local commit. **Real HERE enablement
remains NO-GO**; no publication or deployment is authorized.
