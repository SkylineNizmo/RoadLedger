# RoadLedger inspection — 2026-10-18

Changes are local and have not been published. Existing layout and features are preserved.

## Fixed

- `showTab` previously called `classList` on the nonexistent `ownerTab`, interrupting every tab switch before highlighting, report/mileage refresh, and scrolling. Navigation now uses actual `.tabPanel` elements and ignores unknown destinations without hiding the current panel. No owner feature or panel existed in this checkout.
- General settings saves replaced the settings object, deleting saved calculator MPG profiles. Saves now preserve other preferences; percentage validation applies only to percentage fields.
- Route truck/trailer selectors filtered lowercase types, while the fleet form saves `Truck` and `Trailer`. Matching is now case insensitive.

## Validation

Passed existing Chromium smoke test: startup, load creation, financial totals, reload persistence, reports, CSV download, theme persistence, and all 12 navigation panels.

Passed targeted Chromium regressions: unknown `owner` destination leaves the current panel visible; newly added truck/trailer appear in the correct route selector; custom MPG survives general settings save and reload. Neither test recorded browser page errors. `git diff --check` passed.

Test scripts are retained at `/workspace/.roadledger-tools/smoke.cjs` and `/workspace/.roadledger-tools/regression.cjs`. They require the existing playwright-core installation, `/usr/bin/chromium`, and a local server serving this directory at port 8000. External integrations were not verified.

## Bugs still requiring work

- Backup/restore omits separate tire records, route equipment defaults, and route stops (`roadledger-tires-v1`, `roadledger-route-specs-v1`, `roadledger-route-stops-v1`). These records will not transfer to another device through the current backup.
- Finance totals and invoice options refresh through `refreshExtras`, but saving/deleting loads only calls `render` and `renderReport`. They can remain stale until an extras update or reload. Finance gross also excludes TONU, detention, and layover even though `revenue()` already includes them.
- Restore performs multiple storage writes without atomic rollback and ignores mileage/extras save failures. A storage failure can leave a partial restore.
- Route checklist checks only for nonempty fields, so invalid measurements can receive the completed-checklist message; saving defaults validates more strictly.

## Incomplete features

- Load Board and ELD are explicitly placeholders with no live search, booking, or device sync.
- GPS planner prepares a summary only; commercial truck routing, restriction verification, turn-by-turn guidance, route-time forecasts, and live truck-stop/fuel-price layers are not connected.
- AI calling, negotiation instructions, and offer approval return service-not-connected responses in `roadledger-ai.js`.
- Document register stores metadata only; secure file upload/storage is absent. Maintenance reminders are in-app only, without push notifications.
- Current-location weather has a Worker integration, but its live response, GPS permissions, and refresh behavior still need separate integration testing.
