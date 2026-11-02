// Integrationstests gegen eine echte PostgreSQL-Datenbank.
// Aufruf: TEST_DATABASE_URL=postgres://user:pw@host:port/db node --test test/api.test.ts
// Die Datenbank wird dabei geleert (Schema public neu angelegt).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createPool, migrate, type Db } from '../src/db.ts';
import { buildApp } from '../src/server.ts';
import { createInvite } from '../src/auth.ts';
import { changeEmailDirect } from '../src/account.ts';
import { base32Decode, hotp, stepAt } from '../src/totp.ts';
import type { Config } from '../src/config.ts';
import type { Mail } from '../src/mail.ts';

const url = process.env.TEST_DATABASE_URL;
const ORIGIN = 'https://test.taktbuch.example';
let db: Db, app: FastifyInstance, cfg: Config;
const outbox: Mail[] = [];

before(async () => {
  if (!url) return;
  db = createPool(url);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db);
  const web = mkdtempSync(path.join(tmpdir(), 'tbweb-'));
  writeFileSync(path.join(web, 'taktbuch.html'), '<!doctype html><p>App</p><script>window.x=1</script>');
  writeFileSync(path.join(web, 'login.html'), '<!doctype html><p>Login</p><script>window.y=2</script>');
  cfg = { port: 0, host: '127.0.0.1', databaseUrl: url, publicOrigin: ORIGIN, totpKey: randomBytes(32), secureCookies: true, webDir: web, sessionDays: 30, trustProxy: true, smtpUrl: null, smtp: null, mailFrom: 'Taktbuch <noreply@taktbuch.de>', mailReplyTo: null };
  app = await buildApp(cfg, db, { logger: false, mailer: { send: async m => { outbox.push(m); } } });
});
after(async () => { if (url) { await app.close(); await db.end(); } });

const skip = !url && 'TEST_DATABASE_URL nicht gesetzt';
const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url: p, payload: body as object, headers: { origin: ORIGIN, 'x-forwarded-for': '203.0.113.' + (1 + Math.floor(Math.random() * 200)), ...headers } });
const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const sc = res.headers['set-cookie'];
  const line = (Array.isArray(sc) ? sc : [sc]).find(s => String(s).startsWith('__Host-session='));
  assert.ok(line, 'Session-Cookie gesetzt');
  assert.match(String(line), /HttpOnly/i); assert.match(String(line), /Secure/i); assert.match(String(line), /SameSite=Strict/i);
  return String(line).split(';')[0];
};
/** Code für den nächsten Zeitschritt: der aktuelle ist nach Benutzung gesperrt (Replay-Schutz). */
const code = (secret: string, offset = 0) => hotp(base32Decode(secret), stepAt(Date.now()) + offset);

async function register(email: string, kind: 'user' | 'admin' = 'user') {
  const { link } = await createInvite(db, cfg, email, 7, null, { kind });
  const invite = new URL(link).hash.split('invite=')[1];
  const r = await post('/api/auth/register', { invite, email, password: 'ein-langes-passwort' });
  assert.equal(r.statusCode, 200, r.body);
  const d = r.json();
  assert.equal(d.next, 'setup'); assert.match(d.qr, /^data:image\/png;base64,/); assert.match(d.otpauth, /^otpauth:\/\/totp\//);
  const c = await post('/api/auth/totp/confirm', { ticket: d.ticket, code: code(d.secret) });
  assert.equal(c.statusCode, 200, c.body);
  return { invite, secret: d.secret as string, recovery: c.json().recoveryCodes as string[], cookie: cookieOf(c) };
}

test('Registrierung, TOTP, Recovery-Codes, Session', { skip }, async () => {
  const u = await register('dirk@example.org');
  assert.equal(u.recovery.length, 10);
  const me = await app.inject({ url: '/api/me', headers: { cookie: u.cookie } });
  assert.equal(me.statusCode, 200); assert.equal(me.json().email, 'dirk@example.org');
  const again = await post('/api/auth/register', { invite: u.invite, email: 'x@example.org', password: 'ein-langes-passwort' });
  assert.equal(again.statusCode, 400, 'Einladung nur einmal verwendbar');
});

test('Login: Passwort + TOTP, Replay, falsches Passwort, Recovery-Code', { skip }, async () => {
  const u = await register('mella@example.org');
  const bad = await post('/api/auth/login', { email: 'mella@example.org', password: 'falsch-falsch-falsch' });
  assert.equal(bad.statusCode, 401);
  const unknown = await post('/api/auth/login', { email: 'niemand@example.org', password: 'egal-egal-egal' });
  assert.equal(unknown.statusCode, 401); assert.equal(unknown.json().message, bad.json().message, 'keine Auskunft, ob es das Konto gibt');

  const l1 = await post('/api/auth/login', { email: 'MELLA@example.org', password: 'ein-langes-passwort' });
  assert.equal(l1.statusCode, 200); assert.equal(l1.json().next, 'mfa');
  const wrong = await post('/api/auth/mfa', { ticket: l1.json().ticket, code: '000000' });
  assert.equal(wrong.statusCode, 401);
  const ok = await post('/api/auth/mfa', { ticket: l1.json().ticket, code: code(u.secret, 1) });
  assert.equal(ok.statusCode, 200, ok.body); cookieOf(ok);

  const l2 = await post('/api/auth/login', { email: 'mella@example.org', password: 'ein-langes-passwort' });
  const replay = await post('/api/auth/mfa', { ticket: l2.json().ticket, code: code(u.secret, 1) });
  assert.equal(replay.statusCode, 401, 'derselbe Code wird nicht zweimal akzeptiert');
  const rec = await post('/api/auth/mfa', { ticket: l2.json().ticket, code: u.recovery[0].toUpperCase() });
  assert.equal(rec.statusCode, 200, rec.body); assert.equal(rec.json().recoveryCodesLeft, 9);

  const l3 = await post('/api/auth/login', { email: 'mella@example.org', password: 'ein-langes-passwort' });
  const reuse = await post('/api/auth/mfa', { ticket: l3.json().ticket, code: u.recovery[0] });
  assert.equal(reuse.statusCode, 401, 'Recovery-Code nur einmal');
});

test('Ticket: höchstens 5 Versuche', { skip }, async () => {
  await register('ticket@example.org');
  const l = await post('/api/auth/login', { email: 'ticket@example.org', password: 'ein-langes-passwort' });
  for (let i = 0; i < 5; i++) assert.equal((await post('/api/auth/mfa', { ticket: l.json().ticket, code: '111111' })).statusCode, 401);
  assert.equal((await post('/api/auth/mfa', { ticket: l.json().ticket, code: '111111' })).statusCode, 429);
});

test('Sperre nach 10 Fehlversuchen pro Konto', { skip }, async () => {
  await register('sperre@example.org');
  for (let i = 0; i < 10; i++) await post('/api/auth/login', { email: 'sperre@example.org', password: 'falsch-falsch-' + i });
  const r = await post('/api/auth/login', { email: 'sperre@example.org', password: 'ein-langes-passwort' });
  assert.equal(r.statusCode, 429);
});

test('Datenablage: Version, Konflikt, Trennung der Mandanten', { skip }, async () => {
  const a = await register('a@example.org'), b = await register('b@example.org');
  const get = (cookie: string) => app.inject({ url: '/api/kv/state', headers: { cookie } });
  const put = (cookie: string, value: unknown, version: number | null) =>
    app.inject({ method: 'PUT', url: '/api/kv/state', payload: { value, version }, headers: { cookie, origin: ORIGIN } });

  assert.equal((await get(a.cookie)).statusCode, 404);
  const p1 = await put(a.cookie, '{"v":1,"days":{}}', null);
  assert.equal(p1.statusCode, 200, p1.body); assert.equal(p1.json().version, 1);
  assert.deepEqual((await get(a.cookie)).json(), { value: '{"v":1,"days":{}}', version: 1 });
  assert.equal((await put(a.cookie, 'zweites Gerät', null)).statusCode, 409, 'Neuanlage trotz vorhandener Daten');
  assert.equal((await put(a.cookie, 'neu', 1)).json().version, 2);
  assert.equal((await put(a.cookie, 'veraltet', 1)).statusCode, 409, 'veraltete Version wird abgewiesen');
  assert.equal((await get(b.cookie)).statusCode, 404, 'B sieht die Daten von A nicht');
  assert.equal((await put(b.cookie, 'B', null)).statusCode, 200);
  assert.equal((await get(a.cookie)).json().value, 'neu');
  assert.equal((await app.inject({ url: '/api/kv/state' })).statusCode, 401, 'ohne Session');
  assert.equal((await app.inject({ url: '/api/kv/..%2Fx', headers: { cookie: a.cookie } })).statusCode, 400, 'Schlüssel geprüft');
});

test('Schutz: Origin-Prüfung, Logout, Web-Seiten mit CSP', { skip }, async () => {
  const u = await register('web@example.org');
  const evil = await app.inject({ method: 'PUT', url: '/api/kv/state', payload: { value: 1, version: null }, headers: { cookie: u.cookie, origin: 'https://boese.example' } });
  assert.equal(evil.statusCode, 403);
  const noOrigin = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: u.cookie } });
  assert.equal(noOrigin.statusCode, 403);

  const anon = await app.inject({ url: '/' });
  assert.equal(anon.statusCode, 302); assert.equal(anon.headers.location, '/login');
  const login = await app.inject({ url: '/login' });
  assert.equal(login.statusCode, 200); assert.match(String(login.headers['content-security-policy']), /script-src 'sha256-/);
  assert.equal(login.headers['x-frame-options'], 'DENY');
  const page = await app.inject({ url: '/', headers: { cookie: u.cookie } });
  assert.equal(page.statusCode, 200); assert.match(page.body, /App/);
  assert.equal((await app.inject({ url: '/login', headers: { cookie: u.cookie } })).statusCode, 302, 'angemeldet: weiter zur App');

  const out = await post('/api/auth/logout', {}, { cookie: u.cookie });
  assert.equal(out.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/me', headers: { cookie: u.cookie } })).statusCode, 401, 'Session nach Logout ungültig');
});

test('Health-Endpunkte', { skip }, async () => {
  assert.equal((await app.inject({ url: '/healthz' })).statusCode, 200);
  assert.equal((await app.inject({ url: '/readyz' })).statusCode, 200);
});

const linkFrom = (m: Mail, key: string) => {
  const u = m.text.match(new RegExp(`${ORIGIN}/login#${key}=([A-Za-z0-9_-]+)`));
  assert.ok(u, 'Link in der Mail'); return u![1];
};

test('Einladung per Mail', { skip }, async () => {
  const n = outbox.length;
  const r = await createInvite(db, cfg, 'Neu@Example.org', 7, { send: async m => { outbox.push(m); } });
  assert.equal(r.mailed, true); assert.equal(outbox.length, n + 1);
  assert.equal(outbox.at(-1)!.to, 'neu@example.org');
  assert.equal(linkFrom(outbox.at(-1)!, 'invite'), new URL(r.link).hash.split('invite=')[1]);
  const broken = await createInvite(db, cfg, 'x@example.org', 7, { send: async () => { throw new Error('SMTP weg'); } });
  assert.equal(broken.mailed, false); assert.equal(broken.mailError, 'SMTP weg'); assert.ok(broken.link, 'Link trotzdem da');
});

test('Passwort vergessen: Mail, zweiter Faktor Pflicht, alte Sessions ungültig', { skip }, async () => {
  const u = await register('vergessen@example.org');
  const unknown = await post('/api/auth/forgot', { email: 'gibtsnicht@example.org' });
  const n = outbox.length;
  const known = await post('/api/auth/forgot', { email: 'Vergessen@example.org' });
  assert.equal(known.statusCode, 200); assert.equal(known.json().message, unknown.json().message, 'keine Auskunft, ob es das Konto gibt');
  assert.equal(outbox.length, n + 1); assert.equal(outbox.at(-1)!.subject, 'Neues Passwort für Taktbuch');
  const tok = linkFrom(outbox.at(-1)!, 'reset');

  const noCode = await post('/api/auth/reset', { token: tok, password: 'ganz-neues-passwort' });
  assert.equal(noCode.statusCode, 401, 'ohne zweiten Faktor kein neues Passwort');
  const short = await post('/api/auth/reset', { token: tok, password: 'kurz', code: code(u.secret, 1) });
  assert.equal(short.statusCode, 400);
  const ok = await post('/api/auth/reset', { token: tok, password: 'ganz-neues-passwort', code: code(u.secret, 1) });
  assert.equal(ok.statusCode, 200, ok.body); cookieOf(ok);
  assert.equal((await app.inject({ url: '/api/me', headers: { cookie: u.cookie } })).statusCode, 401, 'alte Session abgemeldet');
  assert.equal((await post('/api/auth/reset', { token: tok, password: 'noch-ein-passwort', code: u.recovery[1] })).statusCode, 400, 'Link nur einmal');
  assert.equal((await post('/api/auth/login', { email: 'vergessen@example.org', password: 'ein-langes-passwort' })).statusCode, 401, 'altes Passwort ungültig');
  assert.equal((await post('/api/auth/login', { email: 'vergessen@example.org', password: 'ganz-neues-passwort' })).json().next, 'mfa');
});

test('Passwort vergessen: Recovery-Code, Versuchsgrenze, Mail-Limit', { skip }, async () => {
  const u = await register('limit@example.org');
  const n = outbox.length;
  for (let i = 0; i < 4; i++) await post('/api/auth/forgot', { email: 'limit@example.org' });
  assert.equal(outbox.length, n + 3, 'höchstens 3 Mails pro Stunde');
  const tok = linkFrom(outbox.at(-1)!, 'reset');
  for (let i = 0; i < 5; i++) assert.equal((await post('/api/auth/reset', { token: tok, password: 'ganz-neues-passwort', code: '123456' })).statusCode, 401);
  assert.equal((await post('/api/auth/reset', { token: tok, password: 'ganz-neues-passwort', code: u.recovery[0] })).statusCode, 429, 'Link nach 5 Fehlversuchen gesperrt');
  const tok2 = linkFrom(outbox.at(-2)!, 'reset');
  assert.equal((await post('/api/auth/reset', { token: tok2, password: 'ganz-neues-passwort', code: u.recovery[0] })).statusCode, 200, 'Recovery-Code als zweiter Faktor');
});

test('Ohne Mailversand: Passwort vergessen meldet 503, Konfiguration sagt mail=false', { skip }, async () => {
  const bare = await buildApp(cfg, db, { logger: false, mailer: null });
  try {
    assert.deepEqual((await bare.inject({ url: '/api/config' })).json(), { mail: false });
    const r = await bare.inject({ method: 'POST', url: '/api/auth/forgot', payload: { email: 'a@example.org' }, headers: { origin: ORIGIN } });
    assert.equal(r.statusCode, 503);
  } finally { await bare.close(); }
  assert.deepEqual((await app.inject({ url: '/api/config' })).json(), { mail: true });
});

// ---------- Verwaltung und Konto ----------
const req = (method: 'GET' | 'POST' | 'PUT', url: string, cookie: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie, origin: ORIGIN }, ...(payload !== undefined ? { payload: payload as object } : {}) });
/** Session künstlich altern lassen, damit der Step-up abläuft. */
const ageStepup = (email: string) => db.query(`UPDATE sessions SET mfa_at = now() - interval '20 minutes' WHERE user_id = (SELECT id FROM users WHERE email = $1)`, [email]);

test('Admin-Konto: keine Stundendaten, eigene Startseite, Nutzer kommen nicht in die Verwaltung', { skip }, async () => {
  const a = await register('admin@example.org', 'admin');
  const u = await register('nutzer1@example.org');
  assert.equal((await req('GET', '/api/kv/state', a.cookie)).statusCode, 403, 'Admin hat keine Stundendaten');
  assert.equal((await req('GET', '/', a.cookie)).headers.location, '/admin');
  assert.equal((await req('GET', '/konto', a.cookie)).headers.location, '/admin');
  assert.equal((await req('GET', '/login', a.cookie)).headers.location, '/admin');
  assert.equal((await req('GET', '/admin', u.cookie)).headers.location, '/', 'Nutzer wird aus der Verwaltung umgeleitet');
  assert.equal((await req('GET', '/api/admin/overview', u.cookie)).statusCode, 403);
  assert.equal((await req('GET', '/api/account', a.cookie)).statusCode, 403, 'Konto-Seite nur für Nutzer');
  assert.equal((await req('GET', '/api/me', a.cookie)).json().kind, 'admin');
});

test('Verwaltung: Step-up nach 15 Minuten, falscher Code zählt', { skip }, async () => {
  const a = await register('admin2@example.org', 'admin');
  assert.equal((await req('GET', '/api/admin/overview', a.cookie)).statusCode, 200, 'direkt nach Login frisch');
  await ageStepup('admin2@example.org');
  const blocked = await req('GET', '/api/admin/overview', a.cookie);
  assert.equal(blocked.statusCode, 403); assert.equal(blocked.json().stepup, true);
  assert.equal((await req('POST', '/api/auth/stepup', a.cookie, { code: '000000' })).statusCode, 401);
  assert.equal((await req('POST', '/api/auth/stepup', a.cookie, { code: code(a.secret, 1) })).statusCode, 200);
  const ov = await req('GET', '/api/admin/overview', a.cookie);
  assert.equal(ov.statusCode, 200);
  assert.ok(ov.json().users.some((x: { email: string }) => x.email === 'admin2@example.org'));
  const audit = await req('GET', '/api/admin/audit?limit=20', a.cookie);
  assert.ok(audit.json().entries.some((e: { event: string; ok: boolean }) => e.event === 'stepup' && !e.ok), 'Fehlversuch im Protokoll');
});

test('Verwaltung: Einladungen verschicken und zurückziehen', { skip }, async () => {
  const a = await register('admin3@example.org', 'admin');
  const n = outbox.length;
  const inv = await req('POST', '/api/admin/invites', a.cookie, { email: 'Gast@Example.org', days: 3 });
  assert.equal(inv.statusCode, 200, inv.body); assert.equal(inv.json().mailed, true);
  assert.equal(outbox.length, n + 1); assert.equal(outbox.at(-1)!.to, 'gast@example.org');
  assert.equal((await req('POST', '/api/admin/invites', a.cookie, { email: 'admin3@example.org' })).statusCode, 409, 'Konto existiert schon');
  assert.equal((await req('POST', '/api/admin/invites', a.cookie, { email: 'kaputt' })).statusCode, 400);
  const ov = (await req('GET', '/api/admin/overview', a.cookie)).json();
  const open = ov.invites.find((i: { email: string }) => i.email === 'gast@example.org');
  assert.equal(open.status, 'offen');
  assert.equal((await req('POST', `/api/admin/invites/${open.id}/revoke`, a.cookie)).statusCode, 200);
  const token = new URL(inv.json().link).hash.split('invite=')[1];
  const reg = await post('/api/auth/register', { invite: token, email: 'gast@example.org', password: 'ein-langes-passwort' });
  assert.equal(reg.statusCode, 400, 'zurückgezogene Einladung ist ungültig');
});

test('Verwaltung: sperren, entsperren, abmelden, nicht das eigene Konto', { skip }, async () => {
  const a = await register('admin4@example.org', 'admin');
  const u = await register('sperrbar@example.org');
  const id = (await req('GET', '/api/admin/overview', a.cookie)).json().users.find((x: { email: string }) => x.email === 'sperrbar@example.org').id;
  const me = (await req('GET', '/api/admin/overview', a.cookie)).json().me;
  assert.equal((await req('POST', `/api/admin/users/${me}/lock`, a.cookie)).statusCode, 400, 'eigenes Konto nicht sperrbar');
  assert.equal((await req('POST', `/api/admin/users/${id}/lock`, a.cookie)).statusCode, 200);
  assert.equal((await req('GET', '/api/me', u.cookie)).statusCode, 401, 'gesperrt: Sessions weg');
  const l = await post('/api/auth/login', { email: 'sperrbar@example.org', password: 'ein-langes-passwort' });
  assert.equal(l.statusCode, 403); assert.match(l.json().message, /gesperrt/);
  assert.equal((await req('POST', `/api/admin/users/${id}/unlock`, a.cookie)).statusCode, 200);
  const l2 = await post('/api/auth/login', { email: 'sperrbar@example.org', password: 'ein-langes-passwort' });
  const m = await post('/api/auth/mfa', { ticket: l2.json().ticket, code: code(u.secret, 1) });
  const ck = cookieOf(m);
  assert.equal((await req('POST', `/api/admin/users/${id}/logout`, a.cookie)).statusCode, 200);
  assert.equal((await req('GET', '/api/me', ck)).statusCode, 401, 'alle Geräte abgemeldet');
});

test('Verwaltung: zweiten Faktor zurücksetzen, Nutzer richtet neu ein, Mail geht raus', { skip }, async () => {
  const a = await register('admin5@example.org', 'admin');
  const u = await register('handyweg@example.org');
  const id = (await req('GET', '/api/admin/overview', a.cookie)).json().users.find((x: { email: string }) => x.email === 'handyweg@example.org').id;
  const n = outbox.length;
  assert.equal((await req('POST', `/api/admin/users/${id}/reset-mfa`, a.cookie)).statusCode, 200);
  assert.equal(outbox.length, n + 1); assert.equal(outbox.at(-1)!.subject, 'Zweiter Faktor für Taktbuch zurückgesetzt');
  assert.equal((await req('GET', '/api/me', u.cookie)).statusCode, 401);
  const l = await post('/api/auth/login', { email: 'handyweg@example.org', password: 'ein-langes-passwort' });
  assert.equal(l.json().next, 'setup', 'neue Einrichtung');
  const c = await post('/api/auth/totp/confirm', { ticket: l.json().ticket, code: code(l.json().secret) });
  assert.equal(c.statusCode, 200); assert.equal(c.json().recoveryCodes.length, 10);
  const l2 = await post('/api/auth/login', { email: 'handyweg@example.org', password: 'ein-langes-passwort' });
  assert.equal((await post('/api/auth/mfa', { ticket: l2.json().ticket, code: u.recovery[0] })).statusCode, 401, 'alte Recovery-Codes ungültig');
});

test('Konto: Übersicht, Gerät abmelden, Passwort ändern', { skip }, async () => {
  const u = await register('konto@example.org');
  const l = await post('/api/auth/login', { email: 'konto@example.org', password: 'ein-langes-passwort' });
  const second = cookieOf(await post('/api/auth/mfa', { ticket: l.json().ticket, code: code(u.secret, 1) }));
  const acc = (await req('GET', '/api/account', u.cookie)).json();
  assert.equal(acc.sessions.length, 2); assert.equal(acc.recoveryCodesLeft, 10);
  const other = acc.sessions.find((s: { current: boolean }) => !s.current);
  assert.equal((await req('POST', `/api/account/sessions/${other.id}/revoke`, u.cookie)).statusCode, 200);
  assert.equal((await req('GET', '/api/me', second)).statusCode, 401, 'anderes Gerät abgemeldet');
  assert.equal((await req('POST', '/api/account/password', u.cookie, { current: 'falsch-falsch-falsch', password: 'neues-passwort-123' })).statusCode, 401);
  assert.equal((await req('POST', '/api/account/password', u.cookie, { current: 'ein-langes-passwort', password: 'neues-passwort-123' })).statusCode, 200);
  assert.equal((await req('GET', '/api/me', u.cookie)).statusCode, 200, 'eigenes Gerät bleibt angemeldet');
  assert.equal((await post('/api/auth/login', { email: 'konto@example.org', password: 'neues-passwort-123' })).statusCode, 200);
});

test('Konto: neue Recovery-Codes nur mit zweitem Faktor', { skip }, async () => {
  const u = await register('codes@example.org');
  assert.equal((await req('POST', '/api/account/recovery-codes', u.cookie, { code: '000000' })).statusCode, 401);
  const r = await req('POST', '/api/account/recovery-codes', u.cookie, { code: code(u.secret, 1) });
  assert.equal(r.statusCode, 200); assert.equal(r.json().recoveryCodes.length, 10);
  const l = await post('/api/auth/login', { email: 'codes@example.org', password: 'ein-langes-passwort' });
  assert.equal((await post('/api/auth/mfa', { ticket: l.json().ticket, code: u.recovery[0] })).statusCode, 401, 'alte Codes ungültig');
  assert.equal((await post('/api/auth/mfa', { ticket: l.json().ticket, code: r.json().recoveryCodes[0] })).statusCode, 200);
});

test('Konto: Export und Löschen mitsamt Daten', { skip }, async () => {
  const u = await register('weg@example.org');
  await req('PUT', '/api/kv/state', u.cookie, { value: '{"v":1,"days":{"2026-10-20":{}}}', version: null });
  const ex = await req('GET', '/api/account/export', u.cookie);
  assert.equal(ex.statusCode, 200); assert.match(String(ex.headers['content-disposition']), /attachment; filename="taktbuch-export-/);
  assert.equal(ex.json().app, 'stundenkonto', 'Format der App-Sicherung'); assert.deepEqual(ex.json().days, { '2026-10-20': {} });
  const org = await db.query<{ org_id: string }>("SELECT org_id FROM memberships m JOIN users u ON u.id = m.user_id WHERE u.email = 'weg@example.org'");
  assert.equal((await req('POST', '/api/account/delete', u.cookie, { password: 'ein-langes-passwort', code: code(u.secret, 1), confirm: 'ja' })).statusCode, 400, 'Bestätigungswort fehlt');
  assert.equal((await req('POST', '/api/account/delete', u.cookie, { password: 'falsch-falsch-falsch', code: code(u.secret, 1), confirm: 'LÖSCHEN' })).statusCode, 401);
  const n = outbox.length;
  const del = await req('POST', '/api/account/delete', u.cookie, { password: 'ein-langes-passwort', code: u.recovery[0], confirm: 'LÖSCHEN' });
  assert.equal(del.statusCode, 200, del.body);
  assert.equal(outbox.length, n + 1, 'Bestätigung per Mail');
  assert.equal((await db.query("SELECT 1 FROM users WHERE email = 'weg@example.org'")).rowCount, 0);
  assert.equal((await db.query('SELECT 1 FROM organizations WHERE id = $1', [org.rows[0].org_id])).rowCount, 0);
  await db.query("SELECT set_config('app.org_id', $1, false)", [org.rows[0].org_id]);
  assert.equal((await db.query('SELECT 1 FROM kv WHERE org_id = $1', [org.rows[0].org_id])).rowCount, 0, 'Stundendaten gelöscht');
  await db.query("SELECT set_config('app.org_id', '', false)");
  assert.equal((await req('GET', '/api/me', u.cookie)).statusCode, 401);
});

test('Konto: E-Mail-Adresse ändern mit Bestätigung an die neue Adresse', { skip }, async () => {
  const u = await register('alt@example.org');
  await register('belegt@example.org');
  const linkOf = (m: Mail) => m.text.match(/email-bestaetigen#email=([A-Za-z0-9_-]+)/)![1];
  assert.equal((await req('POST', '/api/account/email', u.cookie, { email: 'neu@example.org', password: 'falsch-falsch-falsch', code: code(u.secret) })).statusCode, 401);
  assert.equal((await req('POST', '/api/account/email', u.cookie, { email: 'belegt@example.org', password: 'ein-langes-passwort', code: u.recovery[0] })).statusCode, 409, 'Adresse vergeben');
  assert.equal((await req('POST', '/api/account/email', u.cookie, { email: 'kaputt', password: 'ein-langes-passwort', code: u.recovery[1] })).statusCode, 400);
  const n = outbox.length;
  const r1 = await req('POST', '/api/account/email', u.cookie, { email: 'Erst@Example.org', password: 'ein-langes-passwort', code: u.recovery[2] });
  assert.equal(r1.statusCode, 200, r1.body);
  const r2 = await req('POST', '/api/account/email', u.cookie, { email: 'Neu@Example.org', password: 'ein-langes-passwort', code: code(u.secret, 1) });
  assert.equal(r2.statusCode, 200, r2.body); assert.equal(r2.json().sentTo, 'neu@example.org');
  assert.equal(outbox.length, n + 2); assert.equal(outbox[n + 1].to, 'neu@example.org');
  assert.equal((await post('/api/auth/email-confirm', { token: linkOf(outbox[n]) })).statusCode, 400, 'älterer Link ungültig');
  assert.equal((await req('GET', '/api/me', u.cookie)).json().email, 'alt@example.org', 'vor Bestätigung unverändert');
  const c = await post('/api/auth/email-confirm', { token: linkOf(outbox[n + 1]) });
  assert.equal(c.statusCode, 200, c.body); assert.equal(c.json().email, 'neu@example.org');
  assert.equal(outbox.at(-1)!.to, 'alt@example.org', 'Hinweis an die alte Adresse');
  assert.equal((await post('/api/auth/email-confirm', { token: linkOf(outbox[n + 1]) })).statusCode, 400, 'nur einmal');
  assert.equal((await req('GET', '/api/me', u.cookie)).json().email, 'neu@example.org', 'Session bleibt');
  assert.equal((await post('/api/auth/login', { email: 'neu@example.org', password: 'ein-langes-passwort' })).statusCode, 200);
  assert.equal((await post('/api/auth/login', { email: 'alt@example.org', password: 'ein-langes-passwort' })).statusCode, 401);
  assert.equal((await req('GET', '/email-bestaetigen', '')).statusCode, 200, 'Seite ohne Weiterleitung');
});

test('Konto: E-Mail-Adresse direkt über die Kommandozeile ändern', { skip }, async () => {
  const u = await register('cli-alt@example.org');
  await register('cli-belegt@example.org');
  const open = await req('POST', '/api/account/email', u.cookie, { email: 'cli-offen@example.org', password: 'ein-langes-passwort', code: u.recovery[0] });
  assert.equal(open.statusCode, 200, open.body);
  const pending = outbox.at(-1)!.text.match(/email-bestaetigen#email=([A-Za-z0-9_-]+)/)![1];
  await assert.rejects(changeEmailDirect(db, 'gibtsnicht@example.org', 'x@example.org'), /Kein Konto/);
  await assert.rejects(changeEmailDirect(db, 'cli-alt@example.org', 'cli-belegt@example.org'), /anderen Konto/);
  await assert.rejects(changeEmailDirect(db, 'cli-alt@example.org', 'kaputt'), /gültige/);
  const r = await changeEmailDirect(db, ' CLI-Alt@Example.org ', 'CLI-Neu@Example.org');
  assert.deepEqual(r, { oldEmail: 'cli-alt@example.org', newEmail: 'cli-neu@example.org' });
  assert.equal((await req('GET', '/api/me', u.cookie)).json().email, 'cli-neu@example.org', 'Session bleibt');
  assert.equal((await post('/api/auth/email-confirm', { token: pending })).statusCode, 400, 'offener Bestätigungslink ungültig');
  assert.equal((await post('/api/auth/login', { email: 'cli-neu@example.org', password: 'ein-langes-passwort' })).statusCode, 200);
  const a = await db.query("SELECT target FROM audit_log WHERE event = 'account_email_changed_cli' ORDER BY at DESC LIMIT 1");
  assert.equal(a.rows[0].target, 'cli-alt@example.org');
});

test('Sync: bisheriger Gesamtstand wird übernommen, ältere Tabs laden neu', { skip }, async () => {
  const u = await register('umzug@example.org');
  const state = { v: 1, cfg: { soll: 7.5, standardThema: 'Alt' }, days: { '2026-10-20': { t: 'arbeit', s: '08:00' } }, acts: [{ id: 'a1', d: '2026-10-20', s: '08:00', e: '09:00' }, { d: '2026-10-20', s: '09:00', e: '10:00' }], pay: { '2026-09': { b: 1 } }, demo: false };
  assert.equal((await req('PUT', '/api/kv/state', u.cookie, { value: JSON.stringify(state), version: null })).statusCode, 200);
  const r = (await req('GET', '/api/sync', u.cookie)).json();
  assert.equal(r.full, true); assert.ok(r.rev > 0);
  const by = (c: string, id: string) => r.changes.find((x: { c: string; id: string }) => x.c === c && x.id === id)?.v;
  assert.equal(by('cfg', 'standardThema'), 'Alt'); assert.deepEqual(by('day', '2026-10-20'), { t: 'arbeit', s: '08:00' });
  assert.deepEqual(by('pay', '2026-09'), { b: 1 }); assert.equal(by('act', 'a1').e, '09:00');
  assert.equal(r.changes.filter((x: { c: string }) => x.c === 'act').length, 2, 'Tätigkeit ohne id bekommt eine');
  assert.equal((await req('PUT', '/api/kv/state', u.cookie, { value: '{}', version: 1 })).statusCode, 409, 'alter Tab schreibt nicht mehr');
  assert.equal(JSON.parse((await req('GET', '/api/kv/state', u.cookie)).json().value).cfg.standardThema, 'Alt', 'alter Tab liest den aktuellen Stand');
  assert.equal((await req('GET', '/api/sync', u.cookie)).json().rev, r.rev, 'nur einmal übernommen');
});

test('Sync: Änderungen, Löschen, seit-Abfrage, Mandantentrennung, Prüfung', { skip }, async () => {
  const a = await register('sync-a@example.org'), b = await register('sync-b@example.org');
  assert.deepEqual((await req('GET', '/api/sync', a.cookie)).json(), { rev: 0, full: true, changes: [] });
  const p1 = await req('POST', '/api/sync', a.cookie, { changes: [{ c: 'day', id: '2026-10-21', v: { t: 'arbeit' } }, { c: 'cfg', id: 'soll', v: 8 }] });
  assert.equal(p1.statusCode, 200, p1.body);
  const r1 = (await req('GET', '/api/sync?since=0', a.cookie)).json();
  assert.equal(r1.changes.length, 2);
  const p2 = await req('POST', '/api/sync', a.cookie, { changes: [{ c: 'day', id: '2026-10-21', v: null }, { c: 'cfg', id: 'soll', v: 7 }] });
  const r2 = (await req('GET', `/api/sync?since=${r1.rev}`, a.cookie)).json();
  assert.equal(r2.full, false); assert.equal(r2.rev, p2.json().rev);
  assert.deepEqual(r2.changes.map((x: { c: string; id: string; v: unknown }) => [x.c, x.id, x.v]).sort(), [['cfg', 'soll', 7], ['day', '2026-10-21', null]], 'Grabstein wird gemeldet');
  assert.deepEqual((await req('GET', '/api/sync?since=0', a.cookie)).json().changes.map((x: { id: string }) => x.id), ['soll'], 'kompletter Stand ohne Gelöschtes');
  assert.equal((await req('GET', `/api/sync?since=${r2.rev}`, a.cookie)).json().changes.length, 0);
  assert.equal((await req('GET', '/api/sync?since=999999999', a.cookie)).json().full, true, 'unbekannter Stand: alles neu');
  assert.equal((await req('GET', '/api/sync', b.cookie)).json().changes.length, 0, 'B sieht nichts von A');
  assert.equal((await req('POST', '/api/sync', a.cookie, { changes: [{ c: 'kv', id: 'x', v: 1 }] })).statusCode, 400);
  assert.equal((await req('POST', '/api/sync', a.cookie, { changes: [{ c: 'day', id: '../x', v: 1 }] })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/sync' })).statusCode, 401);
  const adm = await register('sync-admin@example.org', 'admin');
  assert.equal((await req('GET', '/api/sync', adm.cookie)).statusCode, 403);
});

test('Sync: Live-Kanal meldet Änderungen anderer Geräte', { skip }, async () => {
  const u = await register('live@example.org');
  const addr = await app.listen({ port: 0, host: '127.0.0.1' });
  const ac = new AbortController();
  const res = await fetch(addr + '/api/sync/events', { headers: { cookie: u.cookie }, signal: ac.signal });
  assert.equal(res.status, 200); assert.match(String(res.headers.get('content-type')), /text\/event-stream/);
  const reader = res.body!.getReader(); let buf = '';
  const next = async () => { while (!buf.includes('data:')) { const { value } = await reader.read(); buf += new TextDecoder().decode(value); } };
  const p = await req('POST', '/api/sync', u.cookie, { changes: [{ c: 'cfg', id: 'soll', v: 6 }] });
  await Promise.race([next(), new Promise((_, rej) => setTimeout(() => rej(new Error('kein Ereignis')), 5000))]);
  assert.equal(JSON.parse(buf.split('data:')[1]).rev, p.json().rev);
  ac.abort();
});

test('Sync: Herunterfahren wartet nicht auf offene Live-Verbindungen', { skip }, async () => {
  const u = await register('shutdown@example.org');
  const app2 = await buildApp(cfg, db, { logger: false, mailer: null });
  const addr = await app2.listen({ port: 0, host: '127.0.0.1' });
  const res = await fetch(addr + '/api/sync/events', { headers: { cookie: u.cookie } });
  assert.equal(res.status, 200);
  const t0 = Date.now();
  await Promise.race([app2.close(), new Promise((_, rej) => setTimeout(() => rej(new Error('close hängt')), 5000))]);
  assert.ok(Date.now() - t0 < 3000, 'schnell beendet');
  await res.body?.cancel().catch(() => {});
});
