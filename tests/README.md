# RoadLedger browser regressions

These tests run only against a local HTTP server. They do not deploy or modify GitHub. They use isolated browser contexts and accept app confirmation dialogs within those contexts.

Requirements: Node.js, `playwright-core` 1.58.2, and Chromium at `/usr/bin/chromium` (the repairs suite also accepts `CHROMIUM_PATH`). No application dependency or build step is required.

From the repository root, serve the app:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

In a second terminal, with `playwright-core` available to Node:

```sh
node tests/accounting.cjs
node tests/expense-links.cjs
node tests/smoke.cjs
node tests/navigation-regression.cjs
node tests/repairs.cjs
```

In the supplied workspace the existing tooling provides the dependency:

```sh
node tests/accounting.cjs
NODE_PATH=/workspace/.roadledger-tools/node_modules node tests/expense-links.cjs
NODE_PATH=/workspace/.roadledger-tools/node_modules node tests/smoke.cjs
NODE_PATH=/workspace/.roadledger-tools/node_modules node tests/navigation-regression.cjs
NODE_PATH=/workspace/.roadledger-tools/node_modules node tests/repairs.cjs
```

Coverage includes the 12 tabs, records, persistence, report CSV export, theme settings, fleet selection, MPG settings, full backup upload/download, legacy and malformed backups, quota failures at every restore write, interrupted/persistently blocked recovery, failed-save memory rollback, finance and invoice accessorial totals, stable invoice selection, route validation/drafts, cross-tab conflict protection, daylight-saving report boundaries, and mocked weather/GPS refresh responses. Weather integration tests use a fake response and do not establish live provider availability or units.

The accounting unit suite needs Node.js only. The expense-links browser suite additionally verifies original-record preservation, receipt-to-load links for existing and new costs, split/excess reconciliation, backup and CSV metadata, unlinking/deletion, failed saves, and stale-tab conflicts.
