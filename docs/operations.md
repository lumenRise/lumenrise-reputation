# Reputation operations

## Deployment

Use Node 24, one MongoDB replica set, and RabbitMQ. Both services must use the same `DB_URI`, `DB_NAME`, `RABBITMQ_URL`, `CREDENTIAL_ENCRYPTION_KEY`, provider OAuth credentials, and Stellar network settings. The encryption key is a 64-character hexadecimal secret. Store it outside Git and never log provider tokens.

1. Back up MongoDB and record both commit IDs.
2. Deploy the API artifact and run `npm run migrate:prod` with production environment variables. This does not start the API server.
3. Start Reputation. It checks required indexes before processing. MongoDB polling continues during RabbitMQ outages, and consumers reconnect when the broker returns.
4. Start the API. It also runs migrations before listening.
5. Verify service health, model parity, and job states before opening traffic.

For rollback, stop both services, restore compatible earlier artifacts, and check migration compatibility before restoring traffic. Do not remove indexes or restore data without a database backup. Current migrations are additive.

## Environment

API needs `DB_URI`, `DB_NAME`, `RABBITMQ_URL`, `AUTH_JWT_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `CLIENT_ORIGIN`, GitHub and X OAuth IDs, secrets, and callback URLs, `STELLAR_AUTH_NETWORK`, and `STELLAR_HORIZON_URL`. Reputation needs the shared database, broker, encryption key, OAuth credentials, Stellar network and Horizon settings, `STELLAR_RPC_URL`, and a positive `SYNC_WORKER_POLL_INTERVAL_MS`. Production provider URLs use HTTPS. `X_AUTO_SYNC_INTERVAL_HOURS` must be `0`.

Use `compose.test.yml` and `scripts/test-with-services.sh` only with disposable local data. Transactional tests require `LUMENRISE_TEST_DB_URI` pointing to a disposable replica set. Never point tests at production.

The CI workflows in both repositories check out both services, run migrations and full tests against disposable MongoDB and RabbitMQ, and require model parity. Configure the repository secret `MODEL_PARITY_READ_TOKEN` with read access to the other private repository on each side.

## Refresh and retention

GitHub and X refresh only on manual request, at most once every 15 minutes per identity and provider. This limits X API spending; monitor rate and billing limits separately. A complete score uses all expected signals. A partial score is returned with `status: partial` and only its available signals. A failed job creates no new score; a still valid score from the same current connection may remain available. Scores older than 90 days are unavailable. Disconnect invalidates the old connection's score immediately.

A daily sweep removes GitHub and X data snapshots older than 90 days. It also removes linked reputation scores and GitHub repository facts and clears `resultSnapshot` on old jobs in the same MongoDB transaction. Pagination for a deleted historical snapshot becomes unavailable. The sweep retains at most 20 Stellar scans per identity; it deletes linked payment facts and Soroban evidence transactionally. Active scans are preserved until completion.

## Stellar and Soroban meaning

The direct activity-score endpoint calculates an observational score from any completed scan and always reports `ownershipVerified: false` and `eligibilityProof: false`. The profile and Policy use a Stellar score only for the identity's primary verified wallet. Scoring does not wait for Soroban evidence lookup. Evidence can be queued, running, not found, successful, or unavailable. Scanning an address alone proves neither ownership nor Sybil behavior. Payment and contract observations are diagnostic evidence, not a Sybil verdict.

## Recovery

For delayed jobs, inspect MongoDB `status`, `scheduledAt`, `leaseUntil`, `attempts`, and `lastError`, then provider and RabbitMQ availability. MongoDB is the source of truth; queued and expired running jobs are picked up by polling. Replay a failed GitHub or X job with a new authenticated manual refresh after the cooldown. Do not edit job records directly. Investigate RPC network and availability before replaying Soroban evidence. Keep administrative access private.

The private readiness endpoint is `GET http://127.0.0.1:${HEALTH_PORT:-5001}/ready`. It reports MongoDB and RabbitMQ connectivity, queued/running/failed jobs, oldest pending age, unavailable Soroban evidence, and `needsAttention`. It stays ready during a broker outage while MongoDB polling can process jobs. Configure the deployment monitor to alert when readiness is non-200 or `needsAttention` is true; inspect the structured error event and job record to diagnose. Do not expose the endpoint or database repair access publicly.
