import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const isConfigured = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('your-project') &&
  !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.includes('replace_me'));
let client: SupabaseClient | undefined;

const storage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') { sessionStorage.setItem(key, value); return; }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') { sessionStorage.removeItem(key); return; }
    await SecureStore.deleteItemAsync(key);
  },
};

export function getSupabase(): SupabaseClient {
  if (!isConfigured) throw new Error('AIの接続準備がまだ完了していません。設定後にアプリを再起動してください。');
  client ??= createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  return client;
}
