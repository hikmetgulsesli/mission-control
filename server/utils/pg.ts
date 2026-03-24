/**
 * Shared PostgreSQL connection pool for Mission Control.
 * Uses porsager/postgres (tagged template SQL).
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://setrox:k7z6*n4u4@localhost:5432/setfarm';

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

export default sql;
export { sql };
