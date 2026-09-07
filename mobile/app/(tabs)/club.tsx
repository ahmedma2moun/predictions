import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Heading, Muted } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/theme';
import { useRemoteData } from '@/hooks/useRemoteData';
import { apiRequest } from '@/api/client';
import type { GameHub } from '@/types/game';

export default function ClubScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [weekKey, setWeekKey] = useState('');
  const [section, setSection] = useState('week');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const query = `${groupId ? `groupId=${groupId}&` : ''}${seasonId ? `seasonId=${seasonId}` : ''}`;
  const { data, loading, refreshing, error, refresh } = useRemoteData(signal => apiRequest<GameHub>(`/api/mobile/game?${query}`, { token, signal }), [token, groupId, seasonId], { enabled: !!token });
  const week = data?.weeks.find(w => w.key === weekKey) ?? data?.weeks.find(w => w.key === data.currentWeekKey) ?? data?.weeks[0];
  async function act(body: object) {
    if (!data || busy) return;
    setBusy(true); setNotice('');
    try { await apiRequest('/api/mobile/game', { token, method: 'POST', body: { ...body, groupId: data.groupId, seasonId: data.seasonId } }); refresh(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Please try again'); }
    finally { setBusy(false); }
  }
  if (loading && !error) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator accessibilityLabel="Loading club" color={colors.primary} /></View>;
  return <View style={{ flex: 1, backgroundColor: colors.background }}><AppHeader title="The Club" subtitle="A fresh crown every week" /><ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
    <Button onPress={() => router.push('/slip')}>Make your picks →</Button>
    {!!error && <Card><Muted>{error}</Muted><Button onPress={refresh}>Try again</Button></Card>}
    {!!notice && <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{notice}</Text>}
    {data && <>
      <Muted>Group</Muted><ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{data.groups.map(g => <Button key={g.id} disabled={busy || refreshing} variant={data.groupId === g.id ? 'primary' : 'outline'} onPress={() => { setGroupId(g.id); setWeekKey(''); }}>{g.name}</Button>)}</ScrollView>
      <Muted>Season</Muted><ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{data.seasons.map(s => <Button key={s.id} disabled={busy || refreshing} variant={data.seasonId === s.id ? 'primary' : 'outline'} onPress={() => { setSeasonId(s.id); setWeekKey(''); }}>{s.name}</Button>)}</ScrollView>
      {!data.seasonId && <Muted>Your club opens when the first season starts.</Muted>}
      {!data.groupId && <Muted>Ask an admin to add you to a group for weekly crowns and activity.</Muted>}
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{[['week', 'Weekly cup'], ['feed', 'Activity'], ['rival', 'My rival'], ['rewards', 'Challenges'], ['recap', 'My recap']].map(([key, label]) => <Button key={key} variant={section === key ? 'primary' : 'outline'} onPress={() => setSection(key)}>{label}</Button>)}</ScrollView>
      {section === 'week' && <Card style={{ gap: 14 }}><Heading>The weekly cup</Heading><Muted>Friday–Thursday, Cairo time. Prediction points only; exact scores break ties. Equal leaders share the crown.</Muted>{week ? <><ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{data.weeks.map(w => <Button key={w.key} variant={week.key === w.key ? 'primary' : 'outline'} onPress={() => setWeekKey(w.key)}>{w.key}{w.winnerIds.length ? ' 🏆' : ''}</Button>)}</ScrollView><Heading>{week.winnerIds.length ? `🏆 ${week.standings.filter(p => week.winnerIds.includes(p.userId)).map(p => p.name).join(' & ')}` : week.state === 'awaiting_results' ? 'Waiting for final results' : week.state === 'complete' ? 'No crown this week' : 'The crown is still up for grabs'}</Heading><Muted>{week.matchCount} matches · {week.state === 'complete' ? 'Completed' : 'Provisional'}</Muted>{week.standings.map(p => <View key={p.userId} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 }}><Text style={{ color: colors.primary, width: 24 }}>{p.rank}</Text><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontWeight: '600' }}>{p.name}{p.userId === data.userId ? ' (you)' : ''}</Text>{p.title && <Text style={{ color: colors.primary, fontSize: 12 }}>{p.title}</Text>}<Muted>{p.exact} exact scores</Muted></View><Heading>{p.points}</Heading></View>)}<Heading>Previous winners</Heading>{!data.weeks.some(w => w.winnerIds.length) && <Muted>The first crown is waiting to be won.</Muted>}{data.weeks.filter(w => w.winnerIds.length).map(w => <Button key={w.key} variant="outline" onPress={() => setWeekKey(w.key)}>🏆 {w.key} · {w.standings.filter(p => w.winnerIds.includes(p.userId)).map(p => p.name).join(' & ')}</Button>)}</> : <Muted>No group competition yet.</Muted>}</Card>}
      {section === 'feed' && <><Heading>Around the group</Heading><Muted>Exact scores, prediction-points lead changes, and weekly winners. Picks appear only after scoring.</Muted>{!data.feed.length && <Muted>The story starts with your first scored match.</Muted>}{data.feed.map(e => <Card key={e.key} style={{ gap: 12 }}><Text style={{ color: colors.foreground, fontSize: 16 }}>{e.text}</Text><Muted>{new Date(e.at).toLocaleDateString('en-GB', { timeZone: 'Africa/Cairo' })}</Muted>{e.matchId && <Button variant="ghost" onPress={() => router.push(`/matches/${e.matchId}`)}>View match</Button>}<View style={{ flexDirection: 'row', gap: 8 }}>{e.reactions.map(r => <Button key={r.emoji} disabled={busy || refreshing} accessibilityLabel={`React ${r.emoji}, ${r.count} reactions`} accessibilityState={{ selected: r.mine }} variant={r.mine ? 'primary' : 'outline'} onPress={() => act({ action: 'reaction', eventKey: e.key, emoji: r.mine ? null : r.emoji })}>{r.emoji} {r.count || ''}</Button>)}</View></Card>)}</>}
      {section === 'rival' && <Card style={{ gap: 14 }}><Heading>Make it personal</Heading><Muted>Choose a friend from this group. Match wins compare scored games you both predicted this season.</Muted><ScrollView horizontal contentContainerStyle={{ gap: 8 }}><Button disabled={busy || refreshing} variant="outline" onPress={() => act({ action: 'rival', rivalId: null })}>No rival</Button>{data.players.filter(p => p.id !== data.userId).map(p => <Button key={p.id} disabled={busy || refreshing} variant={data.rival?.userId === p.id ? 'primary' : 'outline'} onPress={() => act({ action: 'rival', rivalId: p.id })}>{p.name}</Button>)}</ScrollView>{data.rival && <><Heading>{data.rival.gap === 0 ? 'All square' : `${Math.abs(data.rival.gap)} points ${data.rival.gap > 0 ? 'ahead' : 'behind'}`}</Heading><Text style={{ color: colors.foreground }}>You: {data.rival.myPoints} points · {data.rival.myAccuracy}% correct outcomes</Text><Text style={{ color: colors.foreground }}>{data.rival.name}: {data.rival.theirPoints} points · {data.rival.theirAccuracy}% correct outcomes</Text><Muted>{data.rival.wins} wins · {data.rival.losses} losses · {data.rival.draws} draws</Muted></>}</Card>}
      {section === 'rewards' && <><Heading>Earn your reputation</Heading><Muted>Cosmetic titles, never extra points. Progress uses this season; claimed titles stay yours.</Muted>{data.equippedTitle && <Button variant="outline" disabled={busy || refreshing} onPress={() => act({ action: 'title', key: null })}>Remove title: {data.equippedTitle}</Button>}{data.challenges.map(c => <Card key={c.key} style={{ gap: 12 }}><Heading>{c.unlocked ? '🏅 ' : ''}{c.name}</Heading><Muted>{c.description}</Muted><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: c.target, now: c.progress }} style={{ height: 8, borderRadius: 4, backgroundColor: colors.border }}><View style={{ width: `${Math.min(100, c.progress / c.target * 100)}%`, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /></View><Muted>{c.progress}/{c.target} · Unlock “{c.title}”</Muted><Button disabled={busy || refreshing || !c.unlocked || data.equippedTitle === c.title} onPress={() => act({ action: 'title', key: c.key })}>{data.equippedTitle === c.title ? 'Equipped' : c.unlocked ? 'Equip title' : 'Keep playing'}</Button></Card>)}</>}
      {section === 'recap' && (data.recap ? <Card style={{ gap: 16 }}><Muted>{data.recap.seasonName} · {data.recap.final ? 'Final recap' : 'Season so far'}</Muted><Heading>{data.recap.name}</Heading><Text style={{ color: colors.primary, fontSize: 48, fontWeight: 'bold' }}>{data.recap.totalPoints} pts</Text><Heading>{data.recap.rank ? `#${data.recap.rank} overall` : 'Unranked'}</Heading><Muted>{data.recap.exactScores} exact scores · {data.recap.accuracy}% correct outcomes</Muted><Muted>{data.recap.weeklyWins} group weekly crowns · best streak: {data.recap.longestStreak}</Muted><Muted>Biggest weekly improvement: {data.recap.biggestComeback} places</Muted>{data.recap.bestPrediction && <Button variant="outline" onPress={() => router.push(`/matches/${data.recap!.bestPrediction!.matchId}`)}>Best pick: {data.recap.bestPrediction.label} · {data.recap.bestPrediction.score} · {data.recap.bestPrediction.points} pts</Button>}<Button onPress={() => Share.share({ message: data.recap!.shareText }).catch(() => setNotice('Sharing is unavailable. Please try again.'))}>Share recap</Button></Card> : <Muted>Your recap appears once a season starts.</Muted>)}
    </>}
  </ScrollView></View>;
}
