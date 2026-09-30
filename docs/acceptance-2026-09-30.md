# Reputation and API acceptance, 2026-09-30

Starting revisions: API `da27d65`; Reputation `3faea60`. Reviewed implementation revisions: API `a78f0d5`; Reputation `d2a449e` plus this report update. The final R9 gate remains open until the remaining acceptance scenarios pass.

| Check | Result |
| --- | --- |
| API build and lint, Node 24 | Passed |
| API suite with disposable MongoDB replica set | 54 files, 174 tests passed |
| Reputation build and lint, Node 24 | Passed |
| Reputation suite with disposable MongoDB replica set | 17 Vitest files, 42 tests; 11 worker tests passed |
| Shared model parity | 34 files matched |
| Migration against disposable database | Passed (`migrate:prod`) |
| Reputation starts after migration and checks indexes | Passed against disposable MongoDB |
| Startup with RabbitMQ unavailable | Passed: MongoDB polling and private readiness stayed active |
| Live RabbitMQ delivery and worker consumption | Passed on isolated local broker at `127.0.0.1:5673` |
| Two-service multi-page Stellar queue to API score test | Passed: 1 test, 0 skipped, using controlled two-page Horizon responses, isolated RabbitMQ, and disposable MongoDB |
| Live broker disconnect, reconnect, and restart | Pending |
| GitHub and X controlled-provider, two-service acceptance | Pending |
| Staging alert delivery and rollout | Pending operator infrastructure |

The local machine cannot access its Docker daemon socket, including with sandbox escalation, so `scripts/test-with-services.sh` could not run here. An isolated RabbitMQ instance was started directly with its data and logs under `/tmp` for the live test. All database tests used only the disposable MongoDB instance at `127.0.0.1:27019`; they did not touch production data. The integrated test is skipped when `LUMENRISE_TEST_RABBITMQ_URL` is absent, so only the explicit live run above counts as an integrated-test pass.

Policy decision recorded from the user: GitHub and X refresh are manual only; scores and provider snapshots have 90-day validity/retention; each identity retains at most 20 completed Stellar scans. Existing 15-minute manual refresh cooldown applies. A disconnected provider's old score is unavailable immediately.

Before final acceptance, run `scripts/test-with-services.sh` with Docker access, review the GitHub Actions runs with cross-repository read tokens, and exercise controlled GitHub/X OAuth and sync, broker outage and restart, Soroban evidence, profile, and Policy responses against the same disposable stack. Record the final commit IDs and results here. Do not begin the Token Launch data contract until those pass.
