import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { ValidationError } from '@/lib/validation';

type RouteHandler<Args extends unknown[]> = (...args: Args) => Promise<NextResponse>;

export function withErrorHandling<Args extends unknown[]>(
  routeName: string,
  handler: RouteHandler<Args>,
): RouteHandler<Args> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      logger.error(`[${routeName}] Unhandled error`, { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
