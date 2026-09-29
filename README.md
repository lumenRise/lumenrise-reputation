# Lumenrise Reputation

Private worker service for identity, provider evidence, scoring, policy evaluation, and Stellar scans. This repository has no public HTTP API. `lumenrise-api` remains the only client-facing entry point.

## Current status

The runtime connects to the **same MongoDB database** used by `lumenrise-api` and to RabbitMQ. GitHub synchronization and its reputation calculation run here. The API creates the durable `IntegrationSyncJob` record and publishes `{ "jobId": "..." }` to the durable `lumenrise.reputation.github-sync.v1` queue. This worker claims only GitHub jobs; the API worker handles X. The worker also polls MongoDB for due GitHub jobs, so a missed RabbitMQ notification does not lose work.

## Local setup

Use Node.js 24 or newer and a MongoDB replica set. Environment settings use `envyra`, as in `lumenrise-api`. Copy `.env.example` to `.env` and set `DB_URI`, `DB_NAME`, `RABBITMQ_URL`, and `CREDENTIAL_ENCRYPTION_KEY` to the exact values used by `lumenrise-api`. Set the GitHub OAuth client ID and secret used by the API so this worker can refresh expired GitHub tokens. Then run:

```bash
npm ci
npm run build
npm run dev
```

The worker starts consuming GitHub jobs after connecting to MongoDB and RabbitMQ. To stop it, send SIGINT or SIGTERM. `npm run check` verifies TypeScript without producing build output.

## Shared-data rule

The backend repositories use one MongoDB database and matching Mongoose model files. MongoDB stores shared data, while RabbitMQ carries worker commands. During this migration, the API still handles X synchronization and connection changes; Reputation handles GitHub synchronization. `npm run check:model-parity` compares every copied model and direct dependency with the sibling API repository (or `LUMENRISE_API_PATH`). This check is for development; the service builds and runs without the API checkout. Apply a model change to both repositories and pass the parity check before deployment.

## Next migration stages

1. Move the remaining X, Stellar, remaining scoring, and policy workers.
2. Move identity operations while keeping public routes and session issuance in the API.

The launch service is outside these stages.
