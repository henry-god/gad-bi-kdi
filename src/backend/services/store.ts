/**
 * Storage backend selector.
 *
 * KGD_STORE=firestore (production, default) → Firestore via firestore-service.
 * KGD_STORE=prisma (local dev, tests) → Postgres via @prisma/client.
 */

export const STORE_KIND: 'firestore' | 'prisma' =
  (process.env.KGD_STORE as any) || (process.env.DATABASE_URL ? 'prisma' : 'firestore');

export const isFirestore = () => STORE_KIND === 'firestore';
export const isPrisma = () => STORE_KIND === 'prisma';
