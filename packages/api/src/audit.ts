import type { FastifyRequest } from 'fastify';
import type { Db, Tx } from './db.ts';

export type AuditEvent = 'register' | 'login_password' | 'login_mfa' | 'login_recovery' | 'totp_setup' | 'logout' | 'invite_created' | 'password_reset_request' | 'password_reset'
  | 'stepup' | 'invite_revoked' | 'user_locked' | 'user_unlocked' | 'user_sessions_revoked' | 'user_mfa_reset'
  | 'account_password' | 'account_recovery_codes' | 'account_session_revoked' | 'account_deleted'
  | 'account_email_request' | 'account_email_changed' | 'account_email_changed_cli';

/** Protokolliert sicherheitsrelevante Ereignisse (Zeit, Nutzer, IP, Gerät, Ergebnis). */
export async function audit(c: Db | Tx, req: FastifyRequest | null, e: { event: AuditEvent; ok: boolean; userId?: string | null; email?: string | null; target?: string | null }) {
  await c.query(
    'INSERT INTO audit_log (user_id, email, event, ok, ip, user_agent, target) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [e.userId ?? null, e.email ?? null, e.event, e.ok, req?.ip ?? null, req ? String(req.headers['user-agent'] ?? '').slice(0, 300) : null, e.target ?? null]
  );
}

/** Zu viele Fehlversuche für diese E-Mail in den letzten 15 Minuten? */
export async function tooManyFailures(db: Db, email: string, limit = 10): Promise<boolean> {
  const r = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM audit_log WHERE email = $1 AND NOT ok AND at > now() - interval '15 minutes'
       AND event IN ('login_password', 'login_mfa', 'login_recovery', 'password_reset', 'stepup', 'account_password', 'account_deleted', 'account_email_request')`,
    [email]
  );
  return Number(r.rows[0].n) >= limit;
}
