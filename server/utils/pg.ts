import { freshMissionControlSqlV1 } from '../services/fresh-installation-runtime.js';
/**
 * Shared PostgreSQL connection pool for Mission Control.
 * Uses porsager/postgres (tagged template SQL).
 */
import postgres from 'postgres';

// Use SETFARM_PG_URL if available (systemd), else individual PG* env vars
const pgUrl = process.env.SETFARM_PG_URL || process.env.DATABASE_URL;
const selectedSql = freshMissionControlSqlV1();
const sql = selectedSql ?? (pgUrl
  ? postgres(pgUrl, { max: 10, idle_timeout: 30, connect_timeout: 10 })
  : postgres({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'setfarm',
      username: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
    }));

export default sql;
export { sql };
