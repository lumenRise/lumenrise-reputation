# Lumenrise Reputation

Private worker service for identity, provider evidence, scoring, policy evaluation, and Stellar scans. This repository has no public HTTP API. `lumenrise-api` remains the only client-facing entry point.

## Stage 1 status

The runtime connects to the **same MongoDB database** used by `lumenrise-api` and to RabbitMQ. No message consumers, business logic, models, migrations, or collection writes have been moved yet. The existing API continues to run its workers until later migration stages.

## Local setup

Use Node.js 24 or newer and a MongoDB replica set. Copy `.env.example` to `.env` and set `DB_URI` and `DB_NAME` to the exact values used by `lumenrise-api`. Set `RABBITMQ_URL` to the broker address. Then run:

```bash
npm ci
npm run build
npm run dev
```

The worker will report that both connections are ready. It does not process jobs in stage 1. To stop it, send SIGINT or SIGTERM. `npm run check` verifies TypeScript without producing build output.

## Shared-data rule

The three backend repositories will use one MongoDB database. A collection has one owning service for writes and migrations; other services may read it using the same versioned schema. MongoDB stores shared data, while RabbitMQ carries commands and domain events. Schema source and versioning will be extracted from `lumenrise-api` before any model is moved. This stage deliberately does not duplicate the existing Mongoose models.

## Next migration stages

1. Establish the versioned shared model package and message contracts, including collection ownership and migration rules.
2. Move one integration sync worker end to end and preserve API job status behavior.
3. Move the remaining provider, Stellar, scoring, and policy workers.
4. Move identity operations while keeping public routes and session issuance in the API.

The launch service is outside these stages.
