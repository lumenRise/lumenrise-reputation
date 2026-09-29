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
  GITHUB_CLIENT_ID: { default: '' },
  GITHUB_CLIENT_SECRET: { default: '', secret: true },
  CREDENTIAL_ENCRYPTION_KEY: { secret: true },
});

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production' ? undefined : 'file';

const env = createEnv(schema, { source });

export default env;
