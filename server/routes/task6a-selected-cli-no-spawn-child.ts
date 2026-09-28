/** Disposable PRD-only no-spawn fixture; never selected by the live service. */
import express from 'express';

import prdRouter from './prd-generator.js';

const app = express();
app.use(express.json());
app.use('/api', prdRouter);
app.get('/api/task6a-after-prd', (_request, response) => {
  response.json({ reachable: true });
});

const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('MC_TASK6A_PRIVATE_PORT_INVALID');
  process.stdout.write(`${JSON.stringify({ port: address.port })}\n`);
});

process.once('SIGTERM', () => {
  server.close(() => process.exit(0));
});
