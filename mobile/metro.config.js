const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Edge Functions' shared validation code is outside the mobile workspace. Watch it
// explicitly so newly added shared modules are visible without stale file-map errors.
config.watchFolders = [...new Set([...config.watchFolders, path.resolve(__dirname, '../supabase/functions/_shared')])];

module.exports = config;
