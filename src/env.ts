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

if (!/^mongodb(?:\+srv)?:\/\//.test(env.DB_URI)) {
  throw new Error('DB_URI must be a MongoDB connection string');
}

if (!/^amqps?:\/\//.test(env.RABBITMQ_URL)) {
  throw new Error('RABBITMQ_URL must be an AMQP connection string');
}

if (!/^[a-f\d]{64}$/i.test(env.CREDENTIAL_ENCRYPTION_KEY)) {
  throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-character hexadecimal key');
}

if (!Number.isInteger(env.SYNC_WORKER_POLL_INTERVAL_MS) || env.SYNC_WORKER_POLL_INTERVAL_MS < 100) {
  throw new Error('SYNC_WORKER_POLL_INTERVAL_MS must be an integer of at least 100');
}

export default env;
