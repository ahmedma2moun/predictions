import { after, NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMobileSession } from '@/lib/mobile-auth';
import { withErrorHandling } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { flushLogs } from '@/lib/logging/transport';
import { sanitizeBody } from '@/lib/logging/redact';

type LoggedHandler<Args extends unknown[]> = (req: NextRequest, ...rest: Args) => Promise<NextResponse>;

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface LogUser { id: string; name: string | null; role: string | null }

async function resolveUser(req: NextRequest, mobile: boolean): Promise<LogUser | null> {
  try {
    if (mobile) {
      const s = await getMobileSession(req);
      return s ? { id: String(s.id), name: s.name ?? null, role: s.role ?? null } : null;
    }
    const s = await auth();
    const u = s?.user as { id?: string; name?: string | null; role?: string } | undefined;
    return u?.id ? { id: String(u.id), name: u.name ?? null, role: u.role ?? null } : null;
  } catch {
    return null;
  }
}

async function readText(source: Request | Response): Promise<string> {
  try { return await source.clone().text(); } catch { return ''; }
}

function scheduleFlush() {
  try {
    after(() => flushLogs());
  } catch {
    // Outside a request scope (tests, scripts) — flush directly.
    void flushLogs();
  }
}

/**
 * Logs user, path, request body, response, status and duration for every call,
 * on top of withErrorHandling. Handlers need no logging code of their own.
 */
export function withApiLogging<Args extends unknown[]>(
  routeName: string,
  handler: LoggedHandler<Args>,
): LoggedHandler<Args> {
  return async (req, ...rest) => {
    const started = performance.now();
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
    const mobile = req.nextUrl.pathname.startsWith('/api/mobile/');
    const requestText = BODY_METHODS.has(req.method) ? await readText(req) : '';

    let caught: unknown;
    const safe = withErrorHandling(routeName, handler as (...a: unknown[]) => Promise<NextResponse>, e => { caught = e; });
    const res = await safe(req, ...rest);

    try {
      const [user, responseText] = await Promise.all([resolveUser(req, mobile), readText(res)]);
      const reqBody = sanitizeBody(requestText);
      const resBody = sanitizeBody(responseText);
      const entry = {
        event: 'api.request',
        requestId,
        route: routeName,
        user,
        platform: mobile ? 'mobile' : 'web',
        method: req.method,
        path: req.nextUrl.pathname,
        query: req.nextUrl.search.replace(/^\?/, ''),
        status: res.status,
        durationMs: Math.round(performance.now() - started),
        requestBody: reqBody.text,
        responseBody: resBody.text,
        truncated: reqBody.truncated || resBody.truncated,
        ...(resBody.truncated && resBody.items !== undefined && { responseItems: resBody.items }),
        ...(caught !== undefined && {
          error: caught instanceof Error
            ? { message: caught.message, stack: caught.stack?.split('\n').slice(0, 4).join('\n') }
            : { message: String(caught) },
        }),
      };
      const level = res.status >= 500 ? 'error' : res.status >= 400 ? 'warn' : 'info';
      logger[level]('api.request', entry);
    } catch {
      // Logging must never break the response.
    }

    scheduleFlush();
    res.headers.set('x-request-id', requestId);
    return res;
  };
}
