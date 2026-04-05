// Prisma singleton — use `prisma` from '@/lib/prisma' directly in new code.
export { prisma } from './prisma';

// No-op kept for any stale import sites during migration.
export async function connectDB() {}
