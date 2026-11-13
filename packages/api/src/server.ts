import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { authRoutes } from './auth.ts';
import { kvRoutes } from './kv.ts';
import { syncRoutes } from './sync.ts';
import { webRoutes } from './web.ts';
import { createMailer, type Mailer } from './mail.ts';
import { adminRoutes } from './admin.ts';
import { accountRoutes } from './account.ts';
import { statusRoutes } from './status.ts';

export async function buildApp(cfg: Config, db: Db, opts: { logger?: boolean; mailer?: Mailer | null } = {}): Promise<FastifyInstance> {
  const mailer = opts.mailer !== undefined ? opts.mailer : createMailer(cfg);
  const app = Fastify({
    logger: opts.logger ?? true,
    trustProxy: cfg.trustProxy,   // hinter Traefik: echte Client-IP aus X-Forwarded-For
    bodyLimit: 64 * 1024,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  // CSRF-Schutz zusätzlich zu SameSite=Strict: schreibende API-Aufrufe nur von der eigenen Origin.
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.method === 'GET' || req.method === 'HEAD') return;
    if (req.headers.origin !== cfg.publicOrigin) return reply.code(403).send({ message: 'Ungültige Herkunft der Anfrage' });
  });

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/readyz', async (_req, reply) => {
    try { await db.query('SELECT 1'); return { ok: true }; }
    catch { return reply.code(503).send({ ok: false }); }
  });
  statusRoutes(app, db);   // Version, Commit, Build, DB-Zustand (öffentlich, ohne Interna)

  authRoutes(app, db, cfg, mailer);
  app.get('/api/config', async () => ({ mail: !!mailer }));   // Login-Seite: "Passwort vergessen" nur mit Mailversand
  adminRoutes(app, db, cfg, mailer);
  accountRoutes(app, db, cfg, mailer);
  kvRoutes(app, db, cfg);
  syncRoutes(app, db, cfg);
  webRoutes(app, db, cfg);
  return app;
}
