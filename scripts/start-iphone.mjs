import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const publicKeys = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_ENABLE_PAID_PLANS',
  'EXPO_PUBLIC_ENABLE_REAL_DOG_AI',
  'EXPO_PUBLIC_ENABLE_SENSOR_ROUTINES',
  'EXPO_PUBLIC_ENABLE_RANKED_GAMES',
  'EXPO_PUBLIC_DOG_AI_BASE_URL',
  'EXPO_PUBLIC_ON_DEVICE_POSE_ENABLED',
  'EXPO_PUBLIC_ON_DEVICE_POSE_ROLLOUT_PERCENTAGE',
  'EXPO_PUBLIC_ON_DEVICE_POSE_FALLBACK_TO_VIDEO_UPLOAD',
  'EXPO_PUBLIC_ON_DEVICE_POSE_TARGET_FPS',
];
const local = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'));
const env = { ...process.env, EXPO_NO_DOTENV: '1' };
// Metro only receives the app's explicit public configuration, never backend keys.
for (const key of Object.keys(env)) {
  if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('EXPO_PUBLIC_')) {
    delete env[key];
  }
}
for (const key of publicKeys) {
  const value = process.env[key] ?? local[key];
  if (value !== undefined) env[key] = value;
}
if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Public Supabase URL and anon key are required for the iPhone server.');
}
if (process.argv.includes('--check')) {
  console.log('iPhone environment verified: public app configuration only; local AI keys excluded.');
} else {
  const tunnel = process.argv.includes('--tunnel');
  const child = spawn(process.execPath, [
    require.resolve('expo/bin/cli'), 'start', '--dev-client',
    tunnel ? '--tunnel' : '--lan', '--port', '18942',
  ], { env, stdio: 'inherit', cwd: new URL('..', import.meta.url) });
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
}
