import { createEnv, defineConfig } from 'envyra';

const schema = defineConfig({
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'test', 'production'],
    default: 'development',
  },
  DB_URI: { description: 'MongoDB connection string shared with the API.' },
  DB_NAME: { description: 'MongoDB database name shared with the API.' },
  RABBITMQ_URL: { description: 'RabbitMQ connection string shared with the API.' },
  SYNC_WORKER_POLL_INTERVAL_MS: { type: 'number', default: 2_000 },
  HEALTH_PORT: { type: 'number', default: 5_001 },
  GITHUB_CLIENT_ID: { default: '' },
  GITHUB_CLIENT_SECRET: { default: '', secret: true },
  X_CLIENT_ID: { default: '' },
  X_CLIENT_SECRET: { default: '', secret: true },
  X_AUTO_SYNC_INTERVAL_HOURS: { type: 'number', default: 0 },
  STELLAR_HORIZON_URL: { default: 'https://horizon-testnet.stellar.org' },
  STELLAR_RPC_URL: { default: 'https://soroban-testnet.stellar.org' },
  STELLAR_AUTH_NETWORK: { type: 'enum', values: ['testnet', 'public'], default: 'testnet' },
  CREDENTIAL_ENCRYPTION_KEY: { secret: true },
});

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production' ? undefined : 'file';

const env = createEnv(schema, { source });

export default env;
