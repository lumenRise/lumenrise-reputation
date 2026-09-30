import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DB_URI = 'mongodb://127.0.0.1:27017';
process.env.DB_NAME = 'lumenrise_test';
process.env.RABBITMQ_URL = 'amqp://127.0.0.1:5672';
process.env.CREDENTIAL_ENCRYPTION_KEY = '0'.repeat(64);

const env = (await import('../src/env')).default;
const validate = (await import('../src/validateRuntimeConfiguration')).default;

test('rejects invalid worker intervals, URLs, and network settings at startup', () => {
  assert.doesNotThrow(() => validate(env));
  assert.throws(() => validate({ ...env, SYNC_WORKER_POLL_INTERVAL_MS: 0 }), /positive integer/);
  assert.throws(() => validate({ ...env, HEALTH_PORT: 0 }), /valid TCP port/);
  assert.throws(() => validate({ ...env, X_AUTO_SYNC_INTERVAL_HOURS: -1 }), /non-negative/);
  assert.throws(() => validate({ ...env, X_AUTO_SYNC_INTERVAL_HOURS: 1 }), /manual only/);
  assert.throws(() => validate({ ...env, STELLAR_RPC_URL: 'invalid' }), /valid URL/);
  assert.throws(() => validate({ ...env, STELLAR_AUTH_NETWORK: 'public' }), /does not match/);
  assert.throws(() => validate({ ...env, CREDENTIAL_ENCRYPTION_KEY: 'bad' }), /64-character/);
});
