#!/usr/bin/env node
// Tiny mock of /api/mobile/* backed by contract/fixtures — for running the native apps (and taking
// parity screenshots) without a backend:  node native/contract/mock-server.mjs [port]
//   MOCK_CHAMPION=open|locked|disabled   (default open)
//   MOCK_LOGIN_FAIL=1                    make login return 401
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fx = (name) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
const port = Number(process.argv[2] ?? 3000);

function route(method, url) {
  const { pathname, searchParams } = new URL(url, 'http://x');
  const p = pathname.replace(/^\/api\/mobile/, '');
  const m = (re) => p.match(re);
  if (p === '/auth/login') return process.env.MOCK_LOGIN_FAIL ? [401, { error: 'Invalid credentials' }] : [200, fx('auth-login')];
  if (p === '/matches') {
    const status = searchParams.get('status');
    return [200, fx('matches-list').filter((x) => (status === 'live' ? x.status === 'live' : x.status !== 'live'))];
  }
  let g;
  if ((g = m(/^\/matches\/([^/]+)\/form$/))) return [200, fx('match-form')];
  if ((g = m(/^\/matches\/([^/]+)\/live$/))) return [200, fx('match-live')];
  if ((g = m(/^\/matches\/([^/]+)\/group-predictions$/))) return [200, fx('match-group-predictions')];
  if ((g = m(/^\/matches\/([^/]+)$/))) return [200, { ...fx(g[1] === '99' ? 'match-detail-finished' : 'match-detail'), _id: g[1] }];
  if (p === '/predictions' && method === 'POST') return [200, fx('prediction-save-response')];
  if (p === '/predictions') return [200, fx('predictions-history')];
  if (p === '/predictions/stats') return [200, fx('predictions-stats')];
  if (p === '/predictions/slip' && method === 'POST') return [200, fx('slip-save-response')];
  if (p === '/predictions/slip') return [200, fx('slip')];
  if (p === '/leaderboard') return [200, fx('leaderboard')];
  if (p === '/leaderboard/live') return [200, fx('leaderboard-live')];
  if (p === '/leaderboard/user-predictions') return [200, fx('leaderboard-user-predictions')];
  if (p === '/groups') return [200, fx('groups')];
  if (p === '/leagues') return [200, fx('leagues')];
  if (p === '/seasons') return [200, fx('seasons')];
  if ((g = m(/^\/seasons\/([^/]+)$/))) return [200, fx('season-detail')];
  if (p === '/champion-bonus/pick') return [200, fx('success')];
  if (p === '/champion-bonus') return [200, fx(`champion-bonus-${process.env.MOCK_CHAMPION ?? 'open'}`)];
  if (p === '/game' && method === 'POST') return [200, fx('success')];
  if (p === '/game') return [200, fx('game-hub')];
  if (p === '/reminders' && method === 'PUT') return [200, fx('reminders-save-response')];
  if (p === '/reminders') return [200, fx('reminders')];
  if (p === '/devices') return [200, fx('success')];
  return [404, { error: 'Not found' }];
}

createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const [status, json] = route(req.method, req.url);
    console.log(req.method, req.url, body ? body.slice(0, 120) : '', '->', status);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(json));
  });
}).listen(port, () => console.log(`mock API on http://localhost:${port}`));
