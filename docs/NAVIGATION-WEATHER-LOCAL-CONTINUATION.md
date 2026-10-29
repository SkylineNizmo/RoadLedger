# Get Ready Ledger: local navigation/weather continuation

Base: feature/here-navigation at c889ad4190bb2052e35a8e54af988de3e62e879f.
Existing interface/product strings remain unchanged. No commit or deployment.
The saved radar and maintenance worktrees are not modified or merged.

## What works and what remains simulated

- Existing equipment-specific planning reads active truck/trailer profiles,
  preserves manual overrides and requires confirmed loaded combination values.
  Missing data remains missing, not zero. No new equipment fields were invented.
- Existing shared GPS/follow-browse, freshness/accuracy checks, watcher cleanup,
  disabled HERE boundary, mock adapter and loaded-combination confirmation remain.
- The demo's new fixture detector accepts only simulation-tagged synthetic fixes,
  rejects stale (>10s), inaccurate (>30m), invalid and duplicate timestamps, uses
  short-fixture segment distance with 100m+accuracy deviation and 50m re-entry
  hysteresis, and requires three off-route observations. It is not a general
  geographic navigation algorithm and cannot process actual GPS. The explicit
  "Simulate three off-route GPS fixes" button produces fictional coordinates.
  It transitions only the existing rerouting-demo -> no-alternate state machine.
  It never requests or claims an alternate route. Visual maneuvers and voice
  guidance remain manually advanced fixtures; speech starts muted.
- NOAA radar is reused from feature/weather-radar's saved source, without
  overwriting its old GPS implementation. Local Leaflet, range slider/play/pause,
  refresh, zoom/pan, timestamps, stale/error/offline messages and source attribution
  are retained. Shared fresh GPS fixes are accepted; stale fixes are ignored.
- The radar can show the planner's dashed orange SAMPLE geometry. Clearing the
  sample removes this overlay. No personal route is uploaded for radar; image
  requests disclose the viewed map area to NOAA/OSM, as stated in the UI.
- Route weather uses an explicit button and local fictional departure/midpoint/
  arrival scenarios, including a visibly fictional severe thunderstorm warning.
  It is NOT a forecast or official warning feed and never implies an all-clear.
  It is cleared when the sample is invalidated. No provider keys or forecast
  entitlements exist in this module. Existing current-weather Worker is unchanged
  except for publishing the same ephemeral GPS event the radar branch used.

## Provider checks and release limitations

The runtime now reports running/enforced. HERE documentation/provider access was
not retried and no HERE requests or credentials were used. Prior HERE semantics,
limits, account products, actual/permissible weight, axle definitions and secure
identity/durable-budget blockers remain. Transport/geocoding foundation is not
wired into the browser or mock-auth service. Truck builder remains fail-closed.

NOAA public ImageServer checks succeeded once per operation, using fixed public
coordinates and no keys or personal GPS:
https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer
Metadata advertised Catalog/Mensuration/Image/Metadata, dated start/end fields,
NOAA/NWS attribution, a time-enabled reflectivity service and five-minute updates.
A distinct-timestamp catalogue query returned three features with HTTP 200 and
an Access-Control-Allow-Origin header matching a test Origin. A timestamp-selected
256x256 exportImage returned HTTP 200 image/png (334 bytes; possibly blank coverage).
This verifies a valid image response, not visible precipitation, image-to-time
accuracy, all regions or animation under real network conditions. Service metadata
says four-hour history while its returned extent can be shorter; use returned
catalogue observations rather than fabricate frame times.

The selected product is observed reflectivity, not a future forecast, road weather
hazard model or official severe-warning product. Metadata copyright attribution
was reviewed and is displayed, but full current NOAA service operational/usage
terms were not independently reviewed. Do not claim license clearance or SLA.
Release gates include NOAA usage/attribution terms, OSM tile terms/rate limits,
HERE display/cache/subscription terms and Tomorrow.io Worker entitlement/source
review. Vendored Leaflet 1.9.4 MIT license and original assets are retained. No
new third-party dependency/CDN, billing or account service was activated.

## Data and offline preservation

No record migrations, backup formats, storage keys, payments/dashboard logic,
credentials, cloud settings or database files changed. Position/route events,
radar frames and demo warnings are ephemeral, not stored or logged. Radar images
and private API responses are not service-worker cached. Offline retains the
static interface and saved records; live radar/weather need connectivity and do
not promise offline meteorological coverage. Shell cache version is bumped with
three new static assets; waiting worker/update policy is unchanged. No auto-import,
clear-storage, restore, skipWaiting or remote publication was added.

## Exact changed files

1. index.html — radar CSS/module and route-weather demo scripts.
2. roadledger-gps.js — expose existing Leaflet readiness and publish ephemeral
   fresh-fix/sample-route events, with clear notifications.
3. roadledger-navigation-demo.js — isolated synthetic-fix detector/control.
4. roadledger-weather.js — reuse ephemeral GPS event from saved radar work.
5. sw.js — new static assets and cache version only.
6. tests/here-navigation-browser.cjs — synthetic detector and route-weather demo.
7. roadledger-radar.js — reuse radar; sample overlay and fresh-fix validation.
8. roadledger-radar.css — existing radar styles copied unchanged.
9. roadledger-route-weather-demo.js — explicitly fictional route-weather panel.
10. tests/navigation-trace.cjs — detector gating, freshness, duplicate/reset tests.
11. tests/weather-radar.cjs — reused browser suite plus overlay/forecast clearing.
12. docs/NAVIGATION-WEATHER-LOCAL-CONTINUATION.md — this report.

## Test procedure and evidence

Targeted tests: node tests/navigation-trace.cjs; node tests/navigation-demo.cjs;
node tests/navigation-here-route.cjs; node tests/navigation-here-transport.cjs;
node tests/navigation-proxy.cjs; node tests/navigation-live.cjs;
node tests/here-navigation.cjs. Browser: with Playwright and Chromium installed,
node tests/here-navigation-browser.cjs; node tests/weather-radar.cjs. Existing
local dependency location can be selected using
NODE_PATH=/workspace/RoadLedger/node_modules. Tests intercept all weather/radar/
map responses; no HERE or real alerts. They exercise three viewport sizes,
map controls/animation/tile failures/stale metadata/GPS permission denial,
synthetic guidance/speech/cancellation, localStorage/IndexedDB queues/conflicts/
archives, offline reload and sample/weather invalidation. Real NOAA checks above
are separate from these mocked browser assertions.

The prior temporary regression harness no longer existed. It was reconstructed
outside the repository from historical f0389a4 backend/tests and Phase 1 equipment
tests, overlaid with current static files and local navigation modules. Only that
temporary harness's public allowlist/CSS MIME support was extended; no production
backend was changed. Its database tests use disposable PGlite, not real concurrent
PostgreSQL or external SQL. Results are appended after execution below.

## Windows and iPad testing steps (not yet performed)

Windows: obtain this uncommitted reviewed working copy by an approved transfer
(the c889ad4 recovery bundle does not contain these new changes). Keep production
backups untouched; use a fresh browser profile with fictional equipment/loads.
From the copied static root run `py -m http.server 8000 --bind 127.0.0.1` and open
http://127.0.0.1:8000/. This is a local test address, not an iPad share link. In
Road Weather, allow/deny GPS; test start/stop, freshness, browse/follow and manual
loaded-profile confirmation. Build SAMPLE route, check dashed overlay and route
weather DEMO, exercise voice/mute, synthetic off-route/resume/stop. Load NOAA radar,
verify timestamps/attribution, play/pause, zoom/pan and outages. Compare observed
imagery with official NOAA at the same time/area. Test offline/reconnect, reload,
multiple tabs, records/backups and pending/conflicted work in the fictional profile.

Physical iPad: a new isolated HTTPS origin containing only reviewed static assets
requires explicit approval and a supported transfer/deployment channel. No public
server or HTTPS preview is started here; do not change the live Pages/Worker/Render
projects. The previously approved single-file demo is not this full new build.
Once approved/uploaded to a separate temporary project, use Safari with fictional
records only. Tap Unmute after Start demo, verify speech interruptions/mute,
Home/app switching, screen lock (guidance must stop; no background guarantee),
rotation/pinch/zoom, GPS allow/deny/revoke and offline/reconnect. Test both Safari
and Add to Home Screen with service-worker update/open tabs; retain private backups
outside the test origin. Do not import production records or drive using this demo.

Real forecasts/official alerts, automatic progress/turn timing, actual off-route
rerouting, physical-device behavior, licensing and approved secure provider staging
remain blockers. Production navigation and new publication remain NO-GO.

## Final validation results

- All nine targeted navigation/weather suites passed, including two dedicated
  browser suites at desktop/phone/tablet sizes. Browser sensor/providers/speech
  are mocked; actual NOAA checks are documented separately.
- The reconstructed historical harness ran 30 suites: 27 passed initially;
  equipment-browser timed out and offline hit its 180s deadline because its
  separate historical mock server did not serve vendor/CSS assets required by
  current service-worker installation. Its test-only static allowlist and CSS MIME
  mapping were corrected; both suites passed independent reruns, preserving all
  application assertions. The render-browser suite expected 12 tabs at initial
  load AND offline reload, while Phase 1 already has 13 including My Equipment.
  Both historical counts were updated only in the temporary test, with explicit
  equipment-tab assertions added. All four rendering viewport cases then passed.
  Thus all 30 suites have passing results after harness corrections/reruns; there
  was not a second uninterrupted 30-suite run. Initial failure logs are retained
  in /tmp/getreadyledger-navigation-weather-results. No source-checkout assertion
  was weakened, and no production server configuration was edited.
- 36 JavaScript/CJS syntax checks; 33 static shell entries; nine unchanged vendor
  hashes; 12-file whitespace and targeted credential-pattern scans passed.
- Prior c889ad4 recovery bundle and validated 32-file demo ZIP hashes remain
  unchanged. They intentionally do NOT include this new uncommitted work.
- feature/weather-radar and feature/maintenance-reminders remain clean at their
  previous commits. Current branch has exactly the 12 intended uncommitted files.

No commits, pushes, deployments, workspace restarts, credential/billing changes,
Supabase/Render changes or HERE calls occurred. Production routing/publication
remain NO-GO pending review and the prerequisites above.
