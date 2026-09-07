import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/theme';
import { apiRequest } from '@/api/client';
import { useRemoteData } from '@/hooks/useRemoteData';
import { Button, Card, Heading, Input, Muted } from '@/components/ui';
import type { SlipData, SlipResult } from '@/types/game';

type Draft = { home: string; away: string };
export default function SlipScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, error, refresh } = useRemoteData(signal => apiRequest<SlipData>('/api/mobile/predictions/slip', { token, signal }), [token], { enabled: !!token });
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const locked = (m: SlipData['matches'][number]) => m.locked || new Date(m.kickoffTime).getTime() <= now;
  const remaining = data?.matches.filter(m => !locked(m) && m.homeScore === null).length ?? 0;
  async function save() {
    if (!data || busy) return;
    const pending = data.matches.filter(m => drafts[m.id] && !locked(m));
    if (!pending.length) return;
    const invalid: Record<number, string> = {};
    for (const m of pending) if (!/^\d{1,2}$/.test(drafts[m.id].home) || !/^\d{1,2}$/.test(drafts[m.id].away)) invalid[m.id] = 'Enter both scores, from 0 to 99.';
    setErrors(invalid);
    if (Object.keys(invalid).length) { setNotice('Check your scores. Nothing has been saved.'); return; }
    setBusy(true); setNotice('');
    const results: SlipResult[] = [];
    try {
      for (let i = 0; i < pending.length; i += 50) {
        const response = await apiRequest<{ results: SlipResult[] }>('/api/mobile/predictions/slip', { token, method: 'POST', body: { predictions: pending.slice(i, i + 50).map(m => ({ matchId: m.id, homeScore: Number(drafts[m.id].home), awayScore: Number(drafts[m.id].away) })) } });
        results.push(...response.results);
      }
      setNotice(`${results.filter(r => r.saved).length} predictions saved.${results.some(r => !r.saved) ? ' Check the matches that could not be saved.' : ''}`);
    } catch (e) { setNotice(`${e instanceof Error ? e.message : 'Save failed'}. Unsaved entries are still here; retry to confirm them.`); }
    finally {
      const saved = new Set(results.filter(r => r.saved).map(r => r.matchId));
      setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !saved.has(Number(id)))));
      setErrors(Object.fromEntries(results.filter(r => !r.saved).map(r => [r.matchId, r.error ?? 'Try again'])));
      setBusy(false); refresh();
    }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30, gap: 16 }}>
    <Heading>Your matchday slip</Heading><Muted>Quick picks for the next seven Cairo calendar days. Each match locks at kickoff.</Muted>
    {loading && <ActivityIndicator color={colors.primary} />}
    {error && <Card><Muted>{error}</Muted><Button onPress={refresh}>Try again</Button></Card>}
    {data && <><Card style={{ gap: 8 }}><Heading>{remaining} predictions remaining</Heading><Muted>Counts saved picks only.</Muted><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Muted>Unfinished only</Muted><Switch accessibilityLabel="Show unfinished predictions only" value={missingOnly} onValueChange={setMissingOnly} /></View></Card>
      {data.matches.filter(m => !missingOnly || (!locked(m) && m.homeScore === null)).map(m => {
        const draft = drafts[m.id] ?? { home: m.homeScore?.toString() ?? '', away: m.awayScore?.toString() ?? '' };
        const edit = (side: keyof Draft, value: string) => setDrafts(previous => ({ ...previous, [m.id]: { ...draft, [side]: value } }));
        const isLocked = locked(m);
        return <Card key={m.id} style={{ gap: 12 }}><Muted>{m.league} · {new Date(m.kickoffTime).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Muted><Text style={{ color: isLocked ? colors.mutedForeground : colors.primary }}>{isLocked ? 'Locked' : drafts[m.id] ? 'Unsaved' : m.homeScore === null ? 'Open' : '✓ Saved'}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ flex: 1, color: colors.foreground, fontWeight: '600' }}>{m.homeTeamName}</Text><Input accessibilityLabel={`${m.homeTeamName} goals against ${m.awayTeamName}`} keyboardType="number-pad" maxLength={2} editable={!busy && !isLocked} value={draft.home} onChangeText={v => edit('home', v)} style={{ width: 52, textAlign: 'center', fontWeight: 'bold' }} /><Input accessibilityLabel={`${m.awayTeamName} goals against ${m.homeTeamName}`} keyboardType="number-pad" maxLength={2} editable={!busy && !isLocked} value={draft.away} onChangeText={v => edit('away', v)} style={{ width: 52, textAlign: 'center', fontWeight: 'bold' }} /><Text style={{ flex: 1, color: colors.foreground, textAlign: 'right', fontWeight: '600' }}>{m.awayTeamName}</Text></View>{!!errors[m.id] && <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{errors[m.id]}</Text>}{isLocked && drafts[m.id] && <Muted>Kickoff passed before this edit was saved. Your previous saved pick still applies.</Muted>}<Button variant="ghost" onPress={() => router.push(`/matches/${m.id}`)}>Form and match details</Button></Card>;
      })}
      {!data.matches.length && <Muted>No fixtures in the next seven days.</Muted>}
      {missingOnly && remaining === 0 && <Muted>You’re all set. Every open match has a saved pick.</Muted>}
      <Button loading={busy} disabled={!data.matches.some(m => drafts[m.id] && !locked(m))} onPress={save}>Save predictions</Button>
    </>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: colors.foreground }}>{notice}</Text>}
  </ScrollView>;
}
