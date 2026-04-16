/**
 * Firestore adapter — V5-M7.
 *
 * All production persistence flows through here. Prisma stays available
 * for local dev (Docker Postgres) but is not imported by the Cloud
 * Function runtime. Switching between the two is controlled by the
 * KGD_STORE env var: "firestore" (default in prod) or "prisma".
 *
 * Firestore DB id: default "(default)". If the project uses a named
 * database, set FIRESTORE_DATABASE_ID (e.g. "kdi1").
 */

import admin from 'firebase-admin';

let _app: admin.app.App | null = null;
let _db: FirebaseFirestore.Firestore | null = null;

function appInstance(): admin.app.App {
  if (_app) return _app;
  if (admin.apps.length) {
    _app = admin.apps[0] as admin.app.App;
    return _app;
  }
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson && saJson.trim().startsWith('{')) {
    const parsed = JSON.parse(saJson);
    _app = admin.initializeApp({ credential: admin.credential.cert(parsed), projectId: parsed.project_id });
  } else {
    // Cloud Functions runtime provides ADC credentials automatically.
    _app = admin.initializeApp();
  }
  return _app;
}

export function db(): FirebaseFirestore.Firestore {
  if (_db) return _db;
  const app = appInstance();
  const databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';
  if (databaseId && databaseId !== '(default)') {
    _db = (admin.firestore as any)(app, databaseId);
  } else {
    _db = admin.firestore(app);
  }
  (_db as FirebaseFirestore.Firestore).settings({ ignoreUndefinedProperties: true });
  return _db as FirebaseFirestore.Firestore;
}

type WhereTuple = [string, FirebaseFirestore.WhereFilterOp, any];
type OrderTuple = [string, 'asc' | 'desc'];

export interface ListOpts {
  where?: WhereTuple[];
  orderBy?: OrderTuple[];
  limit?: number;
  startAfter?: any;
}

function applyQuery(col: FirebaseFirestore.CollectionReference, opts?: ListOpts): FirebaseFirestore.Query {
  let q: FirebaseFirestore.Query = col;
  for (const [f, op, v] of opts?.where ?? []) q = q.where(f, op, v);
  for (const [f, dir] of opts?.orderBy ?? []) q = q.orderBy(f, dir);
  if (opts?.startAfter !== undefined) q = q.startAfter(opts.startAfter);
  if (opts?.limit) q = q.limit(opts.limit);
  return q;
}

export async function getOne<T = any>(collection: string, id: string): Promise<(T & { id: string }) | null> {
  const snap = await db().collection(collection).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as any) } as T & { id: string };
}

export async function list<T = any>(collection: string, opts?: ListOpts): Promise<Array<T & { id: string }>> {
  const q = applyQuery(db().collection(collection), opts);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any;
}

export async function count(collection: string, where?: WhereTuple[]): Promise<number> {
  let q: FirebaseFirestore.Query = db().collection(collection);
  for (const [f, op, v] of where ?? []) q = q.where(f, op, v);
  const agg = await q.count().get();
  return agg.data().count;
}

export async function create<T = any>(collection: string, id: string | null, data: any): Promise<T & { id: string }> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const doc = { ...data, createdAt: data.createdAt ?? now, updatedAt: now };
  if (id) {
    await db().collection(collection).doc(id).set(doc);
    return { id, ...doc } as any;
  }
  const ref = await db().collection(collection).add(doc);
  return { id: ref.id, ...doc } as any;
}

export async function update<T = any>(collection: string, id: string, data: any): Promise<T & { id: string }> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db().collection(collection).doc(id).update({ ...data, updatedAt: now });
  const fresh = await getOne<T>(collection, id);
  return fresh as any;
}

export async function upsert<T = any>(collection: string, id: string, data: any): Promise<T & { id: string }> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db().collection(collection).doc(id).set({ ...data, updatedAt: now }, { merge: true });
  const fresh = await getOne<T>(collection, id);
  return fresh as any;
}

export async function remove(collection: string, id: string): Promise<void> {
  await db().collection(collection).doc(id).delete();
}

export async function subcreate<T = any>(collection: string, parentId: string, sub: string, id: string | null, data: any): Promise<T & { id: string }> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const doc = { ...data, createdAt: data.createdAt ?? now, updatedAt: now };
  const parentRef = db().collection(collection).doc(parentId).collection(sub);
  if (id) {
    await parentRef.doc(id).set(doc);
    return { id, ...doc } as any;
  }
  const ref = await parentRef.add(doc);
  return { id: ref.id, ...doc } as any;
}

export async function sublist<T = any>(collection: string, parentId: string, sub: string, opts?: ListOpts): Promise<Array<T & { id: string }>> {
  const q = applyQuery(db().collection(collection).doc(parentId).collection(sub) as any, opts);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any;
}

export function runTransaction<T>(fn: (tx: FirebaseFirestore.Transaction) => Promise<T>): Promise<T> {
  return db().runTransaction(fn);
}

export const firestore = { db, getOne, list, count, create, update, upsert, remove, subcreate, sublist, runTransaction };
export default firestore;
