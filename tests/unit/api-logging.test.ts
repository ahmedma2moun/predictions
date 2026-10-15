import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { id: '7', name: 'sam', role: 'user', email: 'sam@x.com' } })) }));
vi.mock('@/lib/mobile-auth', () => ({ getMobileSession: vi.fn(async () => ({ id: '9', name: 'mo', role: 'user', email: 'mo@x.com' })) }));

import { sanitizeBody, MAX_BODY_BYTES } from '@/lib/logging/redact';
import { enqueue, flushLogs } from '@/lib/logging/transport';
import { withApiLogging } from '@/lib/logging/with-api-logging';
import { logPredictionUpsert } from '@/lib/logging/prediction-events';
import { logger } from '@/lib/logger';

const originalToken = process.env.AXIOM_TOKEN;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.AXIOM_TOKEN; else process.env.AXIOM_TOKEN = originalToken;
});

const req = (path: string, init?: { method?: string; body?: string }) => new NextRequest(`http://localhost${path}`, init);

describe('transport', () => {
  it('sends nothing when AXIOM_TOKEN is not set', async () => {
    delete process.env.AXIOM_TOKEN;
    enqueue({ msg: 'x' });
    await flushLogs();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps plain messages without an event field out of Axiom', async () => {
    process.env.AXIOM_TOKEN = 'xaat-test';
    logger.info('[thesportsdb] GET /lookupleague.php');
    await flushLogs();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a batch to Axiom with the token when set', async () => {
    process.env.AXIOM_TOKEN = 'xaat-test';
    process.env.AXIOM_DATASET = 'predictions-api';
    logger.info('api.request', { event: 'api.request' });
    await flushLogs();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.axiom.co/v1/datasets/predictions-api/ingest');
    expect(init.headers.Authorization).toBe('Bearer xaat-test');
  });

  it('uses the edge ingest path for EU edge hosts', async () => {
    process.env.AXIOM_TOKEN = 'xaat-test';
    process.env.AXIOM_DATASET = 'prediction-api';
    process.env.AXIOM_URL = 'https://eu-central-1.aws.edge.axiom.co/v1/ingest/prediction-api';
    logger.info('api.request', { event: 'api.request' });
    await flushLogs();
    delete process.env.AXIOM_URL;
    expect(fetchMock.mock.calls[0][0]).toBe('https://eu-central-1.aws.edge.axiom.co/v1/ingest/prediction-api');
  });

  it('reports a failed send to console only', async () => {
    process.env.AXIOM_TOKEN = 'xaat-test';
    fetchMock.mockRejectedValueOnce(new Error('down'));
    logger.info('api.request', { event: 'api.request' });
    await expect(flushLogs()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('sanitizeBody', () => {
  it('redacts every denylisted key at any depth', () => {
    const keys = ['password', 'currentPassword', 'newPassword', 'token', 'accessToken', 'refreshToken', 'fcmToken', 'secret', 'authorization'];
    const input = { ...Object.fromEntries(keys.map(k => [k, 'leak'])), nested: { list: [{ password: 'leak' }] }, ok: 1 };
    const { text } = sanitizeBody(JSON.stringify(input));
    expect(text).not.toContain('leak');
    expect(JSON.parse(text).ok).toBe(1);
    expect(JSON.parse(text).nested.list[0].password).toBe('[REDACTED]');
  });

  it('redacts urlencoded form bodies', () => {
    expect(sanitizeBody('email=a%40b.com&password=hunter2').text).toBe('email=a%40b.com&password=[REDACTED]');
  });

  it('truncates large bodies and counts array items', () => {
    const big = JSON.stringify(Array.from({ length: 5000 }, (_, i) => ({ i, pad: 'xxxxxxxxxx' })));
    const out = sanitizeBody(big);
    expect(out.truncated).toBe(true);
    expect(out.text.length).toBe(MAX_BODY_BYTES);
    expect(out.items).toBe(5000);
  });
});

describe('withApiLogging', () => {
  const entries = () => (console.log as unknown as ReturnType<typeof vi.fn>).mock.calls
    .concat((console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls, (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls)
    .map(c => JSON.parse(c[0] as string))
    .filter(e => e.event === 'api.request');

  it('logs user, path, bodies, status and duration, and the handler can still read the body', async () => {
    const handler = withApiLogging('t.post', async r => {
      const body = await r.json();
      return NextResponse.json({ got: body.matchId }, { status: 409 });
    });
    const res = await handler(req('/api/predictions?x=1', { method: 'POST', body: JSON.stringify({ matchId: '812', password: 'p' }) }));
    expect(await res.json()).toEqual({ got: '812' });
    expect(res.headers.get('x-request-id')).toBeTruthy();

    const [e] = entries();
    expect(e).toMatchObject({
      user: { id: '7', name: 'sam', role: 'user' }, platform: 'web', method: 'POST',
      path: '/api/predictions', query: 'x=1', status: 409, truncated: false,
      responseBody: '{"got":"812"}',
    });
    expect(e.user.email).toBeUndefined();
    expect(e.requestBody).toBe('{"matchId":"812","password":"[REDACTED]"}');
    expect(typeof e.durationMs).toBe('number');
  });

  it('does not log GET requests', async () => {
    const handler = withApiLogging('t.get', async () => NextResponse.json([]));
    const res = await handler(req('/api/predictions'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(entries()).toHaveLength(0);
  });

  it('uses the mobile session for /api/mobile/ paths', async () => {
    const handler = withApiLogging('t.post', async () => NextResponse.json([]));
    await handler(req('/api/mobile/predictions', { method: 'POST', body: '{}' }));
    expect(entries()[0]).toMatchObject({ platform: 'mobile', user: { id: '9', name: 'mo' } });
  });

  it('logs a thrown error and returns a 500', async () => {
    const handler = withApiLogging('t.boom', async () => { throw new Error('kaboom'); });
    const res = await handler(req('/api/predictions', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(500);
    expect(entries().find(e => e.status === 500)?.error.message).toBe('kaboom');
  });
});

describe('prediction.upsert event', () => {
  it.each(['ok', 'locked', 'invalid_scores', 'not_found'] as const)('records outcome %s', outcome => {
    logPredictionUpsert({ platform: 'mobile', userId: 3, body: { matchId: '1', homeScore: 2, awayScore: 1 }, outcome, reason: outcome === 'locked' ? 'kickoff_passed' : undefined, msToKickoff: outcome === 'locked' ? -5 : undefined });
    const e = JSON.parse((console.log as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as string);
    expect(e).toMatchObject({ event: 'prediction.upsert', outcome, userId: 3, matchId: '1', homeScore: 2, awayScore: 1 });
    if (outcome === 'locked') expect(e).toMatchObject({ reason: 'kickoff_passed', msToKickoff: -5 });
  });
});
