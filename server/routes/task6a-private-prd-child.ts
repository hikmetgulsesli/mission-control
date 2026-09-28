/** Disposable Task6A PRD-only harness; never selected by the live service. */
import express from 'express';

import prdRouter from './prd-generator.js';
import sql from '../utils/pg.js';

const app = express();
app.use(express.json());
app.get('/api/health', async (_request, response) => {
  try {
    const rows = await sql<Array<{ count: number }>>`SELECT COUNT(*)::integer AS count FROM public.prds`;
    response.json({ database: 'up', prds: rows[0]?.count ?? null });
  } catch {
    response.status(503).json({ database: 'down' });
  }
});
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
  server.close(() => {
    void sql.end({ timeout: 5 }).finally(() => process.exit(0));
  });
});
