# GetRight production-readiness tracker

Branch: `getright/audit-testing-dev`. **Do not merge or deploy without explicit approval.**

| Stage | Status | Evidence / remaining work |
|---|---|---|
| 1. Full application checkout and browser testing | BLOCKED | GitHub checkout from available execution container failed DNS resolution for github.com. GitHub connector supports individual file reads, but no complete mounted checkout. No actual GetRight Chromium session run. |
| 1. Full automated suite | BLOCKED | Repository branch has no package.json or .github/workflows/ci.yml at inspected paths; full inventory and runner verification still required. |
| 2. Edit Load implementation | IN PROGRESS | Added edit/cancel UI and in-place update retaining ID and unspecified metadata, including payment-history fields. Needs actual browser tests for refresh, persistence, invalid inputs, earnings and reports. |
| 3. Backup safety | IN PROGRESS | Existing journaled restore inspected; targeted fictional fixture checks passed. New Node regression tests committed but full Node suite not executed. |
| 3. Offline shell | IN PROGRESS | Fixed missing route-weather script and cache version. Static dependency comparison passed; real offline reload pending. |
| 3. GPS, radar, weather, equipment | PENDING | Requires application browser and mocked GPS/provider testing. Live HERE remains disabled. |
| 4. Private demo ZIP | BLOCKED | Do not package as verified before essential browser and offline tests pass. |
| 5. Advanced AI voice | PENDING | Existing disabled foundation preserved. No microphone, provider or paid service activation. |

## Observed findings
- Existing storage keys remain unchanged. No data migration or real user records touched.
- Edit Load uses the existing form and preserves unknown record properties by merging edited fields into the original object, retaining the original ID and equipment metadata.
- Tests executed in a connector-hosted JS harness previously: 11 route-weather/voice checks, 1 accounting fixture, 3 backup fixtures, and 1 offline manifest check passed. These are **not** a full Node or browser regression run.
- The repository root `package.json` and `.github/workflows/ci.yml` were not found on this branch when checked. No current branch workflow runs were returned.
- Stage 8 browser validation is still pending.

## Before release
1. Obtain complete branch checkout through authenticated GitHub archive/checkout or mounted workspace.
2. Run existing Node test files with `node --test`; address failures and record pass/fail/skip totals.
3. Launch the actual app in Chromium, test desktop/phone/tablet with fictional isolated storage; verify no console errors.
4. Test Edit Load including payment-history preservation, invalid inputs, cancellation, refresh, duplicate prevention and report recalculation.
5. Test GPS permission scenarios, radar, forecast labels, equipment, offline service worker and backup recovery.
6. Produce a private testing ZIP only after essential tests pass. Physical Safari verification separately required.
