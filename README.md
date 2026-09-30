# Lumenrise Reputation

Private worker service for provider evidence, reputation scoring, and Stellar activity scans. It has no public HTTP API; `lumenrise-api` handles all client requests, OAuth callbacks, sessions, and direct reads from MongoDB.

## Runtime

Both repositories connect to the same MongoDB database. The API records GitHub and X sync jobs in `IntegrationSyncJob` and Stellar scan jobs in `StellarActivityScan`. It sends a persistent `{ "jobId": "..." }` notification to the matching durable RabbitMQ queue:

| Work | Queue |
| --- | --- |
| GitHub sync and developer score | `lumenrise.reputation.github-sync.v1` |
| X sync and social score | `lumenrise.reputation.x-sync.v1` |
| Stellar activity scan | `lumenrise.reputation.stellar-scan.v1` |

Workers also poll MongoDB for due jobs, so a missed RabbitMQ notification does not lose work. Soroban evidence lookup polls its MongoDB queue. GitHub and X refresh only on manual request; `X_AUTO_SYNC_INTERVAL_HOURS` must be zero. API responses that can be computed from existing MongoDB data stay in the API.

## Local setup

Use Node.js 24 or newer, a MongoDB replica set, and RabbitMQ. Environment settings use `envyra`, as in the API. Copy `.env.example` to `.env` and set `DB_URI`, `DB_NAME`, `RABBITMQ_URL`, and `CREDENTIAL_ENCRYPTION_KEY` to the same values used by the API. Set the GitHub and X OAuth client credentials used by the API so workers can refresh provider tokens. Set the Stellar URLs and network to match the API. Then run:

```bash
npm ci
npm run build
npm run dev
```

SIGINT and SIGTERM stop the workers and close database and RabbitMQ connections. `npm run check` verifies TypeScript without producing build output.

`npm test` runs worker and scoring tests. Set `LUMENRISE_TEST_DB_URI` to a disposable MongoDB replica set to include transactional integration tests; the suite creates and drops its own random databases. With Docker Compose available, `scripts/test-with-services.sh` starts isolated MongoDB and RabbitMQ and runs both repositories' checks. See [operations](docs/operations.md) for deployment, refresh, retention, and recovery behavior.

## Shared models

The repositories use matching Mongoose model files against one MongoDB database. Apply every model change to both repositories. `npm run check:model-parity` compares the copied model files and their direct dependencies with the API checkout (or `LUMENRISE_API_PATH`). This check is for development; Reputation builds and runs without an API checkout.

The token launch service is a later stage.
