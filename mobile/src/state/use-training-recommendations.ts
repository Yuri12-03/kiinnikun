import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getSupabase } from '../lib/supabase';
import { parseTrainingHistory, recommendParts, type TrainingHistory } from '../lib/training-history';

type Snapshot = { userId: string; status: 'loading' | 'error' } |
  { userId: string; status: 'ready'; history: TrainingHistory; receivedAt: number };

export function useTrainingRecommendations(userId: string | null) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const [clock, setClock] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    const accountId = userId;
    let stopped = false;
    let controller: AbortController | null = null;
    async function load() {
      controller?.abort();
      const activeRequest = new AbortController();
      controller = activeRequest;
      setSnapshot({ userId: accountId, status: 'loading' });
      const timeout = setTimeout(() => activeRequest.abort(), 15_000);
      try {
        const { data, error } = await getSupabase().rpc('get_training_history').abortSignal(activeRequest.signal);
        if (error) throw error;
        const history = parseTrainingHistory(data);
        if (!stopped && controller === activeRequest) {
          const receivedAt = performance.now();
          setClock(receivedAt);
          setSnapshot({ userId: accountId, status: 'ready', history, receivedAt });
        }
      } catch {
        if (!stopped && controller === activeRequest) setSnapshot({ userId: accountId, status: 'error' });
      } finally { clearTimeout(timeout); }
    }
    refreshRef.current = () => { void load(); };
    void load();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void load(); });
    // No network polling: only update elapsed time so the 48-hour boundary expires.
    const timer = setInterval(() => setClock(performance.now()), 30_000);
    return () => { stopped = true; controller?.abort(); refreshRef.current = () => {}; subscription.remove(); clearInterval(timer); };
  }, [userId]));

  // An account change never displays the previous account's history, even for one render.
  const visible = userId && snapshot?.userId === userId ? snapshot : null;
  const now = visible?.status === 'ready' ? visible.history.serverNow + Math.max(0, clock - visible.receivedAt) : 0;
  return {
    status: !userId ? 'signed_out' as const : visible?.status ?? 'loading' as const,
    recommendations: visible?.status === 'ready' ? recommendParts(visible.history, now) : [],
    now,
    refresh: () => refreshRef.current(),
  };
}
