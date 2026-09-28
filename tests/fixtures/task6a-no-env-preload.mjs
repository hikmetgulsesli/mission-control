/** Test child preload: env-file reads are denied before source modules load. */
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function privateReadFileSync(file, ...args) {
  const name = String(file);
  if (name.endsWith('/.env') || name.endsWith('/.env.local')) {
    const error = new Error('TASK6A_PRIVATE_ENV_FILE_READ_DENIED');
    error.code = 'ENOENT';
    throw error;
  }
  return originalReadFileSync.call(this, file, ...args);
};
syncBuiltinESMExports();
