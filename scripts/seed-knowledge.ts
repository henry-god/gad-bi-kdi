/**
 * Seed Knowledge Database
 * 
 * Phase 1: Just validates seed data files exist and are well-formed
 * Phase 3: Loads into ChromaDB with embeddings
 * 
 * Run: npm run seed
 */

import * as fs from 'fs';
import * as path from 'path';

const SEEDS_DIR = path.join(__dirname, '../knowledge/seeds');
const SCHEMA_DIR = path.join(__dirname, '../knowledge/schema');
const RULES_DIR = path.join(__dirname, '../knowledge/rules');

async function seed() {
  console.log('🌱 Seeding knowledge database...\n');

  // 1. Validate schemas
  const schemas = fs.readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.json'));
  console.log(`📋 Found ${schemas.length} knowledge schemas:`);
  for (const s of schemas) {
    const data = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, s), 'utf-8'));
    console.log(`   ✓ ${data.categoryId}: ${data.name} (${data.nameKm})`);
  }

  // 2. Validate rules
  const rules = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  console.log(`\n📜 Found ${rules.length} document rule sets:`);
  for (const r of rules) {
    const data = JSON.parse(fs.readFileSync(path.join(RULES_DIR, r), 'utf-8'));
    const mustWrite = data.mustWrite?.length || 0;
    const mustNot = data.mustNotWrite?.length || 0;
    console.log(`   ✓ ${data.templateId}: ${mustWrite} must-write, ${mustNot} must-not-write rules`);
  }

  // 3. Load seed data
  const seedFiles = fs.readdirSync(SEEDS_DIR).filter(f => f.endsWith('.json'));
  console.log(`\n📦 Found ${seedFiles.length} seed data files:`);
  let totalEntries = 0;
  for (const sf of seedFiles) {
    const entries = JSON.parse(fs.readFileSync(path.join(SEEDS_DIR, sf), 'utf-8'));
    totalEntries += entries.length;
    console.log(`   ✓ ${sf}: ${entries.length} entries`);
  }

  console.log(`\n✅ Knowledge base validated: ${schemas.length} schemas, ${rules.length} rule sets, ${totalEntries} seed entries`);

  // Phase 3: Load into ChromaDB
  // const chroma = new ChromaClient({ path: process.env.CHROMA_URL });
  // const collection = await chroma.getOrCreateCollection({ name: 'kgd-knowledge' });
  // for (const entry of allEntries) {
  //   await collection.add({ ids: [entry.id], documents: [entry.content], metadatas: [entry.metadata] });
  // }
}

seed().catch(console.error);
