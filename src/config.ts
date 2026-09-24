import 'dotenv/config';

const required = (name: 'DB_URI' | 'DB_NAME' | 'RABBITMQ_URL'): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
};

const config = {
  dbUri: required('DB_URI'),
  dbName: required('DB_NAME'),
  rabbitmqUrl: required('RABBITMQ_URL'),
};

if (!/^mongodb(?:\+srv)?:\/\//.test(config.dbUri)) {
  throw new Error('DB_URI must be a MongoDB connection string');
}

if (!/^amqps?:\/\//.test(config.rabbitmqUrl)) {
  throw new Error('RABBITMQ_URL must be an AMQP connection string');
}

export default config;
