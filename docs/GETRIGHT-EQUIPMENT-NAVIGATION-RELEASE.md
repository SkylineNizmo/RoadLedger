# GetRight Ledger equipment, navigation preview and observed radar release

Development branch: feature/equipment-switching-staging, starting at
8d1dc08546c7b45dc92e999e2e91fc0750bd18f9 (retains the existing fresh-profile editor fix).
Live base inspected: ba54685fbaa2ad5119fdea96f30d6791f335c70f, main/root GitHub Pages.
Navigation/radar reused from local feature/navigation-radar-hardening at 1142a1b.
The separate original worktrees/exports and private backup repository are untouched.

## Implemented behavior

Profiles remain in extras.fleet with stable IDs; create now rejects an existing
ID rather than merging it. Existing editing, stale-tab/failed-write guards and
all profile dimensions, weights, tires/PSI, registration, plate/VIN, model/year,
maintenance/inspection/insurance/registration dates and notes remain supported.
No artificial new profile-count limit: practical capacity is bounded by browser
storage and existing backup/sync byte budgets, not an unlimited-storage promise.

Active trucks and trailers switch independently. Existing selection persists as
the current/last-used combination. Users can save/apply defaults explicitly.
POWER ONLY is an explicit trailer-selector mode: it clears only the active trailer
reference, retains profiles and the previous trailer ID, and supports restore.
New loads carry a boolean powerOnly and the Power Only label/empty trailer ID.
Historical loads, pay fields, payment statuses, mileage and financial reports
are not rewritten. Missing/stale default references fail rather than select a
random vehicle. Backup validation checks additive metadata types; keys/version
and original JSON backup compatibility remain. No destructive migration exists.

GetRight branding changes visible title/header/PWA name only, not storage keys,
internal API names or existing backup conventions. Existing dashboard payment,
financial logic and load voice parser remain intact.

Interactive locally vendored Leaflet map shares GPS fixes, reports coordinates/
accuracy/freshness/errors, supports start/stop, one-shot refresh/recenter, follow/
browse, and hides/suspends watchers safely. Existing starting/destination/departure
and ordered-stop planning controls remain; the newer GPS preview also has an
explicit departure field. Departure is planning-only, not sent to a live router.
Active profiles prefill known measurements; combined length/actual load mass stay
blank when coupling requires confirmation. Power Only prefills truck-only values.
Manual overrides survive equipment refresh and confirmation is invalidated.

Live HERE routing remains disabled/fail-closed. Default production UI contains no
turn-by-turn maneuver list and no speech/demo-guidance panel. A fixed sample route
can be requested explicitly with NAVIGATION PREVIEW — NOT VERIFIED FOR COMMERCIAL
TRUCK ROUTING and simulation warnings; it is unrelated to origin/destination.
Developer fixture guidance is available only on localhost with ?demo=navigation,
not on the public GitHub Pages host. Real turns/routes are not fabricated.

NOAA radar supports load/refresh, play/pause, timeline, zoom/pan, overlay on/off,
shared/explicit GPS and labeled dashed SAMPLE-route overlay. Observation/source
update times, stale/failed/offline and suspended states are clear; late requests
cannot revive a stopped display. Private API/radar/weather responses are not SW
cached. NOAA imagery is reflectivity, not verified rain/snow classification or a
forecast. Existing Tomorrow.io Worker remains the server-side weather source;
frontend contains no private key. Current weather is requested explicitly, then
refreshes on the existing interval after opt-in. Returned numeric values are
shown using the existing integration's unit convention; unsupported fields show
unavailable. Provider observation time is distinguished from time checked. Errors
clear old readings. Do not infer zero/clear weather from absent fields.

Route-specific forecast, precipitation type and official severe-alert feeds are
not connected. Production shows truthful unavailability and an official NWS link,
not fictional warnings or an all-clear. The prior fictional route-weather module
is excluded from this application/release. Live weather Worker response shape and
NOAA metadata were checked using fixed public test coordinates; no HERE call.
Current provider licensing/entitlement details and Worker unit implementation
cannot be independently audited here. No paid account/plan change was made.

Voice commands implemented as explicit local UI dispatch: show/open my equipment,
add/create a truck/trailer (form only; user must save), switch to a unique existing
truck/trailer name or unit number, switch to Power Only, show location, open
navigation, show weather radar, refresh weather, and show severe weather alerts
(opens unavailability notice/official link). Unsupported/ambiguous commands do not
claim success. Existing load/financial voice handling is the fallback; no new
voice action saves loads or modifies pay settings. Physical microphone/speech
recognition behavior is not certified by mocked browser tests.

## Validation and production packaging

The project supplies 11 targeted suites, including new equipment-power-only and
getright-release-browser tests. A temporary complete historical harness combines
21 previous Phase 1/security/backup/offline suites with these current 11. It was
reconstructed outside the repository from f0389a4 and dda1600 test fixtures, with
current static assets overlaid. Compatibility adjustments in that disposable
harness: current public static allowlist/CSS MIME, 13 tabs including My Equipment,
GetRight title, and an explicit weather Refresh click (privacy-safe startup now
makes zero weather calls). No financial/data/security assertions were removed.
The first run's only failure was the old auto-weather expectation; the complete
suite was rerun after this intentional behavior update. Results appended below.

Tests cover 205 profiles, create versus overwrite, individual edits, switching,
Power Only/restore/default/reload, historical data/mileage preservation, backups,
quota failures/stale tabs, personal sync mock compatibility, GPS denial/errors,
map/radar animation/errors, weather refresh and failure clearing, voice dispatch,
preview warning gates, mobile viewport and offline behavior. Database tests use
local disposable PGlite, not external SQL or real PostgreSQL concurrency.

An exact same-origin service-worker upgrade from current live Phase 1 to this
build passed, followed by offline reopening. All seven raw datasets, payment
status, mileage, equipment IDs, pending operation IDs, conflicts, recovery archives
and dark theme were preserved. No skipWaiting, record deletion or auto-restore.
Users with existing tabs/PWA clients may need to close them all and reopen to
allow the waiting new worker to activate. Never clear website data to update.

Development branch may contain backend fixtures/tests/docs. Production release
is a separate branch directly based on inspected main, with an explicit public
asset allowlist only. Backend source, tests, reports, credentials, node_modules,
SQL and migrations are excluded. .nojekyll ensures vendored assets are served by
Pages without Jekyll exclusions. No Supabase/Render configuration is changed;
cloud sync remains disabled. Private backup branches are never touched.

Rollback, if needed and separately acted on, should be a normal new commit that
restores the prior static tree, not force-push or deletion of browser data. Old
code retains unknown additive metadata; new historical load fields remain scalar
and are ignored by old financial calculations. Keep private JSON recovery copies
unchanged. No automatic rollback is performed.

## Provider, deployment and physical-device limits

GitHub Pages API confirms main/root and the prior built commit. The public
https://skylinenizmo.github.io/RoadLedger/ request is blocked by the Codex egress
proxy (CONNECT 403). GitHub build status can be inspected after release; direct
served-site contents/physical device behavior must be reported as unverified if
that restriction remains. Do not claim publication until push and build evidence.

Physical iPhone/iPad/Windows GPS, microphone, speech, pinch/rotation, screen lock,
PWA lifecycle and provider-visible precipitation coverage are not tested here.
Background browser navigation is not guaranteed. Real commercial routing remains
NO-GO until HERE fields/units/limits/actual-vs-rated mass/axle definitions,
restrictions, entitlements, credentials, authenticated BFF, durable quotas and
actual responses are independently verified in approved staging. Ordinary car
routing is never substituted. This limited release is equipment management,
GPS/navigation preview and observed weather/radar, not real commercial navigation.

## Final pre-publication results

Final full reconstructed regression run: 32/32 suites passed in one uninterrupted
run after updating the historical explicit-weather-click expectation. New unit
coverage includes 205 independent profiles; integrated browser tests cover three
viewport sizes and production absence of fictional guidance/weather panels.
All 38 JavaScript/CJS syntax checks, 33 static shell entries, changed-file
whitespace and targeted secret patterns passed. Original vendored Leaflet bytes,
private-backup repository and prior exports/recovery bundle were not modified.
Exact live Phase 1 -> current release worker-upgrade/offline recovery passed.
No physical iPhone/iPad testing or real HERE response verification is claimed.

Limited static release recommendation: GO for equipment management, GPS and
explicit navigation preview plus observed weather/radar. Real commercial routing,
route-specific forecasts and official alert feeds remain unavailable, explicitly
labeled, and outside this publication's functionality. Deployment result and exact
commit/build IDs must be reported separately from these pre-release tests.
