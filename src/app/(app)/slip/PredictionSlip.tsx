'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { gameRequest, useGameResource } from '@/lib/game/client';
import type { SlipData, SlipResult } from '@/lib/game/types';

type Draft = { home: string; away: string };
export default function PredictionSlip() {
  const { data, error, replace, refresh } = useGameResource<SlipData>('/api/predictions/slip');
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [missingOnly, setMissingOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(0);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, []);
  const locked = (m: SlipData['matches'][number]) => m.locked || new Date(m.kickoffTime).getTime() <= now;
  const remaining = data?.matches.filter(m => !locked(m) && m.homeScore === null).length ?? 0;
  async function save() {
    if (!data || busy) return;
    const pending = data.matches.filter(m => drafts[m.id] && !locked(m));
    if (!pending.length) return;
    const invalid: Record<number, string> = {};
    for (const m of pending) if (!/^\d{1,2}$/.test(drafts[m.id].home) || !/^\d{1,2}$/.test(drafts[m.id].away)) invalid[m.id] = 'Enter both scores, from 0 to 99.';
    setErrors(invalid);
    if (Object.keys(invalid).length) { setNotice('Check the highlighted predictions. Nothing has been saved.'); return; }
    setBusy(true); setNotice('');
    const results: SlipResult[] = [];
    try {
      for (let i = 0; i < pending.length; i += 50) {
        const response = await gameRequest<{ results: SlipResult[] }>('/api/predictions/slip', { predictions: pending.slice(i, i + 50).map(m => ({ matchId: m.id, homeScore: Number(drafts[m.id].home), awayScore: Number(drafts[m.id].away) })) });
        results.push(...response.results);
      }
      setNotice(`${results.filter(r => r.saved).length} predictions saved.${results.some(r => !r.saved) ? ' Some matches could not be saved; check below.' : ''}`);
    } catch (e) { setNotice(`${e instanceof Error ? e.message : 'Save failed'}. Your unsaved entries are still here; retry to confirm them.`); }
    finally {
      const saved = new Set(results.filter(r => r.saved).map(r => r.matchId));
      replace({ ...data, matches: data.matches.map(m => saved.has(m.id) ? { ...m, homeScore: Number(drafts[m.id].home), awayScore: Number(drafts[m.id].away) } : m) });
      setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !saved.has(Number(id)))));
      setErrors(Object.fromEntries(results.filter(r => !r.saved).map(r => [r.matchId, r.error ?? 'Try again'])));
      setBusy(false);
    }
  }
  return <div className="max-w-3xl mx-auto px-4 py-6 space-y-5"><div><Link href="/matches" className="text-sm text-muted-foreground underline">Back to matches</Link><h1 className="text-3xl font-bold mt-3">Your matchday slip</h1><p className="text-muted-foreground mt-2">All your picks for the next seven Cairo calendar days, in one place.</p></div>
    {error && <div role="alert"><p>{error}</p><Button onClick={refresh}>Try again</Button></div>}
    {!data && !error && <p role="status">Loading fixtures…</p>}
    {data && <><div className="flex items-center justify-between gap-3 rounded-xl bg-primary/10 p-4"><div><p className="text-xl font-bold">{remaining} predictions remaining</p><p className="text-xs text-muted-foreground">Counts saved picks only. Each match locks at kickoff.</p></div><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} />Unfinished only</label></div>
      <div className="space-y-3">{data.matches.filter(m => !missingOnly || (!locked(m) && m.homeScore === null)).map(m => {
        const draft = drafts[m.id] ?? { home: m.homeScore?.toString() ?? '', away: m.awayScore?.toString() ?? '' };
        const isLocked = locked(m);
        const dirty = !!drafts[m.id];
        const edit = (side: keyof Draft, value: string) => setDrafts(previous => ({ ...previous, [m.id]: { ...draft, [side]: value } }));
        return <article key={m.id} className="rounded-xl border bg-card p-4 space-y-3"><div className="flex justify-between text-xs text-muted-foreground gap-2"><span>{m.league} · {new Date(m.kickoffTime).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span className={dirty ? 'text-amber-600' : 'text-primary'}>{isLocked ? 'Locked' : dirty ? 'Unsaved' : m.homeScore !== null ? '✓ Saved' : 'Open'}</span></div><div className="grid grid-cols-[1fr_3.5rem_3.5rem_1fr] gap-2 items-center"><label htmlFor={`home-${m.id}`} className="text-sm font-semibold">{m.homeTeamName}</label><Input id={`home-${m.id}`} aria-label={`${m.homeTeamName} goals against ${m.awayTeamName}`} aria-invalid={!!errors[m.id]} type="text" inputMode="numeric" maxLength={2} value={draft.home} onChange={e => edit('home', e.target.value)} disabled={busy || isLocked} className="text-center text-lg font-bold h-12" /><Input id={`away-${m.id}`} aria-label={`${m.awayTeamName} goals against ${m.homeTeamName}`} aria-invalid={!!errors[m.id]} type="text" inputMode="numeric" maxLength={2} value={draft.away} onChange={e => edit('away', e.target.value)} disabled={busy || isLocked} className="text-center text-lg font-bold h-12" /><label htmlFor={`away-${m.id}`} className="text-sm font-semibold text-right">{m.awayTeamName}</label></div>{errors[m.id] && <p role="alert" className="text-sm text-destructive">{errors[m.id]}</p>}{isLocked && dirty && <p className="text-sm text-destructive">Kickoff passed before this edit was saved. Your previous saved pick still applies.</p>}<Link href={`/matches/${m.id}`} className="text-xs underline text-muted-foreground">Form and match details</Link></article>;
      })}</div>
      {data.matches.length === 0 && <p>No fixtures in the next seven days. Check back when the next matches are added.</p>}
      {missingOnly && remaining === 0 && <p>You’re all set. Every open match has a saved pick.</p>}
      <div className="sticky bottom-20 md:bottom-4 rounded-xl border bg-card/95 backdrop-blur p-4 shadow-lg space-y-2"><Button className="w-full" onClick={save} disabled={busy || !data.matches.some(m => drafts[m.id] && !locked(m))}>{busy ? 'Saving your picks…' : 'Save predictions'}</Button>{notice && <p role="status" className="text-sm">{notice}</p>}</div>
    </>}
  </div>;
}
