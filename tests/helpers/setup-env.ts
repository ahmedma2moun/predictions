import { config } from 'dotenv';
import path from 'path';

// Loaded before every test file — points Prisma + the football service at the
// local test DB and mock provider (see .env.test).
config({ path: path.resolve(__dirname, '../../.env.test') });
