import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BODY_PARTS, MenuError, parseConditions, type BodyPart } from '../../../supabase/functions/_shared/menu';
import { Brand, Button, Card, colors, styles } from '../components/ui';
import { getSupabase, isConfigured } from '../lib/supabase';
import { generateMenu } from '../lib/menu-api';
import { useWorkout } from '../state/workout';
import { DurationPicker } from '../components/duration-picker';
import { RecommendedParts } from '../components/recommended-parts';
import { useTrainingRecommendations } from '../state/use-training-recommendations';

export default function HomeScreen() {
  const workout = useWorkout();
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const trainingHistory = useTrainingRecommendations(userId);
  const [authLoading, setAuthLoading] = useState(isConfigured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);
  const request = useRef<AbortController | null>(null);
  const authPending = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!isConfigured) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive.current) return;
      setSignedIn(Boolean(data.session));
      setUserId(data.session?.user.id ?? null);
      setAuthLoading(false);
      if (sessionError) setError({ message: 'ログイン状態を確認できませんでした。入り直してください。', retry: false });
    }).catch(() => { if (alive.current) setAuthLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive.current) { setSignedIn(Boolean(session)); setUserId(session?.user.id ?? null); }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => { alive.current = false; request.current?.abort(); data.subscription.unsubscribe(); appState.remove(); };
  }, []);

  function togglePart(part: BodyPart) {
    setError(null);
    workout.setBodyParts(workout.bodyParts.includes(part) ? workout.bodyParts.filter((item) => item !== part) : [...workout.bodyParts, part]);
  }

  async function signIn() {
    if (authPending.current || !email.trim() || !password) return;
    authPending.current = true; setAuthBusy(true); setError(null);
    try {
      const { error: signInError } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      setPassword('');
    } catch { setError({ message: 'ログインできませんでした。メールアドレス・パスワードと通信環境をご確認ください。', retry: false }); }
    finally { authPending.current = false; if (alive.current) setAuthBusy(false); }
  }

  async function propose() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null);
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const conditions = parseConditions({ bodyParts: workout.bodyParts, gymAvailable: workout.gymAvailable, durationMinutes: workout.durationMinutes });
      const menu = await generateMenu(conditions, controller.signal);
      if (!alive.current) return;
      workout.setProposal({ conditions, menu });
      router.push('/menu');
    } catch (cause) {
      if (alive.current) setError({ message: cause instanceof Error ? cause.message : '提案を取得できませんでした。',
        retry: !(cause instanceof MenuError && ['UNAUTHORIZED', 'FORBIDDEN', 'SERVER_CONFIG', 'DAILY_LIMIT', 'INVALID_INPUT'].includes(cause.code)) });
    } finally {
      clearTimeout(timeout); request.current = null;
      if (alive.current) setBusy(false);
    }
  }

  const ready = workout.bodyParts.length > 0 && workout.gymAvailable !== null && signedIn && !busy;
  return <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Brand />
      <View style={{ gap: 12, paddingTop: 12 }}><Text style={styles.eyebrow}>MAKE TODAY A STRONGER DAY</Text>
        <Text style={styles.title}>今日は、どこを{ '\n' }鍛えよう。</Text>
        <Text style={styles.subtitle}>あなたに合うメニューを、AIと一緒に。{ '\n' }部位と場所、使える時間を選んで始めよう。</Text>
      </View>

      <View style={{ gap: 14 }}><View style={styles.row}><Text style={styles.heading}>01　鍛えたい部位</Text><Text style={styles.label}>複数選択OK</Text></View>
        <RecommendedParts history={trainingHistory} selected={workout.bodyParts} onSelect={togglePart} disabled={busy} />
        <View style={local.grid}>{BODY_PARTS.map((part, index) => {
          const selected = workout.bodyParts.includes(part.id);
          return <Pressable key={part.id} accessibilityRole="checkbox" accessibilityLabel={part.label} accessibilityState={{ checked: selected, disabled: busy }}
            disabled={busy} onPress={() => togglePart(part.id)} style={({ pressed }) => [local.part, selected && local.selectedPart, pressed && { opacity: 0.8 }]}>
            <View style={styles.row}><Text style={[local.partNumber, selected && local.lightText]}>0{index + 1}</Text>
              <Text style={[local.check, selected && local.lightText]}>{selected ? '✓' : '＋'}</Text></View>
            <Text style={[local.partName, selected && local.lightText]}>{part.label}</Text>
            <Text style={[local.partHint, selected && { color: '#BFCEBB' }]}>{part.hint}</Text>
          </Pressable>;
        })}</View>
      </View>

      <View style={{ gap: 14 }}><Text style={styles.heading}>02　ジムは使える？</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>{[{ value: true, title: '使える', caption: 'マシン・ダンベル' }, { value: false, title: '使わない', caption: '器具なし・自重' }].map((option) => {
          const selected = workout.gymAvailable === option.value;
          return <Pressable key={String(option.value)} accessibilityRole="radio" accessibilityState={{ selected, disabled: busy }} disabled={busy}
            onPress={() => { workout.setGymAvailable(option.value); setError(null); }} style={[local.gym, selected && local.selectedGym]}>
            <Text style={[local.gymTitle, selected && { color: colors.green }]}>{selected ? '●' : '○'}　{option.title}</Text>
            <Text style={local.gymCaption}>{option.caption}</Text>
          </Pressable>;
        })}</View>
      </View>

      <DurationPicker value={workout.durationMinutes} onChange={(minutes) => { workout.setDurationMinutes(minutes); setError(null); }} disabled={busy} />

      {!isConfigured && <Card><Text style={styles.heading}>AIへの接続を準備中です</Text>
        <Text style={styles.subtitle}>メニュー提案は接続設定が完了すると利用できます。部位と場所は先に選べます。</Text></Card>}
      {isConfigured && !signedIn && <Card><Text style={styles.heading}>あなたのアカウントで接続</Text>
        <Text style={styles.subtitle}>個人用のAIを利用するためにログインしてください。</Text>
        <TextInput accessibilityLabel="メールアドレス" placeholder="メールアドレス" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" style={styles.input} editable={!authBusy} />
        <TextInput accessibilityLabel="パスワード" placeholder="パスワード" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" style={styles.input} editable={!authBusy} onSubmitEditing={() => void signIn()} />
        <Button label={authBusy ? '接続しています…' : 'ログインする'} disabled={!email.trim() || !password || authBusy || authLoading} onPress={() => void signIn()} />
      </Card>}

      {error && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
        <Text style={styles.errorText}>{error.message}</Text>
        {error.retry && <Pressable accessibilityRole="button" disabled={!ready} onPress={() => void propose()}><Text style={styles.textLink}>もう一度試す →</Text></Pressable>}
      </View>}
      <View style={{ gap: 12 }}>
        {busy && <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}><ActivityIndicator color={colors.green} /><Text style={styles.subtitle}>あなたのメニューを考えています…</Text></View>}
        <Button label={busy ? 'メニューを作成しています…' : 'AIにメニューを考えてもらう　→'} disabled={!ready} onPress={() => void propose()} />
        <Text style={[styles.subtitle, { textAlign: 'center', fontSize: 11 }]}>{workout.bodyParts.length === 0 || workout.gymAvailable === null
          ? '鍛えたい部位と、ジムの利用可否を選んでください。'
          : '提案にはインターネット接続が必要です。'}</Text>
      </View>
      {signedIn && <Pressable accessibilityRole="button" disabled={busy || authBusy} onPress={async () => {
        if (authPending.current) return;
        authPending.current = true; setAuthBusy(true);
        try { const { error: signOutError } = await getSupabase().auth.signOut({ scope: 'local' }); if (signOutError) throw signOutError; workout.setProposal(null); }
        catch { setError({ message: 'ログアウトできませんでした。もう一度お試しください。', retry: false }); }
        finally { authPending.current = false; if (alive.current) setAuthBusy(false); }
      }}><Text style={[styles.textLink, { textAlign: 'center' }]}>ログアウト</Text></Pressable>}
    </ScrollView>
  </SafeAreaView>;
}

const local = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  part: { width: '31%', flexGrow: 1, padding: 16, gap: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, minHeight: 120 },
  selectedPart: { backgroundColor: colors.green, borderColor: colors.green },
  partNumber: { color: '#9BA494', fontSize: 10, fontWeight: '700' },
  partName: { fontSize: 23, fontWeight: '700', color: colors.ink, marginTop: 5 },
  partHint: { fontSize: 8, color: colors.muted, letterSpacing: 0.7, fontWeight: '600' },
  check: { fontSize: 14, color: colors.muted },
  lightText: { color: colors.white },
  gym: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 16, borderRadius: 16, gap: 8 },
  selectedGym: { borderColor: colors.green, backgroundColor: colors.pale },
  gymTitle: { fontSize: 12, color: colors.ink, fontWeight: '700' },
  gymCaption: { fontSize: 10, lineHeight: 17, color: colors.muted },
});
