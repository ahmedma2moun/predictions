import { headers } from 'next/headers';
import type { Session } from 'next-auth';
import { auth as webAuth } from '@/lib/auth';
import { verifyAdminToken } from '@/lib/admin-mobile-token';
import { prisma } from '@/lib/prisma';

export { isSessionAdmin } from '@/lib/auth';

/** Admin APIs accept web sessions or dedicated native-admin tokens only.
 * Always reload the role: a deleted or demoted admin loses access immediately.
 */
export async function auth(): Promise<Session | null> {
  const authorization = (await headers()).get('authorization');
  let id: number | null;
  if (authorization !== null) {
    if (!authorization.startsWith('Bearer ')) return null;
    id = await verifyAdminToken(authorization.slice(7));
  } else {
    const session = await webAuth();
    id = Number((session?.user as { id?: string } | undefined)?.id);
  }
  if (!id || !Number.isSafeInteger(id)) return null;
  const user = await prisma.user.findUnique({
    where: { id }, select: { id: true, name: true, email: true, role: true },
  });
  if (user?.role !== 'admin') return null;
  return {
    user: { ...user, id: String(user.id) },
    expires: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  } as Session;
}
