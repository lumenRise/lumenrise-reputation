import { createServer } from 'node:net';

const getFreePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not reserve a local test port');
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
};

export default getFreePort;
