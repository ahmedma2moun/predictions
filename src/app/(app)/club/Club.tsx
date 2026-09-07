'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Trophy, Flame, Users, Share2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gameRequest, useGameResource } from '@/lib/game/client';
import type { GameHub } from '@/lib/game/types';
import RecapCard from './RecapCard';

const panel = 'rounded-xl border border-border bg-card p-5 space-y-4';
const select = 'w-full min-h-11 rounded-md border border-input bg-background px-3 text-sm';
export default function Club() {
  const [groupId, setGroupId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [weekKey, setWeekKey] = useState('');
  const [tab, setTab] = useState('week');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const query = new URLSearchParams();
  if (groupId) query.set('groupId', groupId);
  if (seasonId) query.set('seasonId', seasonId);
  const { data, error, refresh, replace } = useGameResource<GameHub>(`/api/game?${query}`);
  const week = data?.weeks.find(w => w.key === weekKey) ?? data?.weeks.find(w => w.key === data.currentWeekKey) ?? data?.weeks[0];
  async function act(body: object) {
    if (!data || busy) return;
    setBusy(true); setNotice('');
    try { replace(await gameRequest<GameHub>('/api/game', { ...body, groupId: data.groupId, seasonId: data.seasonId })); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Please try again'); }
    finally { setBusy(false); }
  }
  return <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
    <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-widest uppercase text-primary">Your friends. Your game.</p><h1 className="text-3xl font-bold mt-1">The Club</h1><p className="text-muted-foreground mt-2">A fresh crown every week. A story all season.</p></div><Link href="/slip" className="rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold shrink-0">Make your picks</Link></header>
    {error && <div role="alert" className={panel}><p>{error}</p><Button onClick={refresh}>Try again</Button></div>}
    {notice && <p role="status" className="text-destructive">{notice}</p>}
    {!data && !error && <p role="status">Loading your club…</p>}
    {data && <>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm space-y-1"><span>Group</span><select className={select} disabled={busy} value={data.groupId ?? ''} onChange={e => { setGroupId(e.target.value); setWeekKey(''); }}><option value="" disabled>No group</option>{data.groups.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label><label className="text-sm space-y-1"><span>Season</span><select className={select} disabled={busy} value={data.seasonId ?? ''} onChange={e => { setSeasonId(e.target.value); setWeekKey(''); }}><option value="" disabled>No season</option>{data.seasons.map(s => <option value={s.id} key={s.id}>{s.name}{s.status === 'ACTIVE' ? ' · active' : ''}</option>)}</select></label></div>
      {!data.seasonId && <div className={panel}>Your club opens when the first season starts.</div>}
      {!data.groupId && <div className={panel}>Ask an admin to add you to a group to compete for weekly crowns and join the feed.</div>}
      <nav aria-label="Club sections" className="flex gap-2 overflow-x-auto pb-1">{[['week', 'Weekly cup', Trophy], ['feed', 'Activity', Flame], ['rival', 'My rival', Users], ['rewards', 'Challenges', Trophy], ['recap', 'My recap', Share2]].map(([id, label, Icon]) => { const SectionIcon = Icon as typeof Trophy; return <Button key={id as string} variant={tab === id ? 'default' : 'outline'} onClick={() => setTab(id as string)} aria-pressed={tab === id}><SectionIcon className="size-4" />{label as string}</Button>; })}<Button aria-label="Refresh club" variant="ghost" onClick={refresh}><RefreshCw className="size-4" /></Button></nav>
      {tab === 'week' && <section className={panel}>
        <div><h2 className="text-xl font-bold">The weekly cup</h2><p className="text-sm text-muted-foreground">Friday–Thursday, Cairo time. Prediction points only; exact scores break ties. Equal leaders share the crown.</p></div>
        {week ? <><label className="block text-sm space-y-1"><span>Game week</span><select className={select} value={week.key} onChange={e => setWeekKey(e.target.value)}>{data.weeks.map(w => <option key={w.key} value={w.key}>Week of {w.key}{w.winnerIds.length ? ' 🏆' : ''}</option>)}</select></label>
          <div className="rounded-lg bg-primary/10 p-4"><p className="font-semibold">{week.winnerIds.length ? `🏆 ${week.standings.filter(p => week.winnerIds.includes(p.userId)).map(p => p.name).join(' & ')}` : week.state === 'awaiting_results' ? 'Waiting for final results' : week.state === 'complete' ? 'No crown this week' : 'The crown is still up for grabs'}</p><p className="text-sm text-muted-foreground">{week.matchCount} matches · {week.state === 'complete' ? 'Completed' : week.state === 'awaiting_results' ? 'Unresolved matches keep the result provisional' : 'In progress'}</p></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Weekly standings</caption><thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Rank</th><th>Player</th><th>Exact</th><th className="text-right">Points</th></tr></thead><tbody>{week.standings.map(p => <tr className="border-b last:border-0" key={p.userId}><td className="py-3">{p.rank === 1 && week.winnerIds.includes(p.userId) ? '🏆' : p.rank}</td><td className="py-3 font-medium">{p.name}{p.userId === data.userId ? ' (you)' : ''}{p.title && <span className="block text-xs text-primary">{p.title}</span>}</td><td>{p.exact}</td><td className="text-right font-mono font-bold">{p.points}</td></tr>)}</tbody></table></div>
          <h3 className="font-semibold">Previous winners</h3>{data.weeks.filter(w => w.winnerIds.length).length === 0 && <p className="text-sm text-muted-foreground">The first crown is waiting to be won.</p>}{data.weeks.filter(w => w.winnerIds.length).slice(0, 12).map(w => <button key={w.key} onClick={() => setWeekKey(w.key)} className="w-full text-left rounded-md border p-3 text-sm">🏆 {w.key} · {w.standings.filter(p => w.winnerIds.includes(p.userId)).map(p => p.name).join(' & ')}</button>)}
        </> : <p>No group competition yet.</p>}
      </section>}
      {tab === 'feed' && <section className={panel}><h2 className="text-xl font-bold">Around the group</h2><p className="text-sm text-muted-foreground">Exact scores, prediction-points lead changes, and weekly winners. Picks only appear after results are scored.</p>{!data.feed.length && <p>The story starts with your first scored match.</p>}{data.feed.map(event => <article key={event.key} className="border-t pt-4 space-y-2"><p>{event.text}</p><p className="text-xs text-muted-foreground">{new Date(event.at).toLocaleDateString('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short' })}{event.matchId && <> · <Link className="underline" href={`/matches/${event.matchId}`}>View match</Link></>}</p><div className="flex gap-2">{event.reactions.map(r => <Button size="sm" variant={r.mine ? 'default' : 'outline'} disabled={busy} aria-label={`React ${r.emoji}, ${r.count} reactions`} aria-pressed={r.mine} key={r.emoji} onClick={() => act({ action: 'reaction', eventKey: event.key, emoji: r.mine ? null : r.emoji })}>{r.emoji} {r.count || ''}</Button>)}</div></article>)}</section>}
      {tab === 'rival' && <section className={panel}><h2 className="text-xl font-bold">Make it personal</h2><p className="text-sm text-muted-foreground">Follow one friend from this group. The comparison uses this season; match wins compare games you both predicted.</p><label className="block text-sm space-y-1"><span>Your rival</span><select className={select} disabled={busy} value={data.rival?.userId ?? ''} onChange={e => act({ action: 'rival', rivalId: e.target.value ? Number(e.target.value) : null })}><option value="">Choose a rival</option>{data.players.filter(p => p.id !== data.userId).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>{data.rival && <><p className="text-2xl font-bold">{data.rival.gap === 0 ? 'All square' : `${Math.abs(data.rival.gap)} points ${data.rival.gap > 0 ? 'ahead' : 'behind'}`}</p><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-primary/10 p-4"><p>You</p><p className="text-3xl font-bold">{data.rival.myPoints}</p><p className="text-sm">{data.rival.myAccuracy}% correct outcomes</p></div><div className="rounded-lg bg-muted p-4"><p>{data.rival.name}</p><p className="text-3xl font-bold">{data.rival.theirPoints}</p><p className="text-sm">{data.rival.theirAccuracy}% correct outcomes</p></div></div><p>{data.rival.wins} wins · {data.rival.losses} losses · {data.rival.draws} draws</p></>}</section>}
      {tab === 'rewards' && <section className="space-y-4"><div><h2 className="text-xl font-bold">Earn your reputation</h2><p className="text-sm text-muted-foreground">Unlock profile titles through play. Rewards never add competitive points. Progress uses the selected season; claimed titles stay yours.</p></div>{data.equippedTitle && <div className={panel}><p>Your title: <strong className="text-primary">{data.equippedTitle}</strong></p><Button variant="outline" disabled={busy} onClick={() => act({ action: 'title', key: null })}>Remove title</Button></div>}<div className="grid sm:grid-cols-2 gap-4">{data.challenges.map(c => <article className={panel} key={c.key}><h3 className="font-bold">{c.unlocked ? '🏅 ' : ''}{c.name}</h3><p className="text-sm text-muted-foreground">{c.description}</p><progress className="w-full accent-primary" max={c.target} value={c.progress} aria-label={`${c.name}: ${c.progress} of ${c.target}`} /><p className="text-sm">{c.progress}/{c.target} · Unlock “{c.title}”</p><Button disabled={busy || !c.unlocked || data.equippedTitle === c.title} onClick={() => act({ action: 'title', key: c.key })}>{data.equippedTitle === c.title ? 'Equipped' : c.unlocked ? 'Equip title' : 'Keep playing'}</Button></article>)}</div></section>}
      {tab === 'recap' && (data.recap ? <RecapCard recap={data.recap} /> : <div className={panel}>Your recap will appear once a season starts.</div>)}
    </>}
  </div>;
}
