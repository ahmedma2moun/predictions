import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { getMobileSession } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { GameError, getGameHub, positiveId, updateGame } from './service';
import { getSlip, saveSlip } from './slip-service';

export function gameRoute(mobile: boolean, resource: 'hub' | 'slip', mutation = false) {
  return async (req: NextRequest) => {
    try {
      const session = mobile ? await getMobileSession(req) : await auth();
      if (!session) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
      const userId = mobile ? positiveId((session as { id: string }).id) : getSessionUser(session as Session).id;
      // Resolve current account state rather than trusting stale token roles.
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
      if (!user) throw new GameError('Sign in again', 401);
      if (mutation && user.role !== 'user') throw new GameError('Player accounts only', 403);
      let result;
      if (mutation) {
        let body: unknown;
        try { body = await req.json(); } catch { throw new GameError('Invalid JSON'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GameError('Invalid request');
        result = resource === 'slip' ? await saveSlip(userId, body as Record<string, unknown>) : await updateGame(userId, body as Record<string, unknown>);
      } else {
        const groupId = req.nextUrl.searchParams.get('groupId');
        const seasonId = req.nextUrl.searchParams.get('seasonId');
        result = resource === 'slip' ? await getSlip(userId) : await getGameHub(userId, groupId === null ? undefined : positiveId(groupId), seasonId === null ? undefined : positiveId(seasonId));
      }
      return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
      if (error instanceof GameError) return NextResponse.json({ error: error.message }, { status: error.status });
      logger.error('[game]', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Unable to load or save. Please try again.' }, { status: 500 });
    }
  };
}
