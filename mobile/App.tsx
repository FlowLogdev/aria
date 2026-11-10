import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const API_BASE = 'https://aria-weld-two.vercel.app/api/mobile';
const TOKEN = process.env.EXPO_PUBLIC_ARIA_TOKEN ?? '';

type Call = {
  id: string;
  from_number: string;
  display_name: string | null;
  caller_name: string | null;
  caller_company: string | null;
  caller_reason: string | null;
  status: string;
  owner_decision: 'pickup' | 'voicemail' | null;
  started_at: string;
  ended_at: string | null;
  transcript: string | null;
  summary: string | null;
};

type Tab = 'voicemail' | 'all';
type Theme = ReturnType<typeof themeFor>;

function themeFor(dark: boolean) {
  return dark
    ? { bg: '#000000', card: '#1C1C1E', text: '#FFFFFF', muted: '#98989F', line: '#38383A', accent: '#0A84FF', onAccent: '#FFFFFF' }
    : { bg: '#F2F2F7', card: '#FFFFFF', text: '#000000', muted: '#6C6C70', line: '#D1D1D6', accent: '#007AFF', onAccent: '#FFFFFF' };
}

function api(path: string) {
  return fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

const callerLabel = (c: Call) => c.caller_name || c.display_name || c.from_number;

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function callLength(c: Call) {
  if (!c.ended_at) return null;
  return formatClock((new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000);
}

function outcome(c: Call) {
  if (c.owner_decision === 'voicemail') return 'Voicemail';
  if (c.owner_decision === 'pickup') return 'You answered';
  return 'No decision';
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Inbox />
    </SafeAreaProvider>
  );
}

function Inbox() {
  const t = themeFor(useColorScheme() === 'dark');
  const [tab, setTab] = useState<Tab>('voicemail');
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Call | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api(tab === 'voicemail' ? '/calls?filter=voicemail' : '/calls');
      if (!res.ok) throw new Error(res.status === 401 ? 'This app is not authorized.' : 'Could not load your calls.');
      const body = (await res.json()) as { calls: Call[] };
      setCalls(body.calls);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your calls.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    setCalls([]);
    load();
  }, [load]);

  // Pick up new voicemails whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style="auto" />
      <Text style={[styles.title, { color: t.text }]}>Aria</Text>
      <View style={[styles.segments, { backgroundColor: t.line }]}>
        {(['voicemail', 'all'] as const).map(value => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.segment, tab === value && { backgroundColor: t.card }]}
          >
            <Text style={[styles.segmentText, { color: t.text }]}>{value === 'voicemail' ? 'Voicemail' : 'All calls'}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.fill} />
      ) : (
        <FlatList
          data={calls}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: t.muted }]}>
              {error ?? (tab === 'voicemail' ? 'No voicemails yet.' : 'No calls yet.')}
            </Text>
          }
          ListHeaderComponent={error && calls.length > 0 ? <Text style={[styles.banner, { color: t.muted }]}>{error}</Text> : undefined}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelected(item)} style={[styles.row, { backgroundColor: t.card }]}>
              <View style={styles.rowTop}>
                <Text numberOfLines={1} style={[styles.name, { color: t.text }]}>{callerLabel(item)}</Text>
                <Text style={[styles.meta, { color: t.muted }]}>{formatWhen(item.started_at)}</Text>
              </View>
              <Text numberOfLines={2} style={[styles.reason, { color: t.muted }]}>
                {item.caller_reason || outcome(item)}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Modal visible={selected !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && <CallDetail call={selected} theme={t} onClose={() => setSelected(null)} />}
      </Modal>
    </SafeAreaView>
  );
}

function CallDetail({ call, theme: t, onClose }: { call: Call; theme: Theme; onClose: () => void }) {
  const length = callLength(call);
  const lines = (call.transcript ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.detail}>
      <Pressable onPress={onClose} hitSlop={12} style={styles.done} accessibilityRole="button">
        <Text style={[styles.doneText, { color: t.accent }]}>Done</Text>
      </Pressable>

      <Text style={[styles.detailName, { color: t.text }]}>{callerLabel(call)}</Text>
      {call.caller_company ? <Text style={[styles.meta, { color: t.muted }]}>{call.caller_company}</Text> : null}
      <Text style={[styles.meta, { color: t.muted }]}>
        {[formatWhen(call.started_at), length, outcome(call)].filter(Boolean).join('  ·  ')}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL(`tel:${call.from_number}`)}
        style={[styles.callBack, { backgroundColor: t.accent }]}
      >
        <Text style={[styles.callBackText, { color: t.onAccent }]}>Call back {call.from_number}</Text>
      </Pressable>

      <Recording callId={call.id} theme={t} />

      {call.caller_reason ? (
        <>
          <Text style={[styles.section, { color: t.muted }]}>REASON</Text>
          <Text style={[styles.body, { color: t.text }]}>{call.caller_reason}</Text>
        </>
      ) : null}

      {call.summary ? (
        <>
          <Text style={[styles.section, { color: t.muted }]}>SUMMARY</Text>
          <Text style={[styles.body, { color: t.text }]}>{call.summary}</Text>
        </>
      ) : null}

      <Text style={[styles.section, { color: t.muted }]}>TRANSCRIPT</Text>
      {lines.length === 0 ? <Text style={[styles.body, { color: t.muted }]}>No transcript for this call.</Text> : null}
      {lines.map((line, index) => {
        const isAria = line.startsWith('AI:');
        const text = line.replace(/^(AI|User):\s*/, '');
        return (
          <View key={index} style={styles.turn}>
            <Text style={[styles.speaker, { color: isAria ? t.accent : t.muted }]}>{isAria ? 'Aria' : 'Caller'}</Text>
            <Text style={[styles.body, { color: t.text }]}>{text}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Recording({ callId, theme: t }: { callId: string; theme: Theme }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    api(`/calls/${callId}/recording`)
      .then(async res => {
        if (!active) return;
        if (res.status === 404) return setState('none');
        if (!res.ok) return setState('error');
        const body = (await res.json()) as { url: string };
        if (active) {
          setUrl(body.url);
          setState('ready');
        }
      })
      .catch(() => active && setState('error'));
    return () => {
      active = false;
    };
  }, [callId]);

  if (state === 'ready' && url) return <Player url={url} theme={t} />;
  return (
    <View style={[styles.player, { backgroundColor: t.card }]}>
      {state === 'loading' ? (
        <ActivityIndicator />
      ) : (
        <Text style={[styles.body, { color: t.muted }]}>
          {state === 'none' ? 'No audio was saved for this call.' : 'Could not load the audio. Try again in a moment.'}
        </Text>
      )}
    </View>
  );
}

function Player({ url, theme: t }: { url: string; theme: Theme }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || 0;
  const progress = duration > 0 ? Math.min(status.currentTime / duration, 1) : 0;

  const toggle = () => {
    if (status.playing) return player.pause();
    if (duration > 0 && status.currentTime >= duration - 0.25) player.seekTo(0);
    player.play();
  };
  const skip = (delta: number) => player.seekTo(Math.min(Math.max(status.currentTime + delta, 0), duration));

  return (
    <View style={[styles.player, { backgroundColor: t.card }]}>
      <View style={[styles.track, { backgroundColor: t.line }]}>
        <View style={[styles.trackFill, { backgroundColor: t.accent, width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.times}>
        <Text style={[styles.meta, { color: t.muted }]}>{formatClock(status.currentTime)}</Text>
        <Text style={[styles.meta, { color: t.muted }]}>{status.isLoaded ? formatClock(duration) : '–:––'}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable onPress={() => skip(-15)} hitSlop={10} accessibilityLabel="Back 15 seconds">
          <Text style={[styles.skip, { color: t.accent }]}>−15s</Text>
        </Pressable>
        <Pressable
          onPress={toggle}
          disabled={!status.isLoaded}
          accessibilityRole="button"
          style={[styles.play, { backgroundColor: t.accent, opacity: status.isLoaded ? 1 : 0.5 }]}
        >
          <Text style={[styles.playText, { color: t.onAccent }]}>{status.playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
        <Pressable onPress={() => skip(15)} hitSlop={10} accessibilityLabel="Forward 15 seconds">
          <Text style={[styles.skip, { color: t.accent }]}>+15s</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  title: { fontSize: 34, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8 },
  segments: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 9, padding: 2 },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 8 },
  empty: { textAlign: 'center', marginTop: 64, fontSize: 16 },
  banner: { textAlign: 'center', marginBottom: 8, fontSize: 13 },
  row: { padding: 14, borderRadius: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  meta: { fontSize: 13, fontVariant: ['tabular-nums'] },
  reason: { fontSize: 15, marginTop: 3, lineHeight: 20 },
  detail: { padding: 20, paddingBottom: 48 },
  done: { alignSelf: 'flex-end', marginBottom: 12 },
  doneText: { fontSize: 17, fontWeight: '600' },
  detailName: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  callBack: { marginTop: 16, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  callBackText: { fontSize: 16, fontWeight: '600' },
  player: { marginTop: 12, padding: 16, borderRadius: 12 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, marginTop: 8 },
  skip: { fontSize: 15, fontWeight: '600' },
  play: { paddingVertical: 11, paddingHorizontal: 32, borderRadius: 24, minWidth: 104, alignItems: 'center' },
  playText: { fontSize: 16, fontWeight: '600' },
  section: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 24, marginBottom: 6 },
  body: { fontSize: 16, lineHeight: 22 },
  turn: { marginBottom: 10 },
  speaker: { fontSize: 12, fontWeight: '600', marginBottom: 1 },
});
