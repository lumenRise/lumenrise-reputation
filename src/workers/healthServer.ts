import { createServer } from 'node:http';

import logEvent from '../logEvent';
import getOperationalStatus from '../services/health/getOperationalStatus';

const startHealthServer = async (port: number, rabbitmqReady: () => boolean) => {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/ready') {
      response.writeHead(404).end();
      return;
    }
    try {
      const status = await getOperationalStatus(rabbitmqReady());
      response.writeHead(status.ready ? 200 : 503, { 'content-type': 'application/json' });
      response.end(JSON.stringify(status));
    } catch (error) {
      logEvent('error', 'readiness_check_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ready: false }));
    }
  });
  server.on('error', (error) => logEvent('error', 'readiness_server_error', {
    errorName: error.name,
  }));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    stop: async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
};

export { startHealthServer };
