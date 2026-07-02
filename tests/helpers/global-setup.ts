import { config } from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';

export default function globalSetup() {
  config({ path: path.resolve(__dirname, '../../.env.test') });

  // Keep the test DB schema current before any test file runs.
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
  });
}
