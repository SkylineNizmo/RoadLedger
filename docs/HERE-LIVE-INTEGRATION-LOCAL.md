# HERE integration foundation — local review

Base: fc4e0921d20b84339de9389001ba36710a6bb691, feature/here-navigation.

## Readiness

Local transport development is possible. Live routing is **NO-GO**. The existing
service deliberately accepts only branded mock authentication and providers on
loopback. No production identity, deployment topology or distributed quota store
exists on this branch. The frontend remains disabled, with all sample-route
NOT SAFE FOR REAL NAVIGATION labels unchanged. No credentials were provisioned,
read from the runtime, or transmitted; no provider calls were made.

GitRightLedger registration and replacement-key revocation are user observations,
not independently verified account evidence. Keep the public application name.

## Implemented scope and exact files

- backend/navigation-here-transport.cjs: isolated, server-only geocoding transport
  foundation. Explicit constructor enablement and a supplied server environment
  containing HERE_API_KEY are both necessary. Default construction never reads
  the key. The eventual server composition must pass process.env; no frontend
  environment substitution or build-time key binding is allowed.
- tests/navigation-here-transport.cjs: injected transport tests; no HTTP requests.
- docs/HERE-LIVE-INTEGRATION-LOCAL.md: this scope and remaining work.

The transport is intentionally not registered with the mock service and has no
launcher. Fixed HTTPS origin/path; TLS certificate verification; no redirects,
retries or arbitrary request fields; identity encoding; five-second deadline;
256 KiB streaming cap; strict UTF-8/JSON; whitelisted geocoding results; generic
errors without URL/key/provider body. Abort signals are supported. Response
addresses remain private and must never be logged. Geocoding results still need
explicit candidate and entrance confirmation before routing.

The geocoding endpoint/shape is a candidate integration contract tested against
fixtures, not a freshly verified provider response. Routing v8 endpoint is listed
but route execution deliberately rejects HERE_PARAMETER_REVIEW_REQUIRED before
network dispatch. This is not a completed live routing implementation.

## Required contract and account verification

Before supplying credentials, an operator must verify in HERE Platform for the
GitRightLedger app: Routing v8 truck entitlement, Geocoding/Search entitlement,
regions/coverage, API-key authentication support and restrictions, current prices,
transactions/route billing definitions, rate limits, overage/budget alerts, usage
reporting and map-display/caching terms. Registration alone proves none of these.
No billing changes are authorized here. Never send the replacement key in chat.

Review current HERE Routing v8 reference and retain its version/date for:
transportMode=truck; return=polyline,actions,instructions,summary; origin,
destination and via coordinates; vehicle height/width/length centimetres;
actual loaded mass kilograms and exact currentWeight versus grossWeight
semantics; axleCount/trailerCount support and limits. These fields remain neutral
in navigation-contract.cjs. Do not infer axle weights, use GVWR as loaded weight,
or silently omit an unsupported safety-relevant measurement. All combination
measurements require driver confirmation. Road restrictions, entrances, notices,
road signs and local conditions still require judgment; never claim clearance safety.

## Next implementation sequence (requires further work, not provisioning now)

1. Verify current official parameter contract and entitlements. Current runtime
   has no HERE identity/secrets and does not list HERE hosts in its allowlist;
   no attempt was made to call those hosts or bypass network policy.
2. Add a verified truck serializer and separately validated real-route parser.
   Do not set simulation:true on real responses to reuse the fixture parser.
   Validate every section, maneuver offset and warning, then render text using
   textContent, never provider HTML. Account for multi-section geometry offsets.
3. Implement real server authentication/session revocation and CSRF with an
   approved same-origin TLS pilot. Mock identities must never authorize this
   transport. GitHub Pages cannot keep keys or execute Node proxy code. Cross-
   origin Pages authentication, especially Safari cookies, remains unresolved.
4. Integrate durable atomic account/global quotas, concurrency, receipts and kill
   switch before registering the transport with the authorized service. Existing
   per-process mock counters reset/restart and are not an absolute spending cap.
   Reserve quota before dispatch, including geocoding; no automatic retry. Redact
   proxy/access/APM URLs because HERE API-key query strings are sensitive.
5. Add capability-gated frontend geocoding and real route adapter only after the
   preceding gates pass. Preserve separate sample mode; never fall back silently
   from failed live routes to a sample. Preserve latest-request and cancellation
   guards, equipment confirmation and private-record storage boundaries.
6. Visual maneuver progression, spoken directions with explicit user-start and
   mute/unmute, and off-route rerouting are **not implemented** by this change.
   Design accuracy/freshness gates, distance-to-route hysteresis, reroute debounce,
   single in-flight route, new driver confirmation when vehicle changes, and quota
   admission for every reroute. Do not trigger reroutes from poor/stale GPS.
7. Approved isolated pilot tests must cover actual provider schema/errors/429,
   permissions/revocation, key rotation, quota restart/multi-instance behavior,
   iPhone/iPad Safari speech gestures and interruptions, Windows GPS and foreground
   navigation. Browser/PWA locked-screen/background GPS is not guaranteed; existing
   hidden/pagehide watcher cleanup remains intact.

## Preservation and validation

No existing source files, GPS, equipment data, UI, service worker, personal/cloud
sync configuration or unrelated branches were edited. Existing mock mode remains
available offline. This transport module must not be included in static publishing.

Fresh targeted validation: navigation-here-transport, navigation-proxy,
navigation-live, here-navigation and here-navigation-browser suites. Syntax and
whitespace checks are recorded in the final report. All network behavior in new
transport tests is injected; browser tests use mocked GPS/weather/tiles. No claim
of physical-device or real HERE verification follows from these tests.

## Next local stage: Routing v8 boundary (2026-10-26)

The three existing uncommitted foundation files were retained and extended, not
restarted. This section supersedes earlier statements that there is no real-route
parser. No credentials or provider requests are needed by these tests.

### Documentation evidence and verification limits

Official documentation attempted:
https://www.here.com/docs/bundle/routing-api-developer-guide-v8/page/topics/use-cases/truck-routing.html
The configured proxy rejected the CONNECT with HTTP 403. No bypass was attempted.
The official HERE-owned GitHub example was read successfully:
https://github.com/heremaps/maps-api-for-javascript-examples/blob/master/truck-routing-road-restrictions/demo.js
Its corresponding raw master file, retrieved 2026-10-26, uses transportMode truck,
return polyline, spans truckAttributes, vehicle[axleCount]=4,
vehicle[trailerCount]=1, and vehicle[hazardousGoods]=flammable. This example is
partial evidence, not a complete current parameter reference or entitlement.
Dimension fields/units/limits, currentWeight/grossWeight semantics, per-axle
restrictions, tunnel categories and other restrictions remain unverified here.
No unsupported parameter is emitted. Hazardous cargo is not accepted merely
because one example names it: complete validation/driver confirmation is missing.
No subscription/account settings were inspected.

### Implemented boundaries

backend/navigation-here-route.cjs validates the original strict request contract,
including fresh confirmed GPS, actual loaded measurements, axle/trailer counts,
stop count and unknown-field denial. The builder then deliberately throws
HERE_PARAMETER_REVIEW_REQUIRED. No caller flag can override the incomplete
contract. This is a fail-closed request-builder scaffold, not a functioning truck
serializer. The server transport now invokes this gate before any truck dispatch.
Geocoding remains isolated from the mock service as previously documented.

The separate real-response parser does not relabel provider data as simulation.
It validates all alternatives, truck-only vehicle sections, bounded 2D flexible
polylines, summary numbers, action offsets/instructions and notice code/title/
severity. It adjusts maneuver offsets across sections, whitelists output and
retains a permanent no-clearance-guarantee warning. Missing notice titles get a
code-based warning, never silently disappear. Unsupported ferry/non-truck sections,
3D geometry, excessive geometry and missing instructions fail closed. These
conservative limits can reject legitimate provider routes and need reference and
staging verification before use. No HTML is rendered by this module.

roadledger-navigation-live.js now exposes a pure prepareRouteDisplay function for
normalized real geometry/maneuvers/warnings. It clones and validates positions,
counts and fields; guidanceEnabled is always false. It does not start GPS, fetch,
write storage, speak instructions or enable rerouting. A future renderer must use
textContent for every provider string. The existing adapter and disabled selector
are unchanged; the real display model is not attached to the UI. Mock mode and
all NOT SAFE FOR REAL NAVIGATION warnings remain intact.

sw.js changes only the static shell version to here-route-boundary-v1 so a future
reviewed release could refresh the changed adapter. No cache policy, API exclusion,
activation behavior, asset list or record cleanup changed. No deployment occurred.

### Exact cumulative uncommitted inventory (7)

1. backend/navigation-here-transport.cjs (retained, route gate added)
2. tests/navigation-here-transport.cjs (retained, abort/deadline coverage added)
3. docs/HERE-LIVE-INTEGRATION-LOCAL.md (retained, this stage added)
4. backend/navigation-here-route.cjs (new builder gate/parser)
5. tests/navigation-here-route.cjs (new isolated contract/parser/display tests)
6. roadledger-navigation-live.js (pure display-model preparation)
7. sw.js (static cache version only)

### Validation and release status

Run the six navigation suites: navigation-here-route, navigation-here-transport,
navigation-proxy, navigation-live, here-navigation, here-navigation-browser. New
transport tests inject responses/errors/redirects/quota failures/oversize data,
pre-dispatch cancellation, in-flight cancellation and five-second timeout. Route
tests cover two-section geometry/maneuver offsets, instruction/warning retention,
no route, wrong mode, malformed/overlarge data, unsupported specifications,
immutable inputs and no dispatch when parameters remain unverified. Existing
proxy tests cover rate/quota/concurrency/replay controls and browser regressions
cover records, equipment, GPS and offline behavior. No test uses HERE services.

Live routing remains NO-GO. Official full contract and account entitlements,
real server identity/CSRF/TLS topology, durable multi-instance usage controls,
reviewed route serializer, actual provider parsing tests, real frontend rendering,
visual progression, speech/mute and rerouting, physical-device behavior and
approval for isolated provisioning/testing are all outstanding. Local fixtures
are not actual HERE or Safari verification and do not establish clearance safety
or an absolute spending cap. Production/cloud features remain disabled.

Fresh results for this stage: 6/6 targeted suites passed, 30 JavaScript/CJS syntax
checks passed (including vendored JavaScript), targeted credential-pattern and
whitespace checks passed. Browser suite passed desktop/phone/tablet viewports;
this is Chromium simulation, not physical Safari. The entire historical 25-suite
Phase 1 harness was not rerun in this stage. All seven files remain uncommitted.

## Reference clarification and field-level audit (2026-10-26)

New official URLs supplied by the operator:
- https://docs.here.com/routing/reference/routing-api-v8-calculateroutes
- https://docs.here.com/routing/llms.txt

Both requests were rejected by the configured proxy at CONNECT (403; curl HTTP
result 000), so no reference markdown or schema was retrieved. No alternative
proxy/credentials or policy change was attempted. The official HERE-owned GitHub
truck example was independently retrieved again. It confirms parameter names and
example values, not complete ranges or semantics. The operator's verified GET
endpoint, vehicle-over-truck deprecation and return/action dependency statements
are recorded as userReported evidence, distinct from independently read evidence.
There is no newly independently verified dimension or weight mapping in this run.

| Local field | Established locally | Still required from reference |
| --- | --- | --- |
| heightFt | exact feet-to-cm conversion, upward rounding | API field, units, bounds, full combination definition |
| widthFt | exact feet-to-cm conversion, upward rounding | API field, units, bounds, mirrors/projections definition |
| lengthFt | exact feet-to-cm conversion, upward rounding | API field, units, bounds, coupled-combination definition |
| actualLoadedWeightLb | exact pounds-to-kg conversion, upward rounding | currentWeight vs grossWeight meaning, actual vs permissible mass, trailer inclusion, units and bounds |
| axleCount | local integer 1–30; example names vehicle[axleCount] | tractor-only vs combined count, trailer inclusion and provider range |
| trailerCount | local integer 0–1; example names vehicle[trailerCount] | provider range, trailer definition, additional trailer properties |
| axle loads | no values inferred or collected | supported aggregate/per-axle/group fields, units, bounds |
| restrictions | no dangerous-goods/tunnel claims collected | full supported enum/combination semantics and required inputs |

Local ranges are not HERE limits. Example hazardousGoods=flammable does not verify
all accepted cargo categories or enable that request field. No gross mass divided
by axle count, permissible mass substituted for actual mass, or default zero is
allowed. Independent physical conversion facts do not establish API units.

The server module now exports inspectTruckRequest for local diagnostics: strict
validation, immutable neutral converted measurements, ready:false,
requestParameters:null, and an explicit eight-item unresolved contract list.
It returns no coordinates/addresses in the report and performs no I/O. This is not
an HTTP endpoint and is not logged. buildTruckRequest uses it and still rejects
before dispatch, including when passed enabled/verified flags. No partial truck
request can accidentally discard the unverified safety-relevant measurements.
The existing parser, disabled frontend, cache policy, GPS and other features are
unchanged in this follow-up. No new mapping was guessed to bypass documentation.

Only these existing uncommitted files were edited in this follow-up:
backend/navigation-here-route.cjs, tests/navigation-here-route.cjs and this file.
The cumulative inventory remains seven files; all previous work was retained.
Tests now assert exact/upward conversions at fractional boundaries, rejection of
extra precision, nonfinite/zero/missing/non-numeric/oversized measurements,
unknown gross/current/per-axle/trailer/tunnel specifications, immutable diagnostics,
no parameters emitted, no dispatch, and no flag-based override.

Next evidence needed: the vehicle schema and property descriptions from the
supplied official reference (including units/ranges), obtained through approved
documentation access or an operator-provided public documentation export. Do not
provide credentials. Account entitlements cannot be inferred from documentation.
Live routing remains NO-GO for all previously documented security, quota,
provider-contract, UI-guidance and physical-device blockers.

## Supplied Vehicle Properties evidence: limited preview mapping

The operator supplied official guide excerpts from:
https://docs.here.com/routing/docs/routing-v8-vehicle-properties
https://docs.here.com/routing/docs/routing-v8-network-restricted-truck
and the calculateRoutes reference already listed above. These are attributed
operator-supplied documentation excerpts; no new HERE network access was attempted.

The explicit statement height=270 means 2.7 metres establishes centimetres for
vehicle[height]. trailerCount=1 represents one trailer. The diagnostic now includes
an immutable documentedVehiclePreview containing only converted vehicle[height]
and vehicle[trailerCount]. It is not a runnable request: requestParameters remains
null and ready remains false. Height uses the existing exact rational conversion
and upward rounding. This preview is never consumed by the transport or browser.
Existing driver confirmation is retained; guide language that *most* towing fields
represent the combination is not treated as proof of each property's scope.

The supplied example (height 420, width 250, length 2000, currentWeight and
grossWeight both 50000, axleCount 8, trailerAxleCount 4, trailerCount 1) establishes
example spelling/values, not every unit, definition, range or relation. In
particular, equal example weights do not prove currentWeight and grossWeight are
interchangeable. No weight, width, length, axle or trailerAxleCount mapping is
emitted. We do not infer tractor axles by subtraction or per-axle load by division.
The existing profile has no separately confirmed trailer axle field or permissible
mass input; these cannot be synthesized from the saved total-axle/loaded-weight
fields. Exact definitions and bounds must precede any UI/schema extension.

Remaining contract blockers: dimension bounds and exact combination measurement
rules; width/length units and mirror/projection/coupling rules; weight units,
current vs permissible/gross definitions and combination scope; total versus
tractor axleCount and trailerAxleCount relation/ranges; trailer limits and other
restrictions. Entitlements, regional coverage, pricing, real authentication and
durable quota safeguards remain unverified. No absolute spending cap is claimed.

Changed in this follow-up: backend/navigation-here-route.cjs,
tests/navigation-here-route.cjs, docs/HERE-LIVE-INTEGRATION-LOCAL.md. All seven
cumulative uncommitted files are preserved. No GPS/UI/service-worker changes were
made in this follow-up. Live routing remains NO-GO; the builder still rejects
before dispatch, including callers passing verification flags.

Fresh follow-up validation: all six targeted suites passed, including desktop,
phone and tablet Chromium regressions; all 30 JavaScript/CJS syntax checks passed.
Seven-file whitespace and targeted credential-pattern checks passed. Tests verify
height fractional/upward rounding, immutable preview, absent unverified fields,
and blocked dispatch. Full historical regression was not rerun. No real provider,
physical Safari/device, account-entitlement or production verification occurred.

## Local fixture guidance panel

A separate demo controller/panel is mounted below the existing planner. It does
not read actual GPS, route input or equipment measurements. Start demo loads a
fixed three-step sample; Next maneuver explicitly advances it. Supplied fixture
values show distance to maneuver and remaining distance/time. They are not
measurements from GPS or live ETA and do not update automatically with driving.
Every state is headed DEMO / SIMULATION — NOT SAFE FOR REAL NAVIGATION. No
truck restriction or clearance is validated.

Speech starts muted on each start/resume and requires explicit Unmute. Utterances
begin with the spoken demo/no-navigation warning. Visual text remains available
when speech is absent or errors. Muting, stop, simulated off-route, page hiding,
pagehide and leaving the Road Weather tab cancel owned speech and pending work.
Browser speech cancellation is synthesis-wide: when this controller has an owned
utterance it calls cancel(), which can also interrupt other same-page speech.
No voice is selected or downloaded by code; speech availability/voice execution
can depend on the browser/OS and is not guaranteed offline or in the background.
No navigation data, voice state or fixture progress is persisted.

Off-route is an explicit simulation button, not a GPS detector. States are active
-> rerouting-demo -> no-alternate. There is no provider call or alternate-route
claim. Resume original fixture is explicit, preserves the selected sample step,
and returns muted. Stop/dispose invalidates pending callbacks; delayed results
cannot restart the demo. No timers advance the fixture automatically. Completing
the fixture ends guidance. Real GPS lifecycle, map follow/browse, equipment and
personal sync code were not repurposed. Backend fail-closed gates remain intact.

### Exact cumulative uncommitted inventory (12)

1. backend/navigation-here-route.cjs (earlier work preserved)
2. backend/navigation-here-transport.cjs (earlier work preserved)
3. tests/navigation-here-route.cjs (earlier work preserved)
4. tests/navigation-here-transport.cjs (earlier work preserved)
5. roadledger-navigation-live.js (earlier disabled boundary preserved)
6. docs/HERE-LIVE-INTEGRATION-LOCAL.md (this report appended)
7. sw.js (demo static shell asset and version; API/cache policy unchanged)
8. roadledger-navigation-demo.js (new isolated controller/panel)
9. tests/navigation-demo.cjs (new lifecycle/speech/reroute tests)
10. index.html (load demo module)
11. roadledger-gps.js (mount demo panel only; GPS logic unchanged)
12. tests/here-navigation-browser.cjs (demo controls and speech mock coverage)

### Validation and limits

Seven targeted suites passed, including the new demo controller tests and the
existing navigation/transport/security/browser suites. Browser checks run desktop,
phone and tablet sizes with mocked speech, GPS, weather and tiles and real local
Leaflet. They exercise manual fixture progression, speech mute/unmute/cancel,
simulated rerouting/recovery, stop during pending recovery, pagehide cleanup and
unchanged GPS watcher counts, map route and records. Existing offline reload and
localStorage/IndexedDB queues/conflicts/archive preservation checks pass. Syntax
checks cover 32 JavaScript/CJS files including vendor. Targeted credential-pattern,
static shell closure and whitespace checks pass. Full historical regression and
physical Windows/iPhone/iPad speech/GPS/background behavior are not verified here.

Real guidance remains NO-GO: full HERE vehicle contract/entitlements, real server
authentication, durable quotas and isolated provider validation are still missing.
Real progress detection, off-route detection, alternate routing, live geometry UI
and safety-reviewed speech timing are not implemented by this demo. No new
network provider, credentials, cloud feature, billing or deployment was enabled.

## Final local checkpoint review

The final review reran 28/28 suites in the temporary Phase 1 regression harness,
including all seven current navigation suites. All passed. Only the temporary
harness static allowlist was extended for the new demo module; no production
backend configuration changed. Its servers were loopback-only and stopped after
tests. Database tests used disposable local emulation, not external SQL.
All 32 JavaScript/CJS syntax checks, 30 static shell entries, nine unchanged
vendor-file hashes, 12-file whitespace and targeted credential-pattern checks
passed. Browser checks covered desktop/phone/tablet Chromium with mocked GPS
and speech. Physical-device and real-provider limits remain as documented.
Only the 12 inventoried files are included in the authorized local checkpoint.
No API keys, local configuration or personal records are included.
