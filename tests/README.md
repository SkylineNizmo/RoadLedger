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


## Offline synchronization development tests

These suites start isolated loopback mock services, use fictional users/test records, and remove their own temporary backend files. They do not need a real cloud service or credentials. Node.js 20+ is required.

```sh
node tests/provider.cjs
node tests/mock-api.cjs
NODE_PATH=/workspace/.roadledger-tools/node_modules node tests/sync.cjs
NODE_PATH=/workspace/.roadledger-tools/node_modules node tests/sync-recovery.cjs
NODE_PATH=/workspace/.roadledger-tools/node_modules node tests/offline.cjs
```

- `provider.cjs`: server-only Supabase authentication/refresh/verification/RPC mapping with stubbed fetch; privileged-key/HTTP rejection. It does not execute PostgreSQL or verify deployed RLS.
- `mock-api.cjs`: authentication, cookie flags, CSRF/origin enforcement, durable mock restart, replay receipts, stale revisions, operation-ID misuse, invalid keys, and deletion tombstones.
- `sync.cjs`: copy-only migration of all existing datasets/expense links, IndexedDB atomic rollback, independent offline records across two browser profiles, same-record and deletion/edit conflicts, resolution history, lost acknowledgements, in-flight local edits, failed mirror recovery, account isolation, sign-out, malformed legacy data.
- `sync-recovery.cjs`: interrupted projection checkpoints before/after writes, uncertain apply hold, stale projection rejection, and recovery export even when startup synchronization is blocked.
- `offline.cjs`: actual service-worker offline reload, queue persistence, automatic reconnect/session resume/upload, no API caching, credential-free recovery export, and all tabs at phone/tablet/desktop viewports. Chromium viewport emulation does not verify native iPhone/iPad Safari or physical devices.

Run the original suites against a local server as above to check application/financial regressions. See `docs/OFFLINE-SYNC.md` for architecture, backend costs, mock operation, and the setup/security work still required for a real deployment.
