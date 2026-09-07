'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { PlayerRecap } from '@/lib/game/types';

export default function RecapCard({ recap }: { recap: PlayerRecap }) {
  const image = useRef<SVGSVGElement>(null);
  const [notice, setNotice] = useState('');
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'My season recap', text: recap.shareText });
      else { await navigator.clipboard.writeText(recap.shareText); setNotice('Recap copied. Share it with your friends.'); }
    } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setNotice('Sharing is unavailable. Download your card instead.'); }
  }
  function download() {
    if (!image.current) return;
    const blob = new Blob([new XMLSerializer().serializeToString(image.current)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'my-season-recap.svg'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="rounded-xl border bg-card p-5 space-y-4"><h2 className="text-xl font-bold">{recap.final ? 'Your season, remembered' : 'Your season so far'}</h2><p className="text-sm text-muted-foreground">Overall season points and rank; weekly crowns are for the selected group.</p>
    <svg ref={image} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 430" role="img" aria-label={recap.shareText} className="w-full max-w-xl rounded-xl">
      <rect width="600" height="430" rx="20" fill="#101b19" /><circle cx="550" cy="30" r="150" fill="#183c32" /><text x="32" y="45" fill="#63e2a4" fontSize="14" fontFamily="sans-serif" letterSpacing="3">FOOTBALL PREDICTIONS</text>
      <text x="32" y="93" fill="white" fontSize="28" fontFamily="sans-serif" fontWeight="bold">{recap.name.slice(0, 30)}</text><text x="32" y="124" fill="#b3c9bf" fontSize="17" fontFamily="sans-serif">{recap.seasonName.slice(0, 36)} · {recap.final ? 'Final recap' : 'So far'}</text>
      <text x="32" y="203" fill="#63e2a4" fontSize="58" fontFamily="sans-serif" fontWeight="bold">{recap.totalPoints}</text><text x="32" y="232" fill="white" fontSize="17" fontFamily="sans-serif">POINTS · {recap.rank ? `#${recap.rank} OVERALL` : 'UNRANKED'}</text>
      {[[`${recap.exactScores}`, 'EXACT SCORES'], [`${recap.accuracy}%`, 'CORRECT OUTCOMES'], [`${recap.weeklyWins}`, 'WEEKLY CROWNS']].map(([value, label], i) => <g key={label}><text x={32 + i * 185} y="308" fill="white" fontSize="32" fontFamily="sans-serif" fontWeight="bold">{value}</text><text x={32 + i * 185} y="335" fill="#b3c9bf" fontSize="12" fontFamily="sans-serif">{label}</text></g>)}
      <text x="32" y="393" fill="#b3c9bf" fontSize="16" fontFamily="sans-serif">Best streak: {recap.longestStreak} · {recap.predictions} scored predictions</text>
    </svg>
    <p>Biggest weekly rank improvement: <strong>{recap.biggestComeback} places</strong></p>
    {recap.bestPrediction && <p>Best prediction: <Link className="underline" href={`/matches/${recap.bestPrediction.matchId}`}>{recap.bestPrediction.label}</Link> · {recap.bestPrediction.score} · {recap.bestPrediction.points} points</p>}
    <div className="flex flex-wrap gap-2"><Button onClick={share}>Share recap</Button><Button variant="outline" onClick={download}>Download card</Button></div>{notice && <p role="status" className="text-sm">{notice}</p>}
  </section>;
}
