import { loadAppConfig } from './lib/env.ts';
import fs from 'fs';
import os from 'os';
import path from 'path';

let passed = 0;
let failed = 0;
const originalEnv = { ...process.env };
const isolatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'esoko-config-test-'));

function resetEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...originalEnv };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error: any) {
    failed += 1;
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

await test('production config requires core deployment secrets', () => {
  resetEnv({
    NODE_ENV: 'production',
    APP_URL: undefined,
    FRONTEND_URLS: undefined,
    JWT_SECRET: undefined,
    DEV_JWT_SECRET: undefined,
  });

  try {
    loadAppConfig(isolatedRoot);
  } catch (error: any) {
    if (error.message.includes('JWT_SECRET')) {
      return;
    }
    throw error;
  }

  throw new Error('Production config should fail when JWT_SECRET is missing');
});

await test('production config accepts explicit secure settings', () => {
  resetEnv({
    NODE_ENV: 'production',
    APP_URL: 'https://api.example.com',
    FRONTEND_URLS: 'https://app.example.com',
    JWT_SECRET: 'a'.repeat(48),
    COOKIE_SAMESITE: 'none',
    TRUST_PROXY: '1',
    PORT: '8080',
    UPLOAD_MAX_MB: '8',
  });

  const config = loadAppConfig(isolatedRoot);
  if (!config.isProduction) throw new Error('Expected production config');
  if (config.frontendUrls[0] !== 'https://app.example.com') {
    throw new Error('Frontend URL was not parsed');
  }
  if (config.cookieSameSite !== 'none') throw new Error('Cookie policy was not applied');
  if (config.port !== 8080) throw new Error('Port was not parsed');
});

await test('production config rejects insecure public URLs', () => {
  resetEnv({
    NODE_ENV: 'production',
    APP_URL: 'http://api.example.com',
    FRONTEND_URLS: 'https://app.example.com',
    JWT_SECRET: 'a'.repeat(48),
  });

  try {
    loadAppConfig(isolatedRoot);
  } catch (error: any) {
    if (error.message.includes('must use HTTPS')) return;
    throw error;
  }

  throw new Error('Production config should reject an insecure APP_URL');
});

process.env = originalEnv;
fs.rmSync(isolatedRoot, { recursive: true, force: true });
console.log(`\n${passed} config tests passed, ${failed} failed`);
if (failed > 0) process.exit(1);
