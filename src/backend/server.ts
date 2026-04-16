/**
 * KGD Backend Server
 *
 * Express API for document generation, persistence, and management.
 * Start: npm run api
 * Port : 4000
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config();
// Must be imported before any router — patches express 4 to forward async
// throws to the global error handler instead of silently 500-ing.
try { require('express-async-errors'); } catch { /* optional in dev */ }
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { devAuth } from './middleware/auth';
import documentsRouter from './api/documents';
import templatesRouter from './api/templates';
import workflowRouter from './api/workflow';
import authRouter from './api/auth';
import knowledgeRouter from './api/knowledge';
import aiRouter from './api/ai';
import settingsRouter from './api/settings';
import graphRouter from './api/graph';
import auditRouter from './api/audit';
import searchRouter from './api/search';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }),
);
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Graceful-degrade for GET requests when any route hand-writes a 500
// carrying the Prisma "DATABASE_URL not found" error. Individual route
// handlers have their own try/catch that predates the global handler,
// so we intercept the response writer instead of relying on next(err).
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const origJson = res.json.bind(res);
  res.json = function (body: any) {
    const isDbErr = typeof body?.error === 'string' && /Environment variable not found: DATABASE_URL|did not initialize|connect ECONNREFUSED/i.test(body.error);
    if (isDbErr && body?.success === false) {
      res.status(200);
      return origJson({ success: true, data: [], degraded: 'db_unavailable' });
    }
    return origJson(body);
  };
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', version: '0.1.0' } });
});

app.use('/api/templates', templatesRouter);
app.use('/api/auth', (req, res, next) => {
  // Public routes: users list (dev), public Firebase config
  if (req.path === '/users' || req.path === '/public-config') return next();
  return devAuth(req, res, next);
}, authRouter);
app.use('/api/documents', devAuth, documentsRouter);
app.use('/api', devAuth, workflowRouter);
app.use('/api', devAuth, knowledgeRouter);
app.use('/api/ai', devAuth, aiRouter);
app.use('/api/settings', devAuth, settingsRouter);
app.use('/api/graph', devAuth, graphRouter);
app.use('/api', devAuth, auditRouter);
app.use('/api', devAuth, searchRouter);

// Graceful-degrade error handler: Prisma/DB failures in production (no
// DATABASE_URL wired yet) shouldn't take the whole UI down. Read routes
// get empty-success fallbacks so pages render.
app.use(
  (err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const msg = String(err?.message || err);
    const isDbEnvErr = /Environment variable not found: DATABASE_URL|did not initialize|connect ECONNREFUSED/i.test(msg);
    if (isDbEnvErr && req.method === 'GET') {
      console.warn('DB unavailable for GET', req.path, '— returning empty success');
      return res.json({ success: true, data: Array.isArray((req as any).fallbackData) ? (req as any).fallbackData : [], degraded: 'db_unavailable' });
    }
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: isDbEnvErr ? 'database unavailable' : 'Internal server error' });
  },
);

// Only start the HTTP listener when this file is executed directly
// (local dev). When imported from a Firebase Function wrapper, we just
// export the configured Express app.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🇰🇭 KGD API running on http://localhost:${PORT}`);
  });
}

export default app;
