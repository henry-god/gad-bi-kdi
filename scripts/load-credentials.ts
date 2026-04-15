/**
 * One-shot credential loader for V5-M1.
 *
 * Reads the Firebase service account JSON from disk and the Gemini key
 * + web config from this file (populated from operator-provided values)
 * and pushes them into the `settings` table. Also seeds the admin user.
 *
 * Run: DATABASE_URL=... npx tsx scripts/load-credentials.ts
 *
 * SECURITY: the chat transport that delivered these secrets is not a
 * secure channel. After this script runs successfully, rotate the
 * Gemini key at https://aistudio.google.com → API keys.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICE_ACCOUNT_PATH = 'C:\\GAD_BI\\gad-bi-kdi-3bcf3004fc97.json';

const GEMINI_API_KEY = 'AIzaSyA_pwMw3Nf_UzFnjwoMeb-yQ9FeLIt61ZM';

const FIREBASE_WEB_CONFIG = {
  apiKey: 'AIzaSyCOMthpaddoUQHz8LHesaotGcxtROExOcE',
  authDomain: 'gad-bi-kdi.firebaseapp.com',
  projectId: 'gad-bi-kdi',
  storageBucket: 'gad-bi-kdi.firebasestorage.app',
  messagingSenderId: '9320921033',
  appId: '1:9320921033:web:790b77c8701b96fc689a18',
  measurementId: 'G-605P0JRM9L',
};

const ADMIN_EMAIL = 'admin@kdi.com';

async function upsertSetting(key: string, value: string, secret: boolean, description: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value, secret, description },
  });
  const display = secret
    ? value.slice(0, 4) + '•'.repeat(Math.max(0, value.length - 8)) + value.slice(-4)
    : value;
  console.log(`  ${key.padEnd(34)} ${display}`);
}

async function main() {
  console.log('\n=== V5-M1 credentials intake ===\n');

  // Firebase service account
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account not found: ${SERVICE_ACCOUNT_PATH}`);
  }
  const saJson = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8').trim();
  const sa = JSON.parse(saJson);
  console.log(`Service account project: ${sa.project_id}`);
  console.log(`Service account email:   ${sa.client_email}\n`);

  console.log('Upserting settings:');
  await upsertSetting('GEMINI_API_KEY', GEMINI_API_KEY, true, 'Google Gemini API key');
  await upsertSetting('GEMINI_MODEL', 'gemini-2.5-flash', false, 'Gemini model ID');
  await upsertSetting('GEMINI_TEMPERATURE', '0.3', false, 'Sampling temperature');
  await upsertSetting('GEMINI_SAFETY_PRESET', 'BLOCK_NONE', false, 'Safety filter preset');

  await upsertSetting('FIREBASE_SERVICE_ACCOUNT_JSON', saJson, true, 'Firebase Admin service account JSON');
  await upsertSetting('FIREBASE_WEB_CONFIG_JSON', JSON.stringify(FIREBASE_WEB_CONFIG), false, 'Firebase web app config');
  await upsertSetting('FIREBASE_ALLOWED_DOMAINS', 'kdi.com,gad-bi-kdi.firebaseapp.com', false, 'Allowed sign-in domains');

  await upsertSetting('MINISTRY_NAME_KM', 'អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ', false, 'Ministry name (Khmer)');
  await upsertSetting('MINISTRY_NAME_EN', 'General Secretariat of the Non-Bank Financial Services Authority', false, 'Ministry name (English)');
  await upsertSetting('DEPARTMENT_NAME_KM', 'អ.ស.ហ.', false, 'Department alias');

  // Remove stale Anthropic keys if they exist
  const deleted = await prisma.setting.deleteMany({
    where: { key: { in: ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'OPENAI_API_KEY', 'STT_LANGUAGE_HINT'] } },
  });
  if (deleted.count > 0) {
    console.log(`\nRemoved ${deleted.count} stale Anthropic/OpenAI setting rows.`);
  }

  // Seed admin user
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'admin', name: 'KDI Admin' },
    create: {
      firebaseUid: `seeded-admin-${Date.now()}`,
      email: ADMIN_EMAIL,
      name: 'KDI Admin',
      nameKm: 'អ្នកគ្រប់គ្រង KDI',
      role: 'admin',
    },
  });
  console.log(`\nAdmin user seeded: ${admin.email} · ${admin.id}`);

  console.log('\n✓ V5-M1 credentials intake complete.\n');
  console.log('Next:');
  console.log('  1. Revoke old Anthropic key at https://console.anthropic.com (no longer used)');
  console.log('  2. Rotate the Gemini key at https://aistudio.google.com/apikey (chat was not secure transport)');
  console.log('  3. In Firebase Console, enable Authentication → Sign-in method → Anonymous');
  console.log('  4. Run `npm test` then start servers\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
