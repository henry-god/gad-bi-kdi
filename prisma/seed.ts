/**
 * Prisma seed
 * Seeds default dev users, FSA organization row, and department tree.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID = 'fsa-kh';
const DEPARTMENTS: Array<{ nameKm: string; nameEn: string }> = [
  { nameKm: 'នាយកដ្ឋានកិច្ចការទូទៅ', nameEn: 'General Affairs' },
  { nameKm: 'នាយកដ្ឋានបច្ចេកទេសនិងកិច្ចការគតិយុត្ត', nameEn: 'Technical and Legal Affairs' },
  { nameKm: 'នាយកដ្ឋានគោលនយោបាយ', nameEn: 'Policy' },
  { nameKm: 'មជ្ឈមណ្ឌលបច្ចេកវិទ្យាហិរញ្ញវត្ថុ', nameEn: 'Financial Technology Center' },
];

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {
      nameKm: 'អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ',
      nameEn: 'General Secretariat of the Non-Bank Financial Services Authority',
      aliasKm: 'អ.ស.ហ.',
    },
    create: {
      id: ORG_ID,
      nameKm: 'អគ្គលេខាធិការដ្ឋានអាជ្ញាធរសេវាហិរញ្ញវត្ថុមិនមែនធនាគារ',
      nameEn: 'General Secretariat of the Non-Bank Financial Services Authority',
      aliasKm: 'អ.ស.ហ.',
    },
  });

  const departments = [];
  for (const d of DEPARTMENTS) {
    const dep = await prisma.department.upsert({
      where: { organizationId_nameKm: { organizationId: ORG_ID, nameKm: d.nameKm } },
      update: { nameEn: d.nameEn },
      create: { organizationId: ORG_ID, nameKm: d.nameKm, nameEn: d.nameEn },
    });
    departments.push(dep);
  }

  const officer = await prisma.user.upsert({
    where: { email: 'officer@kgd.local' },
    update: { departmentId: departments[0].id },
    create: {
      firebaseUid: 'dev-officer-uid',
      email: 'officer@kgd.local',
      name: 'Dev Officer',
      nameKm: 'មន្ត្រីសាកល្បង',
      role: 'officer',
      department: 'IT',
      titlePosition: 'ទីប្រឹក្សា',
      departmentId: departments[0].id,
    },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kgd.local' },
    update: {},
    create: {
      firebaseUid: 'dev-admin-uid',
      email: 'admin@kgd.local',
      name: 'Dev Admin',
      role: 'admin',
    },
  });
  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@kgd.local' },
    update: { departmentId: departments[1].id },
    create: {
      firebaseUid: 'dev-reviewer-uid',
      email: 'reviewer@kgd.local',
      name: 'Dev Reviewer',
      nameKm: 'អ្នកពិនិត្យ',
      role: 'reviewer',
      departmentId: departments[1].id,
    },
  });
  const signer = await prisma.user.upsert({
    where: { email: 'signer@kgd.local' },
    update: { departmentId: departments[2].id },
    create: {
      firebaseUid: 'dev-signer-uid',
      email: 'signer@kgd.local',
      name: 'Dev Signer',
      nameKm: 'អ្នកចុះហត្ថលេខា',
      role: 'signer',
      departmentId: departments[2].id,
    },
  });

  console.log(`Seeded organization: ${org.id} (${org.aliasKm})`);
  console.log(`Seeded ${departments.length} departments:`);
  for (const d of departments) console.log(` - ${d.nameKm.padEnd(50)} ${d.id}`);
  console.log('Seeded users:');
  for (const u of [officer, reviewer, signer, admin]) {
    console.log(` - ${u.role.padEnd(8)} ${u.email.padEnd(22)} dept=${u.departmentId ?? '-'} ${u.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
