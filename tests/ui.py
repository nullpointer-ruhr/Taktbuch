"""UI-Smoketest (Playwright): Profilwahl, Erkennung vorhandener Daten, Update-Banner.
Aufruf: python3 tests/ui.py dist/taktbuch.html"""
import asyncio, json, sys, pathlib
from playwright.async_api import async_playwright
url = 'file://' + str(pathlib.Path(sys.argv[1]).resolve())
TD = '2026-10-20'   # fester Dienstag (kein Feiertag): Tests zum geteilten Tag dürfen nicht vom heutigen Wochentag abhängen
REL = {'tag_name': 'v9.9.9', 'html_url': 'https://github.com/x/y/releases/tag/v9.9.9', 'body': 'Test-Hinweise',
       'assets': [{'name': 'taktbuch.html', 'browser_download_url': 'https://github.com/x/y/releases/download/v9.9.9/taktbuch.html'}]}
async def go(pg, sub):
    await pg.click('button[data-v=einst]'); await pg.click(f'button[data-a=sub][data-v={sub}]'); await pg.wait_for_timeout(150)
async def main():
    ok = True
    def check(name, cond):
        nonlocal ok; print(('OK   ' if cond else 'FAIL ') + name); ok &= bool(cond)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # 1) frischer Start: Profilwahl, dann Beispieldaten
        ctx = await b.new_context(); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(REL)))
        await pg.goto(url); await pg.wait_for_selector('[data-pf]')
        check('Profilwahl erscheint', await pg.locator('[data-pf]').count() == 2)
        await pg.click('[data-pf=einfach]'); await pg.wait_for_selector('#tabs .tab')
        check('Profil einfach: kein Verfall', await pg.evaluate("()=>S.cfg.urlaubVerfall===''&&S.cfg.mirAn===false"))
        await pg.wait_for_selector('#updbanner .banner', timeout=8000)
        bt = await pg.inner_text('#updbanner'); check('Update-Banner bei neuerer Version', 'Neue Version 9.9.9' in bt or 'New version 9.9.9' in bt)
        check('Download-Link zeigt auf Asset', (await pg.get_attribute('#updDl', 'href')).endswith('taktbuch.html'))
        await pg.click('#updSkip'); check('Später blendet aus', await pg.inner_text('#updbanner') == '')
        await pg.click('button[data-v=einst]'); await pg.click('button[data-a=sub][data-v=daten]'); await pg.click('[data-a=chkUpd]'); await pg.wait_for_function("()=>document.querySelector('#updState').textContent.includes('9.9.9')")
        check('manuelle Prüfung meldet Version', True)
        await pg.evaluate("()=>{S.cfg.standardThema='Testthema';save()}"); await pg.wait_for_timeout(900)
        # 2) Neuladen im selben Kontext: Profil wird erkannt, keine Wahl
        await pg.reload(); await pg.wait_for_selector('#tabs .tab')
        check('zweiter Start ohne Wahl, Daten da', await pg.evaluate("()=>PROFILE==='einfach'&&S.cfg.standardThema==='Testthema'"))
        check('keine JS-Fehler', not errs)
        # 3) Update-Prüfung offline: kein Fehler, kein Banner
        ctx2 = await b.new_context(); pg2 = await ctx2.new_page(); e2 = []
        pg2.on('pageerror', lambda e: e2.append(str(e)))
        await ctx2.route('https://api.github.com/**', lambda r: r.abort())
        await pg2.goto(url); await pg2.click('[data-pf=voll]'); await pg2.wait_for_selector('#tabs .tab'); await pg2.wait_for_timeout(2500)
        check('offline: kein Banner, keine Fehler', await pg2.inner_text('#updbanner') == '' and not e2)
        check('Profil voll hat Verfall', await pg2.evaluate("()=>DEFAULT_CFG.urlaubVerfall==='05-01'"))

        # 4) Englisch: Umschalten, Namen, keine deutschen Reste in allen Ansichten
        pg3 = await (await b.new_context()).new_page()
        await pg3.goto(url); await pg3.click('[data-pf=voll]'); await pg3.wait_for_selector('#tabs .tab')
        await pg3.click('[data-a=lang][data-v=en]'); await pg3.wait_for_timeout(300)
        check('Tabs englisch', await pg3.inner_text('#tabs') == 'Today\nWeek\nMonth\nCalendar\nActivities\nReports\nSalary\nSettings')
        STOP = set('der die das und oder für mit von zu im am ist nicht wird werden ein eine einen dem den des auf bei als auch nur wenn dann nach vor über unter alle noch schon bis aus wie sich sind kann keine kein dein deine deiner deinen du ab pro je ohne sowie'.split())
        left = []
        for t in ['heute', 'woche', 'monat', 'urlaub', 'taet', 'auswertung', 'gehalt', 'zeit', 'regeln', 'gehalt2', 'erfassung', 'allg', 'daten']:
            if t in ('zeit', 'regeln', 'gehalt2', 'erfassung', 'allg', 'daten'): await go(pg3, 'gehalt' if t == 'gehalt2' else t)
            else: await pg3.click(f'button[data-v={t}]')
            await pg3.wait_for_timeout(200)
            txt = await pg3.evaluate("()=>{const o=[];const w=document.createTreeWalker(document.getElementById('view'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const v=n.nodeValue.trim();if(v)o.push(v)}document.querySelectorAll('#view [placeholder],#view [aria-label],#view [title]').forEach(e=>['placeholder','aria-label','title'].forEach(a=>{const v=e.getAttribute(a);if(v)o.push(v)}));return o}")
            import re
            for v in txt:
                ws = re.findall(r'[A-Za-zÄÖÜäöüß]+', v)
                if re.search(r'[äöüÄÖÜß]', v) or any(w.lower() in STOP for w in ws):
                    if 'Baden-W' in v or 'ab 20' in v or 'Zeiterfassung' in v or 'Stunden.xlsm' in v: continue   # Blattnamen der Excel
                    left.append(v[:80])
        check('keine deutschen Texte im englischen UI ' + (str(left[:5]) if left else ''), not left)
        await pg3.click('[data-a=lang][data-v=de]'); await pg3.wait_for_timeout(200)
        check('zurück auf Deutsch', await pg3.inner_text('#tabs') == 'Heute\nWoche\nMonat\nKalender\nTätigkeiten\nAuswertung\nGehalt\nEinstellungen')
        # Zeitraster und Spaltennamen
        await pg3.click('button[data-v=heute]')
        await pg3.evaluate("()=>{S.cfg.raster='15';S.cfg.spalten={cat:'Projekt'};commit()}"); await pg3.wait_for_timeout(200)
        r = await pg3.evaluate("()=>[snap('09:07'),snap('09:08'),snap('09:22'),snap('09:23'),snap('23:58'),snap('00:03')]")
        check('Raster rundet auf/ab', r == ['09:00', '09:15', '09:15', '09:30', '23:45', '00:00'])
        await pg3.fill('#f_s', ''); await pg3.focus('#f_s'); await pg3.keyboard.type('10')
        check('Tippen 10 bleibt 10 (keine Auto-Ergänzung beim Tippen)', await pg3.input_value('#f_s') == '10')
        await pg3.keyboard.press('Tab'); check('Verlassen: 10 wird 10:00', await pg3.input_value('#f_s') == '10:00')
        await pg3.fill('#f_s', '08:07'); await pg3.dispatch_event('#f_s', 'change')
        check('Eingetippte Zeit bleibt minutengenau (Stempeluhr)', await pg3.input_value('#f_s') == '08:07')
        await pg3.fill('#f_s', '930'); await pg3.dispatch_event('#f_s', 'change')
        check('Kurzform 930 wird 09:30', await pg3.input_value('#f_s') == '09:30')
        check('Textfeld mit Auswahlliste (96 Viertelstunden)', await pg3.get_attribute('#f_s', 'list') == 'dl-t15' and await pg3.evaluate("()=>document.querySelectorAll('#dl-t15 option').length") == 96)
        await pg3.fill('#f_u', '30'); await pg3.dispatch_event('#f_u', 'change')
        check('Unterbrechung 30 wird 00:30 (Liste dl-d15)', await pg3.input_value('#f_u') == '00:30' and await pg3.get_attribute('#f_u', 'list') == 'dl-d15')
        await pg3.fill('#d_p', '40'); await pg3.dispatch_event('#d_p', 'change')
        check('Pause 40 bleibt 00:40', await pg3.input_value('#d_p') == '00:40')
        await pg3.evaluate("()=>{const k=todayKey();setDay(k,{t:'Dienstreise'})}"); await pg3.wait_for_timeout(200)
        check('Dienstreise: Chip sichtbar, rechnet als Arbeitstag', await pg3.evaluate("()=>{const r=R.map[todayKey()];return r.t==='Dienstreise'&&isWorkType(r.t)}") and 'dienstreise' in (await pg3.inner_text('#view')).lower())
        await pg3.evaluate("()=>{setDay(todayKey(),{t:'arbeit'})}")
        check('Spalte umbenannt', 'projekt' in (await pg3.inner_text('#view')).lower())
        await pg3.evaluate("()=>{S.cfg.raster='min';S.cfg.spalten={};commit()}"); await pg3.wait_for_timeout(200)
        # Browser-Zeitfeld: Tippen über alle Segmente, ohne dass zwischendurch neu gezeichnet wird
        await pg3.evaluate("()=>setDay(todayKey(),{s:'07:00'})"); await pg3.wait_for_timeout(200)
        await pg3.click('#d_s'); await pg3.keyboard.press('Home'); await pg3.keyboard.type('0845')
        check('Zeitfeld: während der Eingabe nicht gespeichert', await pg3.evaluate("()=>(S.days[todayKey()]||{}).s") == '07:00')
        await pg3.keyboard.press('Enter'); await pg3.wait_for_timeout(200)
        check('Zeitfeld: 08:45 komplett übernommen', await pg3.evaluate("()=>(S.days[todayKey()]||{}).s") == '08:45')
        # direkt ins nächste Feld wechseln (wie Tab, aber unabhängig vom AM/PM-Segment der Browsersprache)
        await pg3.evaluate("()=>setDay(todayKey(),{s:'06:00',e:'15:00'})"); await pg3.wait_for_timeout(200)
        await pg3.click('#d_s'); await pg3.keyboard.press('Home'); await pg3.keyboard.type('0730'); await pg3.focus('#d_e'); await pg3.wait_for_timeout(100); await pg3.keyboard.press('Home'); await pg3.keyboard.type('1615')
        check('Zeitfeld: Fokus bleibt nach dem Speichern im nächsten Feld', await pg3.evaluate("()=>document.activeElement.id") == 'd_e')
        await pg3.keyboard.press('Enter'); await pg3.wait_for_timeout(200)
        check('Zeitfeld: Kommen und Gehen in einem Rutsch', await pg3.evaluate("()=>{const d=S.days[todayKey()]||{};return d.s+'-'+d.e}") == '07:30-16:15')
        await pg3.evaluate("()=>setDay(todayKey(),{s:'',e:''})")
        await go(pg3, 'allg')
        await pg3.select_option('#c_rg', 'SN'); await pg3.wait_for_timeout(300)
        check('Bundesland Sachsen: Buß- und Bettag', await pg3.evaluate("()=>E.holidayName('2026-11-18')==='Buß- und Bettag'&&S.cfg.region==='SN'"))
        await pg3.select_option('#c_rg', 'NW')
        await go(pg3, 'regeln')
        await pg3.click('[data-a=rgAdd]'); await pg3.wait_for_timeout(200)
        await pg3.select_option('#r1_kappungAn', 'false'); await pg3.fill('#r1_urlaubJahr', '28'); await pg3.dispatch_event('#r1_urlaubJahr', 'change')
        check('Regeländerung ab Datum angelegt', await pg3.evaluate("()=>S.cfg.regeln.length===1&&S.cfg.regeln[0].kappungAn===false&&S.cfg.regeln[0].urlaubJahr===28&&S.cfg.urlaubJahr!==28"))
        await go(pg3, 'gehalt')
        check('Zahltag: Reihenfolge und 4 Optionen', await pg3.evaluate("()=>[...document.querySelectorAll('#c_zf option')].map(o=>o.value).join()") == 'erster,letzter,tag15,letzte4')
        await go(pg3, 'erfassung')
        ys = await pg3.evaluate("()=>[...document.querySelectorAll('#c_col_cat,#c_col_w,#c_col_sys,#c_col_pn,#c_col_th')].map(e=>Math.round(e.getBoundingClientRect().top))")
        check('Spaltennamen in einer Reihe', len(set(ys)) == 1)
        await pg3.select_option('#c_oa', 'true'); await pg3.select_option('#c_aa', 'true'); await pg3.wait_for_timeout(200)
        await pg3.click('[data-f="cfg:hoWd:3"]'); await pg3.wait_for_timeout(200)
        check('Ort/Auszahlung eingeschaltet, Mittwoch Homeoffice', await pg3.evaluate("()=>S.cfg.ortAn&&S.cfg.auszahlAn&&S.cfg.hoWochentage.join()==='3'"))
        await pg3.click('button[data-v=heute]'); await pg3.evaluate("()=>{go(TD);S.days[TD]={s:'08:00',e:'17:00',p:'01:00'};commit()}".replace('TD', repr(TD))); await pg3.click('[data-a=setOrt][data-v=mix]'); await pg3.wait_for_selector('#d_hoAb')
        await pg3.fill('#d_hoAb', '14:00'); await pg3.dispatch_event('#d_hoAb', 'change'); await pg3.fill('#d_az', '1'); await pg3.dispatch_event('#d_az', 'change'); await pg3.wait_for_timeout(200)
        check('geteilter Tag: 3 h Homeoffice, Auszahlung 1 h', await pg3.evaluate("()=>{const r=R.map[TD];return r.ort==='mix'&&r.hoH===3&&r.az===1&&S.days[TD].hoAb==='14:00'}".replace('TD', repr(TD))))
        await pg3.click('[data-a=setOrtFolge][data-v=ho]'); await pg3.wait_for_timeout(200)
        check('geteilt: zuerst Homeoffice bis 14:00 = 6 h', await pg3.evaluate("()=>{const r=R.map[TD];return r.hoH===6&&S.days[TD].hoZ==='ho'}".replace('TD', repr(TD))))
        await pg3.evaluate("()=>{go(todayKey())}")   # zurück auf heute für die folgenden Tests
        await pg3.evaluate("()=>{S.acts.push({id:'zz1',d:'2020-01-02',s:'08:00',e:'09:00',u:'',cat:'KatX',w:'ArtX',sys:'SysX',pn:'',th:'ThemaX'});commit()}")
        await pg3.fill('#f_th', 'ThemaX'); await pg3.dispatch_event('#f_th', 'change')
        check('Thema füllt Kategorie, Art, System rückwärts', await pg3.input_value('#f_cat') == 'KatX' and await pg3.input_value('#f_w') == 'ArtX' and await pg3.input_value('#f_sys') == 'SysX')
        await pg3.fill('#f_s', '07:00'); await pg3.dispatch_event('#f_s', 'change'); await pg3.fill('#f_e', '07:30'); await pg3.dispatch_event('#f_e', 'change'); await pg3.click('[data-a=addAct]'); await pg3.wait_for_timeout(200)
        check('nach Hinzufügen bleiben Kategorie/Art/System leer', await pg3.input_value('#f_cat') == '' and await pg3.input_value('#f_w') == '' and await pg3.input_value('#f_sys') == '' and await pg3.input_value('#f_th') == '')
        await pg3.evaluate("()=>{S.acts=S.acts.filter(a=>a.id!=='zz1'&&a.d!==todayKey());commit()}")
        await pg3.click('button[data-v=auswertung]'); await pg3.wait_for_timeout(300)
        check('Auswertung zeigt Arbeitsort-Tabelle', 'office' in (await pg3.inner_text('#view')).lower() or 'büro' in (await pg3.inner_text('#view')).lower())
        await pg3.evaluate("()=>{delete S.days[todayKey()];S.cfg.ortAn=false;S.cfg.auszahlAn=false;S.cfg.hoWochentage=[];commit()}")
        await go(pg3, 'daten')
        check('Melden-Knopf vorhanden', await pg3.locator('[data-a=report]').count() == 1)
        check('Automatische Sicherung sichtbar', 'utomati' in (await pg3.inner_text('#view')))
        await go(pg3, 'regeln')
        await pg3.select_option('#r1_pauseModus', 'fest'); await pg3.wait_for_timeout(200)
        check('Pause fest: Zusatzfelder erscheinen', await pg3.locator('#r1_pauseFest').count() == 1)
        await pg3.click('[data-a=rgDel]'); await pg3.wait_for_timeout(200)
        check('Regeländerung entfernt', await pg3.evaluate("()=>S.cfg.regeln.length===0"))
        await pg3.click('[data-a=wizOpen]'); await pg3.wait_for_selector('#w_ab')
        await pg3.fill('#w_ab', '2026-07-17'); await pg3.dispatch_event('#w_ab', 'change'); await pg3.wait_for_timeout(200)
        check('Wizard: Rest bis Jahresende vorbelegt', await pg3.evaluate("()=>UI.wiz.rest===Math.ceil(UI.wiz.urlaubJahr*5/12*2)/2"))
        await pg3.click('[data-a=wizApply]'); await pg3.wait_for_timeout(300)
        check('Wizard: Jobwechsel als Regel mit Wechselwerten', await pg3.evaluate("()=>S.cfg.regeln.some(r=>r.wechsel&&r.ab==='2026-07-17')&&S.cfg.sollVerlauf.some(x=>x.ab==='2026-07-17')"))
        await pg3.evaluate("()=>{S.cfg.regeln=S.cfg.regeln.filter(r=>!r.wechsel);S.cfg.sollVerlauf=S.cfg.sollVerlauf.filter(x=>x.ab!=='2026-07-17');commit()}")
        await pg3.click('button[data-v=heute]'); await pg3.evaluate("()=>{setDay(todayKey(),{t:'Dienstreise'})}"); await pg3.wait_for_selector('#d_kd')
        await pg3.fill('#d_kd', 'ACME'); await pg3.dispatch_event('#d_kd', 'change'); await pg3.fill('#d_ot', 'Ingelheim'); await pg3.dispatch_event('#d_ot', 'change'); await pg3.wait_for_timeout(200)
        check('Dienstreise: Kunde/Ort statt Arbeitsort', await pg3.evaluate("()=>{const r=R.map[todayKey()];return r.kd==='ACME'&&r.ot==='Ingelheim'}") and await pg3.locator('[data-a=setOrt]').count() == 0)
        await pg3.click('button[data-v=auswertung]'); await pg3.wait_for_timeout(300)
        check('Auswertung: Dienstreisen nach Kunde und Ort', 'ACME' in (await pg3.inner_text('#view')) and 'Ingelheim' in (await pg3.inner_text('#view')))
        await pg3.evaluate("()=>{setDay(todayKey(),{t:'arbeit',kd:'',ot:''})}")
        # Backup: falscher Ordner-Handle im Speicher, Rotation prüfen
        res = await pg3.evaluate("""async()=>{
          const files={}; for(let i=1;i<=5;i++) files['taktbuch-sicherung-'+PROFILE+'-2026-01-0'+i+'.json']='x'; files['andere.txt']='y';
          const h={name:'Test',queryPermission:async()=>'granted',requestPermission:async()=>'granted',
            getFileHandle:async(n)=>({createWritable:async()=>{let b='';return{write:async t=>{b=t},close:async()=>{files[n]=b}}},getFile:async()=>({size:new Blob([files[n]]).size})}),
            removeEntry:async n=>{delete files[n]}, entries:async function*(){for(const n of Object.keys(files)) yield [n,{}]}};
          BK.cfg={handle:h,interval:'daily',keep:3}; S.demo=false;
          const ok=await backupNow(true); return {ok,names:Object.keys(files).sort()};}""")
        check('Backup schreibt Datei und behält nur die letzten 3 (andere Dateien bleiben)', res['ok'] and len(res['names']) == 4 and 'andere.txt' in res['names'] and not any(n.endswith('01-01.json') for n in res['names']))
        await pg3.evaluate("()=>{BK.cfg={handle:null,interval:'daily',keep:10};localStorage.setItem('zeitwerk-bk-last-'+PROFILE,String(Date.now()-10*864e5));localStorage.removeItem('zeitwerk-bk-snooze-'+PROFILE);S.demo=false}")
        await pg3.evaluate("()=>autoBackup()"); await pg3.wait_for_timeout(200)
        check('Erinnerung bei alter Sicherung ohne Ordner', 'Sicherung' in (await pg3.inner_text('#bkbanner')) or 'backup' in (await pg3.inner_text('#bkbanner')).lower())
        await go(pg3, 'erfassung')
        await pg3.select_option('[data-f="colv:pn"]', 'true'); await pg3.select_option('[data-f="colv:sys"]', 'false')
        await pg3.click('button[data-v=taet]'); hd = (await pg3.inner_text('#view thead')).lower()
        check('Spalten ein-/ausblendbar', 'projektnummer' in hd and 'system' not in hd and 'kategorie' in hd)
        await pg3.evaluate("()=>{S.cfg.pnAn=false;S.cfg.spaltenAus={};commit()}")
        # Hilfe, Was ist neu, Wochensumme Halbtag, Hinweis Urlaub mit Zeiten
        await pg3.click('[data-a=lang][data-v=en]'); await pg3.click('#helpBtn'); await pg3.wait_for_timeout(200)
        ht = await pg3.inner_text('#view'); check('Hilfe englisch geöffnet', 'Taktbuch help' in ht and "What's new" in ht)
        await pg3.click('[data-a=helpBack]'); await pg3.click('[data-a=lang][data-v=de]'); await pg3.click('#helpBtn'); await pg3.wait_for_timeout(200)
        check('Hilfe deutsch', 'Hilfe zu Taktbuch' in await pg3.inner_text('#view'))
        await pg3.click('[data-a=helpBack]')
        await pg3.evaluate("()=>{localStorage.setItem('zeitwerk-seen-ver','1.10.0');showWhatsNew(true)}"); await pg3.wait_for_timeout(200)
        check('Was ist neu nach Update', 'Neu in Taktbuch' in await pg3.inner_text('#newbanner') and 'Kalender' in await pg3.inner_text('#newbanner'))
        await pg3.click('[data-a=whatsOk]'); check('Was ist neu: einmal, dann weg', await pg3.inner_text('#newbanner') == '' and await pg3.evaluate("()=>localStorage.getItem('zeitwerk-seen-ver')===VERSION"))
        await pg3.evaluate("()=>{showWhatsNew(true)}"); check('Kein erneutes Anzeigen', await pg3.inner_text('#newbanner') == '')
        wk = await pg3.evaluate("""()=>{ S.cfg.halbeTage=true; const k='2025-12-24'; setDay(k,{t:'',s:'',e:''}); recompute(); const a=[wkSoll(dayRow(k)),wkIst(dayRow(k))];
          setDay(k,{s:'08:00',e:'12:30'}); recompute(); const r=dayRow(k); return {a,b:[wkSoll(r),wkIst(r)],so:r.soll,za:r.za}; }""")
        check('Wochensumme 24.12. ohne Arbeit: Soll 0, Ist 0', wk['a'] == [0, 0])
        check('Wochensumme 24.12. mit 4,5 h: Soll halb, Ist zählt', wk['b'][1] == 4.5 and abs(wk['b'][0] - wk['so'] / 2) < 1e-9 and abs((wk['b'][1] - wk['b'][0]) - wk['za']) < 1e-9)
        await pg3.evaluate("()=>{setDay('2025-12-24',{s:'',e:''})}")
        await pg3.evaluate("()=>{setDay('2026-10-14',{t:'Urlaub',s:'08:00',e:'16:30'}); UI.date='2026-10-14'; UI.tab='heute'; render()}"); await pg3.wait_for_timeout(200)
        check('Urlaubstag mit Zeiten: Hinweis, Zeiten ignoriert', 'ignoriert' in await pg3.inner_text('#view') and await pg3.evaluate("()=>R.map['2026-10-14'].stunden===0&&R.map['2026-10-14'].za===0"))
        await pg3.evaluate("()=>{setDay('2026-10-14',{t:'arbeit',s:0,e:0})}")
        # Farbe und Darstellung
        acc = "()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase()"
        await go(pg3, 'allg')
        check('Farbauswahl: 8 Farben, Orange aktiv', await pg3.locator('[data-a=farbe]').count() == 8 and await pg3.get_attribute('[data-a=farbe][data-v=orange]', 'aria-pressed') == 'true')
        await pg3.click('[data-a=farbe][data-v=dunkelgruen]')
        check('Dunkelgrün hell', await pg3.evaluate(acc) == '#08513D' and await pg3.get_attribute('[data-a=farbe][data-v=dunkelgruen]', 'aria-pressed') == 'true')
        await pg3.select_option('[data-f="cfg:darstellung"]', 'dunkel')
        check('Dunkel: Theme und helle Akzentvariante', await pg3.evaluate("()=>document.documentElement.dataset.theme==='dark'") and await pg3.evaluate(acc) == '#2FD495')
        await pg3.wait_for_timeout(900); await pg3.reload(); await pg3.wait_for_selector('#tabs .tab')
        check('Farbe und Darstellung bleiben nach Neuladen', await pg3.evaluate(acc) == '#2FD495' and await pg3.evaluate("()=>S.cfg.farbe==='dunkelgruen'"))
        await pg3.evaluate("()=>{S.cfg.farbe='orange';S.cfg.darstellung='auto';commit()}")
        # Startdatum in dieser Woche oder in der Zukunft (neues Konto): Tag, Woche, Kalender gehen
        r = await pg3.evaluate("""()=>{ const out=[]; const t=todayKey(); for (const sd of [E.addDays(t,1), t, E.addDays(t,-1), E.addDays(t,40)]) {
            S.cfg.startDatum=sd; S.cfg.sollVerlauf=[{ab:sd,soll:7.8}]; UI.date=t; recompute();
            for (const tab of ['heute','woche','monat','urlaub','auswertung']) { try { UI.tab=tab; render(); } catch(e) { out.push(sd+' '+tab+': '+e); } } }
          return out; }""")
        check('Startdatum heute/morgen/in 40 Tagen: alle Ansichten öffnen ' + str(r[:2]), not r)
        await pg3.evaluate("()=>{S.cfg.startDatum=E.addDays(todayKey(),1);UI.date=todayKey();UI.tab='heute';render()}")
        check('Tag vor dem Startdatum: Hinweis', 'vor dem Startdatum' in await pg3.inner_text('#view') or 'before the start date' in (await pg3.inner_text('#view')).lower())
        await pg3.evaluate("()=>{S.cfg.startDatum='2020-01-01';S.cfg.sollVerlauf=[{ab:'2020-01-01',soll:7.5}];commit()}")
        # Stichtage als TT.MM.
        await go(pg3, 'regeln')
        inp = '[data-f="cfg:urlaubVerfall"]'
        check('Stichtag wird als TT.MM. angezeigt', await pg3.input_value(inp) in ('01.05.', ''))
        await pg3.fill(inp, '15.4'); await pg3.keyboard.press('Tab'); await pg3.wait_for_timeout(150)
        check('Eingabe 15.4 wird 04-15 gespeichert und als 15.04. gezeigt', await pg3.evaluate("()=>S.cfg.urlaubVerfall==='04-15'") and await pg3.input_value(inp) == '15.04.')
        await pg3.fill(inp, '31.02.'); await pg3.keyboard.press('Tab'); await pg3.wait_for_timeout(150)
        check('Ungültiges Datum abgewiesen', await pg3.evaluate("()=>S.cfg.urlaubVerfall==='04-15'"))
        await pg3.evaluate("()=>{S.cfg.kappungTag='31.10.';recompute()}")
        check('Alt gespeichertes 31.10. wird zu 10-31', await pg3.evaluate("()=>S.cfg.kappungTag==='10-31'"))
        await pg3.evaluate("()=>{S.cfg.urlaubVerfall='05-01';commit()}")
        check('Zurück auf Standard: keine Überschreibung', await pg3.evaluate("()=>!document.documentElement.style.getPropertyValue('--accent')&&!document.documentElement.dataset.theme"))
        await b.close()
    sys.exit(0 if ok else 1)
asyncio.run(main())
