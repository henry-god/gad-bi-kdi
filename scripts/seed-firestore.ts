/**
 * Seed Firestore with the baseline data the UI needs:
 *   - 1 organization (fsa-kh)
 *   - 4 departments
 *   - 19 template docs (13 generic + 6 FSA) from templates/config/*.json
 *   - 1 admin user (admin@kdi.com) with a placeholder UID
 *
 * Idempotent: uses merge sets. Safe to rerun.
 *
 * Run with:
 *   KGD_STORE=firestore FIRESTORE_DATABASE_ID=(default) \
 *     npx tsx scripts/seed-firestore.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import admin from 'firebase-admin';

async function main() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.join(process.cwd(), 'gad-bi-kdi-3bcf3004fc97.json');
  if (!admin.apps.length) {
    if (fs.existsSync(saPath)) {
      const parsed = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
      admin.initializeApp({ credential: admin.credential.cert(parsed), projectId: parsed.project_id });
      console.log(`↳ using service account: ${saPath}`);
    } else {
      admin.initializeApp();
      console.log('↳ using application default credentials');
    }
  }
  const dbId = process.env.FIRESTORE_DATABASE_ID || '(default)';
  const db = dbId !== '(default)' ? (admin.firestore as any)(admin.app(), dbId) : admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  console.log(`↳ Firestore database: ${dbId}`);

  const now = admin.firestore.FieldValue.serverTimestamp();

  // 1. Organization
  const org = {
    id: 'fsa-kh',
    nameKm: 'អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ',
    nameEn: 'General Secretariat of the Non-Bank Financial Services Authority',
    aliasKm: 'អ.ស.ហ.',
    createdAt: now, updatedAt: now,
  };
  await db.collection('organizations').doc(org.id).set(org, { merge: true });
  console.log('✓ organizations/fsa-kh');

  // 2. Departments
  const depts = [
    { id: 'dept-general-affairs',       nameKm: 'នាយកដ្ឋានកិច្ចការទូទៅ',               nameEn: 'General Affairs' },
    { id: 'dept-technical-legal',       nameKm: 'នាយកដ្ឋានបច្ចេកទេសនិងកិច្ចការគតិយុត្ត', nameEn: 'Technical & Legal' },
    { id: 'dept-policy',                 nameKm: 'នាយកដ្ឋានគោលនយោបាយ',                  nameEn: 'Policy' },
    { id: 'dept-fintech-center',         nameKm: 'មជ្ឈមណ្ឌលបច្ចេកវិទ្យាហិរញ្ញវត្ថុ',     nameEn: 'Financial Technology Center' },
  ];
  for (const d of depts) {
    await db.collection('departments').doc(d.id).set({
      ...d, organizationId: org.id, parentId: null, createdAt: now, updatedAt: now,
    }, { merge: true });
  }
  console.log(`✓ departments × ${depts.length}`);

  // 3. Templates
  const configDir = path.join(process.cwd(), 'templates', 'config');
  const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  let tplCount = 0;
  for (const f of files) {
    const cfg = JSON.parse(fs.readFileSync(path.join(configDir, f), 'utf-8'));
    if (!cfg.id) continue;
    await db.collection('templates').doc(cfg.id).set({
      id: cfg.id, name: cfg.name, nameKm: cfg.nameKm, category: cfg.category,
      config: cfg, isBuiltin: true, isActive: true, sortOrder: 0,
      createdAt: now, updatedAt: now,
    }, { merge: true });
    tplCount++;
  }
  console.log(`✓ templates × ${tplCount}`);

  // 4. Admin user (placeholder UID — overwritten on first real sign-in
  //    via email lookup in the auth middleware).
  const adminUserId = 'admin-kdi-seed';
  await db.collection('users').doc(adminUserId).set({
    id: adminUserId,
    firebaseUid: adminUserId,
    email: 'admin@kdi.com',
    name: 'KDI Admin',
    nameKm: 'ភ្នាក់ងារ',
    role: 'admin',
    department: null,
    departmentId: 'dept-general-affairs',
    titlePosition: 'Administrator',
    createdAt: now, updatedAt: now,
  }, { merge: true });
  console.log('✓ users/admin-kdi-seed');

  // 5. Known defaults (non-secret)
  const defaults: Record<string, string> = {
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_TEMPERATURE: '0.3',
    GEMINI_SAFETY_PRESET: 'BLOCK_NONE',
    MINISTRY_NAME_KM: org.nameKm,
    MINISTRY_NAME_EN: org.nameEn,
    DEPARTMENT_NAME_KM: org.aliasKm,
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.collection('settings').doc(key).set({
      key, value, secret: false, description: null, updatedAt: now,
    }, { merge: true });
  }
  console.log(`✓ settings × ${Object.keys(defaults).length} (defaults)`);

  console.log('\nDone. Firestore seeded.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
