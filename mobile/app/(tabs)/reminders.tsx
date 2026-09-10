import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Heading, Muted } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/theme';
import { useRemoteData } from '@/hooks/useRemoteData';
import { apiRequest } from '@/api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Team = { teamLeagueId: number; name: string };
type League = { id: number; name: string; teams: Team[] };
type Data = { leagues: League[]; selections: League[] };

export default function RemindersScreen() {
  const { token } = useAuth(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<number>>(new Set()); const [notice, setNotice] = useState(''); const [saving, setSaving] = useState(false);
  const { data, loading, refreshing, error, refresh } = useRemoteData(signal => apiRequest<Data>('/api/mobile/reminders', { token, signal }), [token], { enabled: !!token });
  useEffect(() => { if (data) setSelected(new Set(data.selections.flatMap(l => l.teams.map(t => t.teamLeagueId)))); }, [data]);
  async function save() {
    const invalid = data?.leagues.find(l => l.teams.filter(t => selected.has(t.teamLeagueId)).length === 1);
    if (invalid) { setNotice(`Select at least two teams in ${invalid.name}`); return; }
    setSaving(true); setNotice(''); try { await apiRequest('/api/mobile/reminders', { token, method: 'PUT', body: { selections: [...selected] } }); setNotice('Reminder preferences saved'); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save'); } finally { setSaving(false); }
  }
  return <View style={{ flex: 1, backgroundColor: colors.background }}><AppHeader title="Match reminders" subtitle="Followed teams and prediction games" /><ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
    <Muted>Prediction games automatically send a 60-minute reminder. Choose at least two teams in a league for additional reminders 60 minutes before and at kickoff when both teams are selected.</Muted>
    {!!error && <Card><Muted>{error}</Muted><Button onPress={refresh}>Try again</Button></Card>}
    {loading && !data ? <ActivityIndicator color={colors.primary} /> : data?.leagues.map(league => <Card key={league.id} style={{ gap: 10 }}><Heading>{league.name}</Heading>{league.teams.map(team => <View key={team.teamLeagueId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}><Text style={{ color: colors.foreground }}>{team.name}</Text><Switch value={selected.has(team.teamLeagueId)} onValueChange={value => setSelected(previous => { const next = new Set(previous); value ? next.add(team.teamLeagueId) : next.delete(team.teamLeagueId); return next; })} trackColor={{ true: colors.primary }} /></View>)}</Card>)}
    {!!notice && <Text style={{ color: notice.includes('saved') ? colors.primary : colors.destructive }}>{notice}</Text>}<Button disabled={saving || !data} onPress={save}>{saving ? 'Saving...' : 'Save preferences'}</Button>
  </ScrollView></View>;
}
