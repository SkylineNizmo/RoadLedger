# Get Ready Ledger navigation/radar hardening — local work

Branch: feature/navigation-radar-hardening, separate worktree at
/workspace/GetReadyLedger-navigation-radar-hardening. Base commit c889ad4190bb2052e35a8e54af988de3e62e879f.
No commit, push, deployment or live-account change performed.

## Recovery and branch findings

The existing feature/here-navigation worktree contains the latest 12 uncommitted
navigation/weather files. All were copied byte-for-byte to this new worktree
before edits. The original worktree, its uncommitted files, feature/weather-radar,
feature/maintenance-reminders and prior exports/bundle are preserved unchanged.
Native read-only git ls-remote succeeded after the restricted shell permission
was granted: SkylineNizmo/RoadLedger main and HEAD are ba54685fbaa2ad5119fdea96f30d6791f335c70f;
roadledger-offline-sync is 4f8b063def2ed24bef7690cb446b5e40379decfd.
The queried feature/here-navigation and feature/weather-radar refs were not
advertised. Thus these development branches/workspace edits are available here
locally, but were not found on the original GitHub repository by this check.
No remote refs were fetched into local branches or changed. This proves Git read
access, not GitHub API creation privileges or push permission.

## New changes on top of the copied work

- roadledger-radar.js: abort/generation guards after map readiness and catalogue
  responses, pagehide/hidden-tab/offline suspension, explicit pageshow re-enable,
  no automatic refresh after suspension, cancellation of late GPS callbacks,
  deletion of stale/unusable ephemeral GPS markers, strict timestamp/coordinate/
  accuracy validation without fabricating a timestamp, strict UTF-8 metadata,
  and explicit unavailable observation/source labels after errors. Refresh no
  longer tries to acquire an additional geolocation fix automatically; it uses
  shared fresh fixes or the explicit radar GPS button. No real GPS tracker was
  replaced. Map imagery/records remain separate; no storage writes added.
- roadledger-navigation-demo.js: simulation-only detector now requires three
  consecutive deviations beyond its threshold. An intermediate-distance fix
  resets the candidate count; confirmed off-route state remains latched until
  within the fixture's 50m re-entry distance. This is a short Las Vegas fixture
  algorithm, not live geographic routing, map matching or actual rerouting.
- roadledger-route-weather-demo.js: reject malformed/oversized/out-of-range
  sample-route coordinates before enabling fictional forecast/warning scenarios.
  No live forecast or official warning feed is connected.
- tests/weather-radar.cjs: delayed catalogue/pagehide cancellation, late GPS fix
  cancellation, failure timestamp cleanup plus existing desktop/phone/tablet,
  controls, animation, overlay, offline, permissions and record assertions.
- tests/navigation-trace.cjs: consecutive deviations and latched/re-entry behavior.
- sw.js: shell version bump only; static-only cache policy unchanged.
- docs/NAVIGATION-RADAR-HARDENING.md: this report.

The other copied files are the existing in-progress implementation, not new
features introduced by this hardening step. There are 13 uncommitted paths
relative to c889ad4 in this worktree, including this new report. The original
worktree retains its original 12.

## Validation and security boundaries

All nine available targeted suites passed: navigation-trace, navigation-demo,
navigation-here-route, navigation-here-transport, navigation-live,
here-navigation, weather-radar, here-navigation-browser and navigation-proxy.
Browser/HTTP tests use temporary loopback-only servers and mocked external
NOAA/weather/map/speech/GPS. Browser tests cover desktop, phone and tablet sizes,
preserve raw records, IndexedDB operation queues/conflicts/archives, offline
reload, equipment/manual values and disabled cloud/HERE boundaries. Initial
restricted-shell listener failures were addressed using the supported permission
mechanism; no public server or network-policy change was introduced.
The previous historical 30-suite temporary harness was not rerun for this step.
Syntax, whitespace, static asset closure, targeted credential scans, vendored
asset hashes and original-source/recovery checks are recorded in the final report.

No HERE calls, credential provisioning or billing changes. Truck request building
still fails closed; no real guidance, alternate route, truck clearance or safety
claim. Current equipment restrictions/units/weights/axle definitions, provider
entitlements, real authentication, durable quotas and actual provider replies must
be verified before enablement. Forecast/severe-warning panels remain fictional.
NOAA capabilities/image/CORS checks from the earlier continuation are evidence
only for that past test; no new real-provider requests were needed here. Licensing,
provider operational conditions, real imagery animation and physical Safari/
Windows behavior remain release gates. Existing cloud synchronization is disabled.

## Next Windows/iPad steps

Use this worktree, not the old c889ad4 export, when preparing a later reviewed
static test package. For Windows, after an approved transfer, run a static server
on that computer bound only to 127.0.0.1, then use a fresh Edge/Chrome test profile
with fictional equipment/records. See NAVIGATION-WEATHER-LOCAL-CONTINUATION.md for
the complete manual sequence. Specifically check rapid radar refresh/tab switches,
background/foreground, offline during loading, stale GPS, permission denial,
late GPS return, voice mute and fixture off-route recovery without moving the real
map. Confirm no real HERE request in network tools and no cached API/radar payloads.
An iPad needs a separately approved HTTPS static preview and a supported transfer
path; localhost in Codex is not an external URL. Test speech/permission gestures,
rotation, screen lock, PWA updates and offline records on the physical device.
No automatic background navigation or reliable closed-app warnings are promised.
Do not import production records or change the existing live website to test this.

Production navigation/publication remain NO-GO pending provider, authentication,
licensing, physical-device checks and separate approval.
