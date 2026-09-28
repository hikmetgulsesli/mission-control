/** Disposable Task6A agent-feed route harness; never used by live MC. */
import express from 'express';

import activityRouter from './setfarm-activity.js';
import sql from '../utils/pg.js';

const app = express();
app.use(express.json());
app.get('/api/health', async (_request, response) => {
  try {
    const rows = await sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM public.agent_feed`;
    response.json({ database: 'up', feed: rows[0]?.count ?? null });
  } catch {
    response.status(503).json({ database: 'down' });
  }
});
app.use('/api', activityRouter);
app.get('/api/task6a-after-feed', (_request, response) => {
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
