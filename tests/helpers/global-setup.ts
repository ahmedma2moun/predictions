import { assertLocalTestDatabase } from './test-database';
import { config } from 'dotenv';
import path from 'path';
import { execFileSync } from 'child_process';

export default function globalSetup() {
  config({ path: path.resolve(__dirname, '../../.env.test') });

  assertLocalTestDatabase();

  // Keep the test DB schema current before any test file runs.
  execFileSync(process.execPath, [path.resolve(__dirname, '../../node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
  });
}
