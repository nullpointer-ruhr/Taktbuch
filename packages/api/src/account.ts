// Selbstverwaltung für Nutzer: Passwort, Recovery-Codes, Geräte, Export, Konto löschen.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from './config.ts';
import { tx, withOrg, type Db } from './db.ts';
import { audit } from './audit.ts';
import { destroySession, readSession, type SessionUser } from './session.ts';
import { argonHash, argonVerify, ARGON, EMAIL_RE, fail, normEmail } from './auth.ts';
import { checkSecondFactor } from './factor.ts';
import { normalizeRecovery, recoveryCode, sha256, token } from './secrets.ts';
import { ensureRecords, loadState } from './sync.ts';
import { accountDeletedMail, emailChangedMail, emailConfirmMail, type Mailer } from './mail.ts';

export const EMAIL_CHANGE_MINUTES = 60;

/**
 * E-Mail-Adresse direkt ändern, ohne Bestätigungslink (nur über die Kommandozeile des Betreibers).
 * Für den Fall, dass die neue Adresse Mails von Taktbuch nicht annimmt (Firmen-Mailfilter).
 * Offene Änderungs- und Passwort-Links werden ungültig, Sessions bleiben bestehen.
 */
export async function changeEmailDirect(db: Db, oldEmail: string, newEmail: string): Promise<{ oldEmail: string; newEmail: string }> {
  const from = normEmail(oldEmail), to = normEmail(newEmail);
  if (!EMAIL_RE.test(to) || to.length > 254) throw new Error(`Keine gültige E-Mail-Adresse: ${newEmail}`);
  if (from === to) throw new Error('Alte und neue Adresse sind gleich.');
  return tx(db, async c => {
    const u = await c.query<{ id: string }>('SELECT id FROM users WHERE email = $1 FOR UPDATE', [from]);
    if (!u.rows[0]) throw new Error(`Kein Konto mit der Adresse ${from}.`);
    const taken = await c.query('SELECT 1 FROM users WHERE email = $1', [to]);
    if (taken.rowCount) throw new Error(`Die Adresse ${to} gehört schon zu einem anderen Konto.`);
    const id = u.rows[0].id;
    await c.query('UPDATE users SET email = $2 WHERE id = $1', [id, to]);
    await c.query('UPDATE email_changes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [id]);
    await c.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [id]);
    await audit(c, null, { event: 'account_email_changed_cli', ok: true, userId: id, email: to, target: from });
    return { oldEmail: from, newEmail: to };
  });
}

const UUID = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;
const limited = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

export function accountRoutes(app: FastifyInstance, db: Db, cfg: Config, mailer: Mailer | null) {
  const user = async (req: FastifyRequest, reply: FastifyReply): Promise<(SessionUser & { orgId: string }) | null> => {
    const s = await readSession(db, cfg, req);
    if (!s) { reply.code(401).send({ message: 'Nicht angemeldet' }); return null; }
    if (s.kind !== 'user' || !s.orgId) { reply.code(403).send({ message: 'Nur für Nutzerkonten.' }); return null; }
    return s as SessionUser & { orgId: string };
  };

  app.get('/api/account', async (req, reply) => {
    const s = await user(req, reply); if (!s) return reply;
    const [u, sessions, codes] = await Promise.all([
      db.query<{ created_at: Date }>('SELECT created_at FROM users WHERE id = $1', [s.userId]),
      db.query(`SELECT id, created_at, last_seen_at, user_agent, host(ip) AS ip, id = $2 AS current
                  FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY last_seen_at DESC`, [s.userId, s.sessionId]),
      db.query<{ n: number }>('SELECT count(*)::int AS n FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL', [s.userId]),
    ]);
    return { email: s.email, createdAt: u.rows[0].created_at, sessions: sessions.rows, recoveryCodesLeft: codes.rows[0].n };
  });

  // Passwort ändern: aktuelles Passwort als Nachweis; danach alle anderen Geräte abgemeldet.
  app.post('/api/account/password', limited, async (req: FastifyRequest<{ Body: { current?: string; password?: string } }>, reply) => {
    const s = await user(req, reply); if (!s) return reply;
    const pw = String(req.body?.password ?? '');
    if (pw.length < 12 || pw.length > 256) fail(400, 'Das neue Passwort muss mindestens 12 Zeichen haben.');
    const r = await db.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [s.userId]);
    const ok = await argonVerify(r.rows[0].password_hash, String(req.body?.current ?? '').slice(0, 256)).catch(() => false);
    await audit(db, req, { event: 'account_password', ok, userId: s.userId, email: s.email });
    if (!ok) fail(401, 'Das aktuelle Passwort stimmt nicht.');
    const h = await argonHash(pw, ARGON);
    await tx(db, async c => {
      await c.query('UPDATE users SET password_hash = $2 WHERE id = $1', [s.userId, h]);
      await c.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [s.userId, s.sessionId]);
    });
    return { ok: true };
  });

  // E-Mail-Adresse ändern, Schritt 1: Passwort + zweiter Faktor, dann Bestätigungslink an die NEUE Adresse.
  // Erst mit dem Klick auf den Link (Schritt 2) gilt die neue Adresse; so ist sicher, dass sie erreichbar ist.
  app.post('/api/account/email', limited, async (req: FastifyRequest<{ Body: { email?: string; password?: string; code?: string } }>, reply) => {
    const s = await user(req, reply); if (!s) return reply;
    if (!mailer) fail(503, 'Mailversand ist auf diesem Server nicht eingerichtet. Bitte an den Betreiber wenden.');
    const email = normEmail(req.body?.email);
    if (!EMAIL_RE.test(email) || email.length > 254) fail(400, 'Bitte eine gültige E-Mail-Adresse angeben.');
    if (email === s.email) fail(400, 'Das ist schon deine aktuelle Adresse.');
    const r = await db.query<{ password_hash: string; recent: number }>(
      `SELECT password_hash, (SELECT count(*)::int FROM email_changes e WHERE e.user_id = u.id AND e.created_at > now() - interval '1 hour') AS recent
         FROM users u WHERE id = $1`, [s.userId]);
    if (r.rows[0].recent >= 3) fail(429, 'Zu viele Änderungsanfragen. Bitte in einer Stunde erneut versuchen.');
    const pwOk = await argonVerify(r.rows[0].password_hash, String(req.body?.password ?? '').slice(0, 256)).catch(() => false);
    const t = token();
    const ok = await tx(db, async c => {
      const f = pwOk ? await checkSecondFactor(c, cfg, s.userId, req.body?.code) : null;
      await audit(c, req, { event: 'account_email_request', ok: !!f, userId: s.userId, email: s.email, target: email });
      if (!f) return false;
      await c.query('UPDATE email_changes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [s.userId]);   // nur der neueste Link gilt
      await c.query(`INSERT INTO email_changes (token_hash, user_id, new_email, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
        [sha256(t), s.userId, email, EMAIL_CHANGE_MINUTES]);
      return true;
    });
    if (!ok) fail(401, 'Passwort oder Code stimmt nicht.');
    const taken = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (taken.rowCount) fail(409, 'Diese Adresse gehört schon zu einem anderen Konto.');
    try { await mailer!.send(emailConfirmMail(email, `${cfg.publicOrigin}/email-bestaetigen#email=${t}`, EMAIL_CHANGE_MINUTES)); }
    catch (e) { app.log.error(e, 'Mailversand fehlgeschlagen'); fail(502, 'Die Mail konnte gerade nicht verschickt werden. Bitte später erneut versuchen.'); }
    return { ok: true, sentTo: email, minutes: EMAIL_CHANGE_MINUTES };
  });

  // Schritt 2: Link aus der Mail. Braucht keine Anmeldung, der Link beweist den Zugriff auf das neue Postfach.
  // Offene Passwort-Links an die alte Adresse werden ungültig; die alte Adresse bekommt einen Hinweis.
  app.post('/api/auth/email-confirm', limited, async (req: FastifyRequest<{ Body: { token?: string } }>) => {
    const t = req.body?.token;
    if (typeof t !== 'string' || !t) fail(400, 'Der Link ist unvollständig.');
    const res = await tx(db, async c => {
      const r = await c.query<{ user_id: string; new_email: string; old_email: string }>(
        `SELECT e.user_id, e.new_email, u.email AS old_email FROM email_changes e JOIN users u ON u.id = e.user_id
          WHERE e.token_hash = $1 AND e.used_at IS NULL AND e.expires_at > now() FOR UPDATE OF e, u`, [sha256(t!)]);
      const row = r.rows[0];
      if (!row) fail(400, 'Der Link ist ungültig oder abgelaufen. Bitte die Änderung auf der Konto-Seite neu anfordern.');
      const taken = await c.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [row.new_email, row.user_id]);
      if (taken.rowCount) fail(409, 'Diese Adresse gehört inzwischen zu einem anderen Konto.');
      await c.query('UPDATE users SET email = $2 WHERE id = $1', [row.user_id, row.new_email]);
      await c.query('UPDATE email_changes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
      await c.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
      await audit(c, req, { event: 'account_email_changed', ok: true, userId: row.user_id, email: row.new_email, target: row.old_email });
      return row;
    });
    if (mailer) await mailer.send(emailChangedMail(res.old_email, res.new_email)).catch(e => app.log.error(e, 'Hinweis an alte Adresse nicht verschickt'));
    return { ok: true, email: res.new_email };
  });

  // Neue Recovery-Codes: zweiter Faktor als Nachweis; die alten werden ungültig.
  app.post('/api/account/recovery-codes', limited, async (req: FastifyRequest<{ Body: { code?: string } }>, reply) => {
    const s = await user(req, reply); if (!s) return reply;
    const codes = await tx(db, async c => {
      const f = await checkSecondFactor(c, cfg, s.userId, req.body?.code);
      await audit(c, req, { event: 'account_recovery_codes', ok: !!f, userId: s.userId, email: s.email });
      if (!f) return null;
      await c.query('DELETE FROM recovery_codes WHERE user_id = $1', [s.userId]);
      const list = Array.from({ length: 10 }, recoveryCode);
      for (const code of list) await c.query('INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)', [s.userId, sha256(normalizeRecovery(code))]);
      return list;
    });
    return codes ? { recoveryCodes: codes } : fail(401, 'Der Code stimmt nicht.');
  });

  app.post('/api/account/sessions/:id/revoke', { schema: { params: UUID } }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const s = await user(req, reply); if (!s) return reply;
    if (req.params.id === s.sessionId) fail(400, 'Für dieses Gerät bitte „Abmelden“ benutzen.');
    const r = await db.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [req.params.id, s.userId]);
    if (!r.rowCount) fail(404, 'Gerät nicht gefunden.');
    await audit(db, req, { event: 'account_session_revoked', ok: true, userId: s.userId, email: s.email });
    return { ok: true };
  });

  // Export: alle gespeicherten Daten als JSON-Datei (DSGVO Art. 20).
  app.get('/api/account/export', async (req, reply) => {
    const s = await user(req, reply); if (!s) return reply;
    const st = await withOrg(db, s.orgId, async c => { await ensureRecords(c, s.orgId, s.userId); return loadState(c, s.orgId); });
    // Format der App-Sicherung: lässt sich in der Offline-Version direkt importieren
    const data = { app: 'stundenkonto', v: 1, exported: new Date().toISOString(), konto: s.email, cfg: st.cfg, days: st.days, acts: st.acts, pay: st.pay };
    return reply
      .header('Content-Disposition', `attachment; filename="taktbuch-export-${new Date().toISOString().slice(0, 10)}.json"`)
      .header('Cache-Control', 'no-store')
      .type('application/json; charset=utf-8').send(JSON.stringify(data, null, 2));
  });

  // Konto löschen: Passwort + zweiter Faktor + ausdrückliche Bestätigung. Löscht Konto, Organisation und alle Daten.
  app.post('/api/account/delete', limited, async (req: FastifyRequest<{ Body: { password?: string; code?: string; confirm?: string } }>, reply) => {
    const s = await user(req, reply); if (!s) return reply;
    if (req.body?.confirm !== 'LÖSCHEN') fail(400, 'Bitte zur Bestätigung LÖSCHEN eintippen.');
    const r = await db.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [s.userId]);
    const pwOk = await argonVerify(r.rows[0].password_hash, String(req.body?.password ?? '').slice(0, 256)).catch(() => false);
    const done = await tx(db, async c => {
      const f = pwOk ? await checkSecondFactor(c, cfg, s.userId, req.body?.code) : null;
      if (!pwOk || !f) {
        await audit(c, req, { event: 'account_deleted', ok: false, userId: s.userId, email: s.email });
        return false;
      }
      // Organisationen, in denen der Nutzer allein ist, mitsamt Daten (kv per CASCADE); dann den Nutzer.
      await c.query(`DELETE FROM organizations o WHERE o.id IN (SELECT org_id FROM memberships WHERE user_id = $1)
                       AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = o.id AND m.user_id <> $1)`, [s.userId]);
      await c.query('DELETE FROM users WHERE id = $1', [s.userId]);
      await audit(c, req, { event: 'account_deleted', ok: true, userId: null, email: s.email });
      return true;
    });
    if (!done) fail(401, 'Passwort oder Code stimmt nicht.');
    await destroySession(db, cfg, req, reply);
    if (mailer) await mailer.send(accountDeletedMail(s.email)).catch(e => app.log.error(e, 'Löschbestätigung nicht verschickt'));
    return { ok: true };
  });
}
