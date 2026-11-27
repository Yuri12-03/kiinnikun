// EAS invokes this after dependency installation, before creating the native build.
// Public configuration is bundled; server/API secrets must never be put here.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL in the EAS preview environment.');
}
if (!key || key.includes('replace') || key.startsWith('sb_secret_')) {
  throw new Error('Set a Supabase publishable/anon key in EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Never use a server secret.');
}
if (!key.startsWith('sb_publishable_')) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role; } catch { /* Invalid public key. */ }
  if (role !== 'anon') throw new Error('The legacy Supabase key must have the anon role.');
}
console.log('Android build public configuration is present.');
