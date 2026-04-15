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

app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  },
);

app.listen(PORT, () => {
  console.log(`🇰🇭 KGD API running on http://localhost:${PORT}`);
});

export default app;
