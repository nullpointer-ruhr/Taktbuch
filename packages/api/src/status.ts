// Öffentlicher Status: welche Version läuft, seit wann, und ist die Datenbank erreichbar.
// Gedacht für einen schnellen Blick nach dem Ausrollen (Browser, curl, Agent).
// Bewusst ohne Benutzerzahlen, Hostnamen oder Fehlertexte.
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import type { Db } from './db.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, 'migrations');

// VERSION liegt im Repo-Wurzelverzeichnis (im Image unter /app/VERSION).
function readVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try { return readFileSync(path.join(here, '..', '..', '..', 'VERSION'), 'utf8').trim(); } catch { return 'unbekannt'; }
}

// Commit und Build-Zeit setzt das Image (Build-Args aus image.yml), lokal bleiben sie leer.
export const buildInfo = {
  version: readVersion(),
  commit: (process.env.GIT_SHA || '').slice(0, 7) || null,
  built: process.env.BUILD_TIME || null,
  started: new Date().toISOString(),
};

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms).unref())]);

export function statusRoutes(app: FastifyInstance, db: Db) {
  app.get('/status', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const t0 = performance.now();
    let dbInfo: { ok: boolean; latencyMs?: number; migrations?: number; lastMigration?: string | null; pending?: number };
    try {
      const r = await withTimeout(db.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version'), 2000);
      const applied = r.rows.map(x => x.version);
      const files = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql'));
      dbInfo = {
        ok: true,
        latencyMs: Math.round(performance.now() - t0),
        migrations: applied.length,
        lastMigration: applied.at(-1) ?? null,
        pending: files.filter(f => !applied.includes(f)).length,
      };
    } catch {
      dbInfo = { ok: false };
    }
    const ok = dbInfo.ok && dbInfo.pending === 0;
    return reply.code(ok ? 200 : 503).send({ ok, ...buildInfo, uptimeS: Math.round(process.uptime()), db: dbInfo });
  });
}
