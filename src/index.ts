import amqp from 'amqplib';
import mongoose from 'mongoose';

import config from './config.js';

const main = async (): Promise<void> => {
  mongoose.set('autoIndex', false);

  await mongoose.connect(config.dbUri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: 5_000,
  });

  let broker: Awaited<ReturnType<typeof amqp.connect>>;

  try {
    broker = await amqp.connect(config.rabbitmqUrl);
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }

  console.info('Reputation service connected to MongoDB and RabbitMQ; no consumers are registered yet.');

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;

    try {
      await broker.close();
      await mongoose.disconnect();
    } catch (error) {
      console.error('Reputation service shutdown failed', error);
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
};

void main().catch((error: unknown) => {
  console.error('Reputation service failed to start', error);
  process.exitCode = 1;
});
