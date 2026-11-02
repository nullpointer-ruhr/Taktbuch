// Verwaltung über die Kommandozeile, im Cluster z. B.:
//   kubectl -n taktbuch-staging exec deploy/taktbuch-app -- node packages/api/src/cli.ts invite mella@example.org
//   kubectl -n taktbuch-staging exec deploy/taktbuch-app -- node packages/api/src/cli.ts admin taktbuch@pm.me
//   kubectl -n taktbuch-staging exec deploy/taktbuch-app -- node packages/api/src/cli.ts change-email alt@example.org neu@example.org
import { createPool, migrate } from './db.ts';
import { createInvite } from './auth.ts';
import { createMailer, emailChangedMail } from './mail.ts';
import { changeEmailDirect } from './account.ts';
import { loadConfig } from './config.ts';

const [cmd, ...args] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL fehlt'); process.exit(2); }
const db = createPool(url);

try {
  if (cmd === 'migrate') {
    const done = await migrate(db, m => console.log(m));
    if (!done.length) console.log('Schema ist aktuell.');
  } else if (cmd === 'invite' || cmd === 'admin') {
    const origin = process.env.PUBLIC_ORIGIN;
    if (!origin) throw new Error('PUBLIC_ORIGIN fehlt');
    const email = args.find(a => !a.startsWith('--')) ?? null;
    const days = Number(args.find(a => a.startsWith('--days='))?.slice(7) ?? 7);
    const mailer = createMailer(loadConfig({ ...process.env, TOTP_KEY: process.env.TOTP_KEY || Buffer.alloc(32).toString('base64') }));
    const kind = cmd === 'admin' ? 'admin' : 'user';
    if (kind === 'admin' && !email) throw new Error('Für ein Admin-Konto bitte eine E-Mail-Adresse angeben.');
    const { link, mailed, mailError } = await createInvite(db, { publicOrigin: origin.replace(/\/$/, '') }, email, days, mailer, { kind });
    console.log(`${kind === 'admin' ? 'Einladung für ein ADMIN-Konto' : 'Einladung'}${email ? ' für ' + email : ''}, gültig ${days} Tage, einmal verwendbar.`);
    if (mailError) console.log(`Mailversand fehlgeschlagen: ${mailError}`);
    console.log(mailed ? 'Mail ist verschickt. Link zur Sicherheit:' : mailError ? 'Link selbst weitergeben:' : (mailer ? 'Ohne E-Mail-Adresse keine Mail. Link:' : 'Kein Mailversand eingerichtet (SMTP_URL). Link selbst weitergeben:'));
    console.log(link);
  } else if (cmd === 'change-email') {
    const [from, to] = args.filter(a => !a.startsWith('--'));
    if (!from || !to) throw new Error('Aufruf: change-email <alte Adresse> <neue Adresse>');
    const r = await changeEmailDirect(db, from, to);
    console.log(`Konto läuft jetzt über ${r.newEmail} (vorher ${r.oldEmail}). Anmeldung ab sofort mit der neuen Adresse.`);
    const mailer = createMailer(loadConfig({ ...process.env, TOTP_KEY: process.env.TOTP_KEY || Buffer.alloc(32).toString('base64') }));
    if (mailer && !args.includes('--no-mail')) {
      await mailer.send(emailChangedMail(r.oldEmail, r.newEmail))
        .then(() => console.log(`Hinweis an ${r.oldEmail} verschickt.`))
        .catch(e => console.log(`Hinweis an die alte Adresse nicht verschickt: ${(e as Error).message}`));
    }
  } else {
    console.log('Befehle:\n  migrate\n  invite [email] [--days=7]   Einladung für ein Nutzerkonto\n  admin <email> [--days=7]    Einladung für ein Admin-Konto (Verwaltung, keine Stundendaten)\n  change-email <alt> <neu> [--no-mail]   Adresse direkt ändern, ohne Bestätigungslink');
    process.exitCode = cmd ? 2 : 0;
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await db.end();
}
