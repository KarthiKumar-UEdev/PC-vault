import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { bootstrapUsers } from './middleware/auth.js';

import authRouter from './routes/auth.js';
import pcsRouter, { publicRouter as pcsPublicRouter } from './routes/pcs.js';
import partsRouter from './routes/parts.js';
import employeesRouter from './routes/employees.js';
import networkRouter from './routes/network.js';
import buildsRouter from './routes/builds.js';
import statsRouter from './routes/stats.js';
import alertsRouter from './routes/alerts.js';

const app = express();
const PORT = process.env.PORT || 8000;
const API_PREFIX = '/api/v1';

// ── middleware ──────────────────────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({ origin: corsOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type'] }));
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api/') && !req.path.includes('/docs')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  }
  next();
});

// ── routes ──────────────────────────────────────────────────────────────────
app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/pcs`, pcsPublicRouter);
app.use(`${API_PREFIX}/pcs`, pcsRouter);
app.use(`${API_PREFIX}/parts`, partsRouter);
app.use(`${API_PREFIX}/employees`, employeesRouter);
app.use(`${API_PREFIX}/pcs`, networkRouter);
app.use(`${API_PREFIX}/builds`, buildsRouter);
app.use(`${API_PREFIX}/alerts`, alertsRouter);
app.use(`${API_PREFIX}`, statsRouter);

app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', service: 'pc-vault' }));
app.get('/', (req, res) => res.json({ service: 'pc-vault-api', hint: 'This is the API server.', health: '/api/v1/health' }));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ detail: err.message || 'Internal server error' });
});

// ── start ───────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectDB();
    console.log('MongoDB connected');
  } catch (e) {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  }
  try { await bootstrapUsers(); console.log('Users bootstrapped'); } catch (e) { console.warn('User bootstrap skipped:', e.message); }
  app.listen(PORT, () => {
    console.log(`\n  PC Vault API — http://localhost:${PORT}`);
    console.log(`  Health — http://localhost:${PORT}/api/v1/health\n`);
  });
})();
