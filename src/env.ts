import { createEnv, defineConfig } from 'envyra';

const schema = defineConfig({
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'test', 'production'],
    default: 'development',
  },
  LOG_LEVEL: {
    type: 'enum',
    values: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
    default: 'info',
    description: 'Logging verbosity.',
  },
  DB_URI: {
    description: 'MongoDB connection string shared with the API.',
  },
  DB_NAME: {
    description: 'MongoDB database name shared with the API.',
  },
  RABBITMQ_URL: {
    description: 'RabbitMQ connection string shared with the API.',
  },
  SYNC_WORKER_POLL_INTERVAL_MS: {
    type: 'number',
    default: 2_000,
  },
  HEALTH_PORT: {
    type: 'number',
    default: 5_001,
  },
  GITHUB_CLIENT_ID: {
    default: '',
  },
  GITHUB_CLIENT_SECRET: {
    default: '',
    secret: true,
  },
  X_CLIENT_ID: {
    default: '',
  },
  X_CLIENT_SECRET: {
    default: '',
    secret: true,
  },
  X_AUTO_SYNC_INTERVAL_HOURS: {
    type: 'number',
    default: 0,
  },
  CREDENTIAL_ENCRYPTION_KEY: {
    secret: true,
  },
  STELLAR_TESTNET_RPC_URL: {
    default: 'https://soroban-testnet.stellar.org',
  },
  STELLAR_TESTNET_HORIZON_URL: {
    default: 'https://horizon-testnet.stellar.org',
  },
  LAUNCH_TESTNET_FACTORY_CONTRACT_ID: {
    default: '',
  },
  STELLAR_PUBLIC_RPC_URL: {
    default: '',
  },
  STELLAR_PUBLIC_HORIZON_URL: {
    default: 'https://horizon.stellar.org',
  },
  LAUNCH_PUBLIC_FACTORY_CONTRACT_ID: {
    default: '',
  },
});

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production' ? undefined : 'file';

const env = createEnv(schema, { source });

export default env;
