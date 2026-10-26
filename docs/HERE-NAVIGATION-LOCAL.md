# HERE navigation foundation: local stages 1–3

Branch `feature/here-navigation` starts from approved Phase 1 Pages release
`ba54685fbaa2ad5119fdea96f30d6791f335c70f`. Implementation and final review are local-only. The reviewed checkpoint is
authorized for a local commit; publication requires separate approval.
The saved radar (`edb02dc69e2bdf0fa78e269d5402e1e205c9c236`) and maintenance
(`686c50181a13a24cdd97b40ef91489464a4068c5`) branches are untouched. This branch
contains neither their feature implementations nor unfinished fleet/cloud work.

## Existing functionality and preserved behavior

Phase 1 already has one-shot GPS, a Leaflet/OpenStreetMap marker/follow map,
destination/stop/measurement entry, a separate persistent route safety checklist,
My Equipment with stable IDs and active truck/trailer selection, and live weather
through its existing worker. It has no HERE account wiring, real routing, route
geocoding or navigation engine. The previous GPS planner and map had separate
location state; its Prepare Truck Route button only displayed a planning summary
and logged location/destination details. Tab navigation is a separate component.

The existing planner/map element IDs, weather/GPS buttons, vehicle records,
active selections, stored route defaults/stops, equipment editor, payment and
financial code, backups and personal sync are preserved. The inline application
code in index.html is unchanged: only a module script reference is added.
No storage schema, migrations or backend configuration are changed.

## Stage 1: shared GPS

- A single in-memory session feeds both the existing map and planner. The
  existing one-shot button, Start/Stop Tracking and Follow My Location use it.
  Repeated start/follow does not allocate duplicate watchers; watch ID 0 is valid.
- Stop clears the watcher and invalidates pending one-shot callbacks. Epochs
  prevent late fixes/errors from a stopped/replaced session from updating it.
- Timestamp, coordinate range and finite nonnegative accuracy are validated.
  Older fixes cannot overwrite newer fixes. Future timestamps beyond five
  seconds are rejected. A fix older than 30 seconds or worse than 100 m accuracy
  is not usable for local route preparation. This cutoff is a demo gate, not a
  safety certification or a navigation-quality accuracy guarantee.
- The last fix/accuracy stays visible and gray when unusable, clearly marked
  last known. A visible-page freshness tick detects age without a new fix.
  Permission/unavailable/timeout errors stop the watcher and allow explicit retry.
- Map pointer/drag/wheel/arrow interaction selects browse mode, so incoming fixes
  and ticks do not force recentering. Follow is an explicit action. Viewing the
  sample route area also switches to browse mode without pretending it is GPS.
- Hidden/pagehide suspends tracking, cancels pending simulations and clears the
  freshness timer on pagehide. Foreground/pageshow restarts the UI tick, not GPS;
  the user must start or request another fix. No background tracking is promised.
- Location data is neither logged nor saved by these modules. The old route-data
  console dump is removed. Map requests disclose the viewed area to OpenStreetMap;
  the pre-existing weather worker behavior is unchanged.

Leaflet 1.9.4 is vendored locally from the existing reviewed asset set (read-only
copy; the radar branch is not modified), with license, eight SHA-256 hashes and
script/stylesheet SRI. Local CSS image references are included. Map code loads
from the offline shell; fresh basemap tiles require internet. GPS and the local
simulation/maneuver list can run without tiles. No external script CDN is needed
by this GPS module. Library load failure must not disable GPS.

## Stage 2: read-only equipment suggestions

The adapter reads the existing active truck/trailer profiles and stable IDs. It
never persists or duplicates equipment. A source summary shows the individual
profile measurements and rated weights separately from editable trip fields.

- Height/width use the maximum only when every selected component supplies a
  positive value; absent values remain blank. Cargo/overhang still need review.
- With a truck and trailer, coupled length and actual combined loaded weight
  remain blank. Simple addition can double-count overlapping dimensions, cargo
  or transferred loads. A single selected vehicle can suggest its available
  length and actual loaded weight; empty weight/GVWR never replace loaded weight.
- Axles can be summed from available selected component axle counts; wheel counts
  and tire PSI never substitute for axle count or axle weights. Missing counts
  remain blank. A whole count from 1–30 is required.
- Original combined height/width/axle settings remain usable only for original
  equipment/legacy defaults; another active vehicle cannot silently inherit them.
  Explicitly missing selected IDs block preparation for review.
- Every field must be positive and the driver must check the loaded-combination
  confirmation before a sample request. Missing values are never Number('')=0.
- Actual user input is marked dirty, including a deliberately cleared field.
  Later equipment refreshes update only untouched suggestions; manual overrides
  stay in the tab. Equipment/dimension changes invalidate prior confirmation and
  the sample route. Other-tab changes block new planning until reload, retaining
  the draft instead of writing over records.

Trip edits, current fixes, added planner stops and simulated routes are ephemeral
in this tab. They survive foreground/background changes but are not a new saved
trip store and do not survive a full reload. Existing persistent route checklist
settings/stops remain untouched and backed up by the existing system. No claim
of a crash-recoverable navigation draft store or automatic data synchronization
is made.

## Stage 3: credential-free HERE-shaped simulation

`createMockAdapter().calculate()` accepts a normalized RoadLedger planning input
with a fresh origin and confirmed measurements. It makes **no network calls**.
Its response uses HERE Routing v8-shaped routes/sections, flexible polylines,
summary, actions and notices, with an additional mandatory `simulation:true`
marker. The pure flexible-polyline codec is checked against a known 2D reference
vector, not just its own round-trip. Response shape, bounds, offsets, point count,
text sizes and summary values are validated. Only local 2D geometry is supported.

The fixture is fixed in Las Vegas and explicitly ignores entered origin,
destination and stops. It is not a geocoder or real truck-route calculation.
Distance/time/maneuvers are sample numbers. The orange dashed line, map notice,
mode, route heading, warnings and controls label it **SIMULATED — NOT SAFE FOR
REAL NAVIGATION**. The current GPS marker is independent of this sample line.
Provider instructions/warnings and user data are rendered as text, never HTML.

Sample, no-route, provider-error, malformed and slow scenarios are available for
manual testing. A new request, input/equipment change, invalid GPS state, stop or
suspension aborts/invalidate older work. Generation checks prevent late results
from overwriting a newer state even if cancellation races. Failed/stale requests
clear prior geometry, maneuvers and sample distance/time. Nothing is persisted.

This is a mock adapter boundary and response parser, **not verified HERE request
or account compatibility**. No live request serialization, provider geocoding,
HERE metric-unit parameter mapping, quota handling, real guidance, speech,
traffic/restriction validation, off-route detection or automatic rerouting is
implemented. There is no option/key/configuration that enables real HERE calls.

## Exact changed files (16)

- `index.html`: load the new core before the existing GPS module.
- `roadledger-gps.js`: preserve/reuse planner IDs and Leaflet map; integrate shared
  GPS, equipment suggestions/confirmation and sample display/async lifecycle.
- `sw.js`: distinct `here-local-v1` shell and eight additional static entries.
- `roadledger-navigation-core.js`: pure GPS session, equipment adapter,
  validation, polyline codec and simulated routing adapter/parser.
- `tests/here-navigation.cjs`: pure calculation/lifecycle/security tests.
- `tests/here-navigation-browser.cjs`: isolated browser/offline/compatibility tests.
- `docs/HERE-NAVIGATION-LOCAL.md`: this report.
- `vendor/leaflet-1.9.4/LICENSE`
- `vendor/leaflet-1.9.4/manifest.json`
- `vendor/leaflet-1.9.4/leaflet.js`
- `vendor/leaflet-1.9.4/leaflet.css`
- `vendor/leaflet-1.9.4/images/layers.png`
- `vendor/leaflet-1.9.4/images/layers-2x.png`
- `vendor/leaflet-1.9.4/images/marker-icon.png`
- `vendor/leaflet-1.9.4/images/marker-icon-2x.png`
- `vendor/leaflet-1.9.4/images/marker-shadow.png`

## Validation and reproduction

```
node tests/here-navigation.cjs
NODE_PATH=/workspace/RoadLedger/node_modules node tests/here-navigation-browser.cjs
```

The browser test uses real Chromium and local Leaflet under a localhost
`/RoadLedger/` path. Desktop, phone and tablet viewport emulation use fictional
profiles/GPS and mocked map tiles/weather; all other external calls are aborted.
It checks start/stop/id=0 cleanup, shared one-shot and watched fixes, stale/poor
accuracy, errors, browse/follow, manual trip overrides/confirmation invalidation,
fixed geometry/maneuvers, no-route/malformed/error handling, obsolete slow-result
cancellation, hidden/pagehide cleanup, no automatic resume, and offline reload.
Stored datasets and IndexedDB records/conflicts/archives remain unchanged through
navigation, including preserved original route defaults/stops and payment status.
Cloud transport remains null with mode disabled. No HERE calls or sensitive
location/destination console logs occur.

An isolated copy of the existing Phase 1 test harness overlays these static files
and runs its 21 suites plus the two new suites. Its local mock/production static
allowlists and CSS MIME types are adjusted in that temporary copy only to serve
the new core/vendor assets. No authorization assertion or tab count is weakened;
no backend file belongs to this feature. A future backend deployment would need
its own reviewed asset allowlist update. The original new browser stale-status
check failed because its clock was installed after timers had been created;
installing the clock before page scripts runs the real UI timer correctly.
Final results: 23/23 suites passed (21 existing + two new), and the final
new browser suite rerun with cross-tab invalidation also passed. All 18 JS/CJS
syntax checks, eight vendor file hashes, two SRI values, all 28 static shell
entries, credential-pattern scans, first-party whitespace and the exact
script-only index delta checks passed. No failed tests remain.

The service-worker rules are unchanged apart from the shell name and file list:
no skipWaiting, no API/external/user-data cache, no private-record cleanup.
An additional real same-origin v4 -> here-local-v1 worker upgrade test waits for
activation after closing the old client, then verifies legacy data, payment
status, theme, queue operation IDs, conflicts/archives and offline reopening.
The unchanged upstream Leaflet files retain their original CRLF/whitespace;
first-party whitespace checks and vendor integrity checks are separate.

## Remaining approval and validation requirements

- Final review passed with a fresh 23/23-suite rerun, 18 syntax checks and the
  offline worker-upgrade check. A local commit is authorized. This is not road-safe
  navigation. No push, merge, deployment, credentials, billing, Supabase, Render
  or live website changes are authorized.
- Before live HERE work: confirm HERE account/product entitlements and terms,
  pricing/quotas, permitted map display, region restrictions and credential
  controls. Do not request a private key in chat or embed it in Pages JavaScript.
- Design an approved dedicated BFF/proxy: protected server-held credentials,
  authentication/appropriate authorization, origin/CSRF protection, bounded input
  and responses, rate limits, known outbound destinations, request timeouts,
  privacy redaction and abuse controls. GitHub Pages alone cannot keep a secret.
  Existing weather Worker and unfinished fleet/cloud infrastructure are not
  silently repurposed. Personal/fleet cloud synchronization remains disabled.
- Verify real HERE geocoding, request parameters/metric units and truck restriction
  support, geometry/instruction/notice semantics, traffic data and error handling
  using an approved isolated environment. Preserve manual driver confirmation.
- Add and independently review foreground maneuver progress, speech/gesture and
  interruption handling, route matching/accuracy, off-route thresholds and
  rerouting debounce/cancellation before claiming turn-by-turn guidance.
- Physical Windows Edge/Chrome, iPhone Safari and iPad Safari/installed PWA tests:
  start/stop, GPS permission deny/revoke/retry, changing accuracy, weak signal,
  panning/pinching, orientation, sleep/lock/background/foreground, interruptions,
  network drops/reconnect, cached-shell updates, equipment switching and backups.
  Viewport mocks do not verify sensors, battery behavior, Safari or HERE.
- Browser/PWA navigation cannot guarantee background/locked-screen tracking or
  speech. This implementation intentionally stops tracking on hidden/pagehide.
  Native navigation SDK/app evaluation and separate approvals would be needed
  for reliable background navigation; wake lock does not establish it.
- Weather/radar route advisories are future separate work. Existing weather stays
  unchanged and the saved NOAA radar branch is untouched. Never treat radar,
  profile dimensions or a returned route alone as verified clearance or road safety.
