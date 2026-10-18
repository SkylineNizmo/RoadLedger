# RoadLedger repair report — 2026-10-18

All repairs are on `roadledger-bug-fixes`. No changes have been merged into `main` or deployed to the live website. The existing layout, styling, navigation, and feature panels are preserved. No paid services were added.

## Previously repaired

- Navigation no longer dereferences the nonexistent `ownerTab`; unknown destinations preserve the active panel.
- General settings preserve calculator MPG preferences.
- Route equipment selectors match saved fleet types without case sensitivity.

## Backup and restore

- Version 4 backups include loads/equipment, company/pay/MPG settings, mileage trips, expense/maintenance/fleet/document/IFTA records, tire configurations, route equipment defaults, and ordered route stops.
- Backups read the latest saved records, including changes saved by another open tab, rather than exporting stale in-memory records. Malformed stored JSON causes an export error instead of silently excluding that dataset.
- Import validates containers, records, real calendar dates, finite/nonnegative numeric amounts, percentage bounds, mileage odometers/loaded miles, equipment types, expense payers, tire counts, route measurements, stop lists, and duplicate IDs before writing records. Numeric strings from older backups are normalized, missing IDs are supplied, and mileage totals are recomputed from odometers.
- Legacy backups (including version 3 and backups without a version) remain supported. Missing datasets become empty collections; omitted settings use application defaults, rather than retaining unrelated data from the destination device.
- A rollback journal is saved before the first dataset changes. Failure at any data write rolls back all datasets. Failure to create the journal leaves existing records untouched. Interrupted restores recover on startup.
- If storage also prevents rollback, the journal remains available for recovery. The application reads the original snapshot, warns the user, and blocks saves and subsequent restores until recovery succeeds. Successful restore reloads all modules so tire/route closures and displayed records match restored storage.

## Finance, reports, and invoices

- Finance totals, equipment selectors, and invoice choices refresh after loads are added/deleted and equipment is saved.
- Gross revenue includes load pay, TONU, detention, and layover in the dashboard, reports, finance summary, invoice choices, and invoice total.
- Finance recorded/business expense totals include the business-expense field saved with loads, as well as separately recorded expenses. Driver-paid expenses remain separate; reimbursed expenses do not reduce the driver's remainder.
- Numeric sums coerce older string amounts correctly instead of concatenating them.
- Invoices itemize accessorial charges and show total due. Invoice selection uses stable load IDs, so inserting/deleting a different load does not silently change the selected invoice.
- Empty load lists clear stale search counts.
- Biweekly report ranges use calendar-week arithmetic, fixing incorrect boundaries after daylight-saving changes.

## Saving, consistency, and validation

- Failed saves roll back in-memory general settings, equipment, MPG profiles, tire records, route defaults, and stop additions/reordering/deletion. Existing load/mileage/extras rollback behavior is retained.
- Writes compare the dataset with the version this tab loaded/saved. A stale tab is prevented from overwriting another tab's changed dataset and is told to reload. This is conflict protection, not cross-device synchronization.
- Unrelated view refreshes preserve unsaved calculator MPG inputs; reopening Road Weather preserves unsaved route measurements for the same equipment selection.
- Route review rejects zero/negative/nonfinite dimensions and axle counts outside the integer range 1–30; saving route defaults also requires a truck selection. The GPS planner uses the same axle bounds and clears an earlier summary before validating a new request.
- Load saving checks finite amounts/rates and real dates. Expenses/documents/maintenance check dates; maintenance rejects negative/nonfinite odometers. Blank IFTA miles no longer silently become zero. Non-fuel expenses no longer retain an unrelated gallons field.
- Deleting a mileage trip currently being edited exits edit mode instead of leaving a save that targets a deleted record.

## Weather fixes

- The weather handler now updates the original GPS-coordinate output, which its event interception previously left unchanged.
- Manual GPS/weather requests refresh immediately instead of being ignored during the 15-minute cache interval.
- Weather fetches time out after 15 seconds, failed refreshes mark older readings as potentially stale, and empty numeric weather fields display unavailable rather than zero.

## Verification

Passed the committed Chromium suites in `tests/`:

1. `smoke.cjs`: startup, load creation/totals, reload persistence, report values, CSV download, theme persistence, and all 12 tab panels.
2. `navigation-regression.cjs`: unknown destination preserves active panel, fleet truck/trailer route choices, MPG settings surviving general settings save and reload.
3. `repairs.cjs`: actual backup-file upload/reload/download with every saved module; numeric normalization; exact finance/accessorial totals; stable invoice selection and escaped customer text; quota failure at each of seven restore dataset writes; journal-write failure; interrupted and persistently blocked recovery; malformed/legacy imports; settings/equipment/MPG/tire/route/stop failed-save behavior; route validation boundaries and draft preservation; updates after load insertion/deletion; stale-tab overwrite prevention and latest-data export; daylight-saving biweekly dates; mocked weather readings, GPS coordinate display, and manual refresh after location changes.

Application contexts monitored by the smoke and regression suites recorded no uncaught page errors. JavaScript syntax checks and `git diff --check` also passed. Reproduction instructions and dependency requirements are in `tests/README.md`.

## Remaining issues and limits

- Cross-device accounts, cloud storage, and automatic synchronization remain absent. Records are browser-local; backups transfer them manually. Concurrent tabs should reload when a save reports a conflict. LocalStorage conflict checks are not a distributed transaction or a guarantee against simultaneous writes from separate processes.
- The recovery journal requires extra browser storage. A restore may be safely refused when there is insufficient space. Browser storage clearing or device loss can still destroy local records; downloaded backups remain necessary.
- Expenses entered both on a load and separately in Finance count twice because the records have no shared expense identifier. Enter each cost once; automatic reconciliation would require a data-model/workflow change.
- Revenue totals include every saved payment status, including pending loads; they represent recorded revenue rather than cash received. Financial estimates do not provide payroll/tax accounting or reconcile bank transactions.
- Load Board, live booking, ELD synchronization, commercial truck routing/restriction verification, turn-by-turn directions, route-time weather, live truck-stop/fuel-price layers, and AI calling/negotiation/offer approval still require integrations. Their existing placeholder panels and APIs are preserved.
- Documents remain a metadata/checklist register without secure file upload/storage. Maintenance reminders remain in-app, without push notifications or automatic odometer feeds.
- The separate GPS planner's temporary destination/stop inputs remain session-only; persisted route stops in the route checklist are backed up. Theme preference remains device-local.
- Weather was tested using controlled responses and mocked device location. Live provider availability, units/field contract, actual device permissions, and mobile-browser behavior were not verified. No production website or paid integration was used for testing.
