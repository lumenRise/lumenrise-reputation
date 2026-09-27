# Lumenrise Reputation

Private worker service for identity, provider evidence, scoring, policy evaluation, and Stellar scans. This repository has no public HTTP API. `lumenrise-api` remains the only client-facing entry point.

## Current status

The runtime connects to the **same MongoDB database** used by `lumenrise-api` and to RabbitMQ. The Reputation-owned Mongoose model files and their direct type/constant dependencies now live here as exact copies of the API files. No message consumers, business logic, migrations, or collection writes have been moved yet. The existing API continues to run its workers until later migration stages.

## Local setup

Use Node.js 24 or newer and a MongoDB replica set. Copy `.env.example` to `.env` and set `DB_URI` and `DB_NAME` to the exact values used by `lumenrise-api`. Set `RABBITMQ_URL` to the broker address. Then run:

```bash
npm ci
npm run build
npm run dev
```

The worker will report that both connections are ready. It does not process jobs yet. To stop it, send SIGINT or SIGTERM. `npm run check` verifies TypeScript without producing build output.

## Shared-data rule

The three backend repositories will use one MongoDB database. A collection has one owning service for writes and migrations; other services may read it using matching schema files. MongoDB stores shared data, while RabbitMQ carries commands and domain events. Only the models that Reputation will own are copied here. The API retains its current files while routes and workers are migrated. `npm run check:model-parity` compares every copied model and direct dependency with the sibling API repository (or `LUMENRISE_API_PATH`). This check is for development; the service builds and runs without the API checkout. A model change must be applied to both repositories and pass the parity check before deployment.

## Next migration stages

1. Define the RabbitMQ message contract and move one integration sync worker end to end while preserving API job status behavior.
2. Move the remaining provider, Stellar, scoring, and policy workers.
3. Move identity operations while keeping public routes and session issuance in the API.

The launch service is outside these stages.
