"""Ende-zu-Ende-Test Verwaltung und Konto-Seite (Playwright).
Admin-Konto per CLI einladen und einrichten, Nutzer über die Verwaltung einladen, sperren, zweiten Faktor
zurücksetzen; als Nutzer Konto-Seite: Geräte, neue Recovery-Codes, Export, Konto löschen.
Voraussetzung: npm install, TARGET=online python3 build.py
Aufruf: TEST_DATABASE_URL=postgres://... python3 tests/online_admin.py"""
import asyncio, email.header, json, re, secrets, sys
from playwright.async_api import async_playwright
from online_lib import MAILS, ORIGIN, mail_link, totp, check, RESULT, start_server, cli, page_errors, real_errors

PW = 'ein-langes-passwort'
subject = lambda m: str(email.header.make_header(email.header.decode_header(m['Subject'])))

async def register(pg, link, addr):
    """Einladungslink öffnen, Konto anlegen, TOTP einrichten. Gibt (secret, recovery_codes) zurück."""
    await pg.goto(link); await pg.wait_for_selector('#fRegister:not([hidden])')
    await pg.fill('#rEmail', addr); await pg.fill('#rPw', PW); await pg.fill('#rPw2', PW)
    await pg.click('#fRegister button'); await pg.wait_for_selector('#fSetup:not([hidden])')
    secret = (await pg.inner_text('#sSecret')).replace(' ', '')
    await pg.fill('#sCode', totp(secret)); await pg.click('#fSetup button'); await pg.wait_for_selector('#recovery:not([hidden])')
    codes = await pg.eval_on_selector_all('#codes span', 'els => els.map(e => e.textContent)')
    await pg.click('#toApp')
    return secret, codes

async def main():
    server = start_server()
    try:
        admin_addr, user_addr = f'admin-{secrets.token_hex(3)}@example.org', f'nutzer-{secrets.token_hex(3)}@example.org'
        out = cli('admin', admin_addr)
        check('CLI: Einladung für Admin-Konto', 'ADMIN-Konto' in out)

        async with async_playwright() as p:
            b = await p.chromium.launch()
            errs = []
            # Admin einrichten: landet direkt in der Verwaltung
            da = await b.new_context(); a = await da.new_page(); page_errors(a, errs)
            a.on('dialog', lambda d: asyncio.ensure_future(d.accept()))   # Rückfragen (confirm) bestätigen
            await register(a, mail_link(admin_addr, 'invite'), admin_addr)
            await a.wait_for_selector('#panel:not([hidden])')
            check('Admin landet in der Verwaltung', a.url.endswith('/admin'))
            check('Freigabe-Countdown sichtbar', 'freigeschaltet noch' in await a.inner_text('#until'))

            # Nutzer über die Oberfläche einladen
            await a.fill('#iEmail', user_addr); await a.click('#fInvite button')
            await a.wait_for_function("()=>document.querySelector('#inviteMsg').textContent.includes('verschickt')")
            check('Einladung über die Verwaltung per Mail', mail_link(user_addr, 'invite') is not None)
            try:
                await a.wait_for_function(f"()=>[...document.querySelectorAll('#invites tr')].some(r=>r.textContent.includes('{user_addr}')&&r.textContent.includes('offen'))", timeout=10000)
                invite_open = True
            except Exception:
                invite_open = False
            check('Einladung erscheint als offen', invite_open)

            # Nutzer registriert sich, arbeitet in der App, nutzt die Konto-Seite
            du = await b.new_context(accept_downloads=True); u = await du.new_page(); page_errors(u, errs)
            u.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            secret, codes = await register(u, mail_link(user_addr, 'invite'), user_addr)
            await u.wait_for_selector('[data-pf]'); await u.click('[data-pf=voll]'); await u.wait_for_selector('#tabs .tab')
            check('Nutzer sieht den Knopf Konto', await u.locator('#tbKonto').count() == 1)
            await u.evaluate("()=>{S.demo=false;S.cfg.standardThema='Admin-E2E';save()}")
            await u.wait_for_function("()=>document.querySelector('#tbSync')?.dataset.state==='ok'")
            await u.goto(ORIGIN + '/admin'); await u.wait_for_selector('#tabs .tab')
            check('Nutzer kommt nicht in die Verwaltung', u.url == ORIGIN + '/')

            await u.goto(ORIGIN + '/konto'); await u.wait_for_selector('.dev')
            check('Konto-Seite zeigt E-Mail und dieses Gerät', await u.inner_text('#email') == user_addr and 'dieses Gerät' in await u.inner_text('#devices'))
            async with u.expect_download() as dl:
                await u.click('a[href="/api/account/export"]')
            data = json.loads(open(await (await dl.value).path()).read())
            check('Export enthält die Stundendaten', data['app'] == 'stundenkonto' and data['cfg']['standardThema'] == 'Admin-E2E')
            await u.fill('#cCode', totp(secret, 1)); await u.click('#fCodes button'); await u.wait_for_selector('#newCodes:not([hidden])')
            new_codes = await u.eval_on_selector_all('#codes span', 'els => els.map(e => e.textContent)')
            check('Neue Recovery-Codes erzeugt', len(new_codes) == 10 and new_codes[0] not in codes)

            # E-Mail-Adresse ändern: Link an die neue Adresse, Bestätigung im selben (angemeldeten) Browser
            new_addr = 'neu-' + user_addr
            await u.fill('#mNew', new_addr); await u.fill('#mPw', PW); await u.fill('#mCode', new_codes[0]); await u.click('#fMail button')
            await u.wait_for_function("()=>document.querySelector('#mailMsg').textContent.includes('unterwegs')")
            link = await asyncio.to_thread(lambda: next((re.search(re.escape(ORIGIN) + r'/email-bestaetigen#email=[\w-]+', str(p.get_payload(decode=True), 'utf-8')).group(0)
                    for _ in range(50) for m in MAILS if new_addr in m['To'] for p in m.walk() if p.get_content_type() == 'text/plain'), None))
            check('Bestätigungslink an die neue Adresse', link is not None)
            # Öffnen allein ändert nichts (Link-Scanner in Firmen-Mailfiltern), erst der Knopf
            await u.goto(link); await u.wait_for_selector('#emailConfirm:not([hidden])')
            me = await u.evaluate("()=>fetch('/api/me',{credentials:'same-origin'}).then(r=>r.json())")
            check('Link öffnen allein übernimmt die Adresse nicht', me.get('email') == user_addr)
            await u.click('#emailConfirm'); await u.wait_for_function("()=>document.querySelector('#emailMsg').textContent.includes('Erledigt')")
            check('Hinweis an die alte Adresse', any(user_addr == m['To'] and 'geändert' in subject(m) for m in MAILS))
            await u.click('#emailNext'); await u.wait_for_selector('#tabs .tab')
            await u.goto(ORIGIN + '/konto'); await u.wait_for_selector('.dev')
            check('Konto-Seite zeigt die neue Adresse', await u.inner_text('#email') == new_addr)
            user_addr = new_addr

            # Verwaltung: Nutzer sperren -> Nutzer fliegt raus; entsperren; zweiten Faktor zurücksetzen
            await a.reload(); await a.wait_for_selector('#panel:not([hidden])')
            row = a.locator('#users tr', has_text=user_addr)
            await row.locator('button[data-act=lock]').click()
            await a.wait_for_function(f"()=>[...document.querySelectorAll('#users tr')].some(r=>r.textContent.includes('{user_addr}')&&r.textContent.includes('gesperrt'))")
            await u.goto(ORIGIN + '/konto'); await u.wait_for_selector('#fLogin:not([hidden])')
            check('Gesperrter Nutzer ist abgemeldet', u.url.endswith('/login'))
            await u.fill('#lEmail', user_addr); await u.fill('#lPw', PW); await u.click('#fLogin button')
            await u.wait_for_function("()=>document.querySelector('#err').textContent.includes('gesperrt')")
            check('Gesperrt: Anmeldung abgewiesen', True)
            await a.locator('#users tr', has_text=user_addr).locator('button[data-act=unlock]').click()
            await a.wait_for_function(f"()=>[...document.querySelectorAll('#users tr')].some(r=>r.textContent.includes('{user_addr}')&&r.textContent.includes('aktiv'))")
            await a.locator('#users tr', has_text=user_addr).locator('button[data-act="reset-mfa"]').click()
            await a.wait_for_function(f"()=>[...document.querySelectorAll('#users tr')].some(r=>r.textContent.includes('{user_addr}')&&r.textContent.includes('Einrichtung offen'))")
            check('Zweiter Faktor zurückgesetzt, Mail an den Nutzer', any(user_addr in m['To'] and 'zurückgesetzt' in subject(m) for m in MAILS))
            # Protokoll lädt nach der Aktion asynchron nach: darauf warten statt sofort lesen
            try:
                await a.wait_for_function("()=>['Nutzer gesperrt','Zweiter Faktor zurückgesetzt'].every(x=>document.querySelector('#audit').textContent.includes(x))", timeout=10000)
                audit_ok = True
            except Exception:
                audit_ok = False
            check('Protokoll zeigt die Aktionen', audit_ok)

            # Nutzer richtet neu ein und löscht dann sein Konto
            await u.click('#fLogin button'); await u.wait_for_selector('#fSetup:not([hidden])')
            secret2 = (await u.inner_text('#sSecret')).replace(' ', '')
            check('Nach Reset: neue Einrichtung beim Login', secret2 != secret)
            await u.fill('#sCode', totp(secret2)); await u.click('#fSetup button'); await u.wait_for_selector('#recovery:not([hidden])')
            codes2 = await u.eval_on_selector_all('#codes span', 'els => els.map(e => e.textContent)')
            await u.goto(ORIGIN + '/konto'); await u.wait_for_selector('.dev')
            await u.fill('#dPw', PW); await u.fill('#dCode', codes2[0]); await u.fill('#dConfirm', 'LÖSCHEN'); await u.click('#fDel button')
            await u.wait_for_selector('text=Konto gelöscht')
            check('Konto gelöscht', True)
            await a.reload(); await a.wait_for_selector('#panel:not([hidden])')
            check('Gelöschter Nutzer verschwindet aus der Liste', user_addr not in await a.inner_text('#users'))

            errs = real_errors(errs)
            check('Keine Skript- oder CSP-Fehler', not errs)
            for e in errs: print('  ', e[:300])
            await b.close()
    finally:
        server.terminate()
    sys.exit(0 if RESULT['ok'] else 1)

asyncio.run(main())
