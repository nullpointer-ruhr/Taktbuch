/* ---------- Ereignisse ---------- */
const go = k => { UI.date = k; UI.tab = 'heute'; render(); window.scrollTo(0, 0); };
const actions = {
  farbe: el => { S.cfg.farbe = el.dataset.v; commit(); },
  tab: el => { let v = el.dataset.v; if (v === 'daten') { v = 'einst'; UI.sub = 'daten'; } UI.tab = v; render(); window.scrollTo(0, 0); },
  sub: el => { UI.sub = el.dataset.v; render(); },
  day: el => { UI.date = E.addDays(UI.date, +el.dataset.n); UI.year = +UI.date.slice(0, 4); render(); },
  today: () => { UI.date = todayKey(); render(); },
  goto: el => go(el.dataset.k),
  setOrt: el => setDay(UI.date, { o: el.dataset.v }),
  setOrtFolge: el => setDay(UI.date, { hoZ: el.dataset.v === 'ho' ? 'ho' : '' }),
  applyRangeOrt: () => rangeOrt(false),
  clearRangeOrt: () => rangeOrt(true),
  setType: el => setDay(UI.date, { t: normType(UI.date, el.dataset.v) }),
  payStart: () => { S.pay = S.pay || {}; S.pay[todayKey().slice(0, 7)] = { b: 0 }; save(); render(); },
  payYear: el => { UI.payYear = +el.dataset.v; render(); },
  svAdd: () => { ensureSoll(); const v = S.cfg.sollVerlauf, last = v[v.length - 1]; let ab = todayKey(); if (ab <= last.ab) ab = E.addDays(last.ab, 1); v.push({ ab, soll: last.soll }); commit(); },
  rgAdd: () => { const g = S.cfg.regeln = S.cfg.regeln || [], last = g.length ? g[g.length - 1] : null; const src = E.cfgAt(S.cfg, '9999-12-31'); let ab = todayKey(); if (last && ab <= last.ab) ab = E.addDays(last.ab, 1); const r = { ab }; E.RULE_KEYS.forEach(f => { r[f] = src[f]; }); if (r.kappungAn === undefined) r.kappungAn = true; g.push(r); commit(); },
  wizOpen: () => { const rc = E.cfgAt(S.cfg, todayKey()), ab = todayKey(); UI.wiz = { ab, urlaubJahr: rc.urlaubJahr, rest: wizDefaults(ab, rc.urlaubJahr), konto: 0, lzk: 0, soll: S.cfg.soll }; render(); },
  wizCancel: () => { UI.wiz = null; render(); },
  wizApply: () => {
    const w = UI.wiz; if (!w) return; ensureSoll();
    const last = (S.cfg.regeln || []).length ? S.cfg.regeln[S.cfg.regeln.length - 1].ab : S.cfg.startDatum;
    if (!w.ab || w.ab <= S.cfg.startDatum || w.ab <= last) { toast('Das Datum muss nach dem Startdatum und nach der letzten Regeländerung liegen.'); return; }
    if (!(w.soll > 0)) { toast('Das Soll pro Arbeitstag fehlt.'); return; }
    const src = E.cfgAt(S.cfg, w.ab), r = { ab: w.ab };
    E.RULE_KEYS.forEach(f => { r[f] = src[f]; });
    if (r.kappungAn === undefined) r.kappungAn = true;
    r.urlaubJahr = w.urlaubJahr; r.wechsel = { rest: w.rest, konto: w.konto, lzk: w.lzk };
    S.cfg.regeln = (S.cfg.regeln || []).concat(r);
    S.cfg.sollVerlauf = S.cfg.sollVerlauf.filter(x => x.ab !== w.ab).concat({ ab: w.ab, soll: w.soll });
    UI.wiz = null; commit(); toast('Jobwechsel eingetragen.');
  },
  rgDel: el => { S.cfg.regeln.splice(+el.dataset.i, 1); commit(); },
  svDel: el => { S.cfg.sollVerlauf.splice(+el.dataset.i, 1); commit(); },
  uyear: el => { UI.uy = +el.dataset.v; render(); },
  brush: el => { UI.brush = el.dataset.v; render(); },
  paintKey: el => { if (lastPT === 'touch' || lastDetail === 0) { paintBegin(el.dataset.k); paintEnd(); } },
  stampIn: () => setDay(UI.date, { s: nowStr() }),
  stampOut: () => setDay(UI.date, { e: nowStr() }),
  addAct: () => {
    const f = UI.form, k = UI.date, d = S.days[k] || {};
    const acts = S.acts.filter(a => a.d === k).sort((a, b) => a.s.localeCompare(b.s));
    const s = f.s || (acts.length ? acts[acts.length - 1].e : d.s) || '';
    if (!s || !f.e) { toast('Von und Bis eintragen. Mit „Timer“ startet die Zeit ab jetzt.'); return; }
    if (H(f.e) <= H(s)) { toast('Bis muss nach Von liegen.'); return; }
    S.acts.push({ id: newId(), d: k, s, e: f.e, u: f.u, cat: f.cat, w: f.w, sys: f.sys, pn: f.pn || '', th: f.th });
    UI.form = { s: '', e: '', u: '', cat: '', w: '', sys: '', pn: '', th: '' };
    commit(); setTimeout(() => { const el = $('#f_e'); if (el) el.focus(); }, 0);
  },
  timerStart: () => {
    const f = UI.form, k = todayKey();
    if (S.acts.some(a => !a.e)) { toast('Es läuft schon ein Timer.'); return; }
    S.acts.push({ id: newId(), d: k, s: nowStr(), e: '', u: '', cat: f.cat, w: f.w, sys: f.sys, pn: f.pn || '', th: f.th });
    UI.date = k; UI.form = { s: '', e: '', u: '', cat: '', w: '', sys: '', pn: '', th: '' }; commit();
  },
  timerStop: el => { const a = S.acts.find(x => x.id === el.dataset.id); if (a) { a.e = nowStr(); if (H(a.e) <= H(a.s)) { S.acts = S.acts.filter(x => x !== a); toast(S.cfg.raster === '15' ? 'Timer unter einer Viertelstunde verworfen.' : 'Timer unter einer Minute verworfen.'); } commit(); } },
  delAct: el => { S.acts = S.acts.filter(a => a.id !== el.dataset.id); commit(); },
  mon: el => { let m = UI.month + +el.dataset.n, y = UI.year; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } UI.month = m; UI.year = y; render(); },
  todayMon: () => { const d = new Date(); UI.year = d.getFullYear(); UI.month = d.getMonth() + 1; render(); },
  goMon: el => { UI.year = +el.dataset.y; UI.month = +el.dataset.m; UI.tab = 'monat'; render(); window.scrollTo(0, 0); },
  year: el => { UI.year = +el.dataset.v; render(); },
  dim: el => { UI.dim = el.dataset.v; render(); },
  more: () => { UI.filt.limit += 300; render(); },
  applyRange: () => rangeApply(false),
  clearRange: () => rangeApply(true),
  chkUpd: () => checkUpdate(true),
  report: () => reportProblem(),
  lang: el => { I18N.set(el.dataset.v, true); render(); I18N.apply(); },
  bkPick: () => pickBackupDir(),
  bkNow: () => backupNow(true),
  bkOff: async () => { BK.cfg = Object.assign({}, BK.cfg, { handle: null }); await DB.set('backup', BK.cfg); render(); toast('Automatische Sicherung ausgeschaltet.'); },
  bkDownload: () => { markBackup(); saveFile('taktbuch-sicherung-' + todayKey() + '.json', exportJSON(), 'application/json'); showBackupBanner(null); },
  bkLater: () => { ls.set('zeitwerk-bk-snooze-' + PROFILE, String(Date.now())); showBackupBanner(null); },
  bkAllow: () => backupNow(true),
  exportJson: () => { markBackup(); saveFile('stundenkonto-sicherung-' + todayKey() + '.json', exportJSON(), 'application/json'); },
  exportCsv: () => saveFile('taetigkeiten-' + todayKey() + '.csv', exportCSV(), 'text/csv'),
  askReset: () => { UI.confirm = 'reset'; render(); },
  cancelConfirm: () => { UI.confirm = ''; render(); },
  resetAll: () => { S = { v: 1, cfg: Object.assign({}, DEFAULT_CFG), days: {}, acts: [], pay: {}, demo: false }; UI.confirm = ''; UI.report = null; commit(); toast('Alle Daten gelöscht.'); },
  loadDemo: () => { makeDemo(); UI.report = null; commit(); }
};
function rangeOrt(clear) {
  const g = UI.range; if (!g.from || !g.to || g.to < g.from) { toast('Von und Bis prüfen.'); return; }
  let n = 0;
  for (let k = g.from; k <= g.to; k = E.addDays(k, 1)) {
    if (E.weekday(k) >= 6 || E.holidayName(k)) continue;
    const d = Object.assign({}, S.days[k] || {});
    if (clear) { delete d.o; delete d.hoAb; delete d.hoZ; } else d.o = g.o || 'ho';
    if (isEmptyDay(d)) delete S.days[k]; else S.days[k] = d; n++;
  }
  commit(); toast(n + ' ' + I18N.tx('Tage aktualisiert') + '.');
}
function rangeApply(clear) {
  const g = UI.range; if (!g.from || !g.to || g.to < g.from) { toast('Von und Bis prüfen.'); return; }
  let n = 0, skip = 0;
  for (let k = g.from; k <= g.to; k = E.addDays(k, 1)) {
    if (E.weekday(k) >= 6 || E.holidayName(k)) { skip++; continue; }
    const d = Object.assign({}, S.days[k] || {});
    if (clear) { delete d.t; delete d.kd; delete d.ot; } else { d.t = g.t; if (g.t === 'Dienstreise') { if (g.kd) d.kd = g.kd; if (g.ot) d.ot = g.ot; } }
    if (isEmptyDay(d)) delete S.days[k]; else S.days[k] = d; n++;
  }
  commit(); toast((clear ? I18N.tx('# Tage zurückgesetzt') : I18N.tx('# Tage eingetragen als') + ' ' + I18N.tx(tyLabel(g.t))).replace('#', n) + (skip ? ', ' + I18N.tx('# Wochenend-/Feiertage übersprungen').replace('#', skip) : '') + '.');
}
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]'); if (!el) return;
  const fn = actions[el.dataset.a]; if (!fn) return;
  if (el.tagName === 'A') ev.preventDefault();
  lastDetail = ev.detail;
  fn(el);
});
/* ---------- Autovervollständigen ---------- */
const isFocus = v => /^focus[\s-]*time$/i.test(String(v || '').trim());
function focusDefaults(w) {
  const ref = S.acts.find(a => isFocus(a.w) && a.sys && isFocus(a.sys) && a.th && isFocus(a.th));
  return { sys: ref ? ref.sys : String(w).trim(), th: ref ? ref.th : 'Focus Time' };
}
function setFormField(f, v) { if (!UI.form[f]) { UI.form[f] = v; const el = $('#f_' + f); if (el && !el.value) el.value = v; } }
function autofillForm(a, v) {
  if (a === 'w' && v) { const c = S.acts.find(x => x.w && x.w.toLowerCase() === v.trim().toLowerCase()); if (c && c.w !== v) { v = c.w; UI.form.w = v; const el = $('#f_w'); if (el) el.value = v; } }
  if (a === 'w' && isFocus(v)) { const d = focusDefaults(v); setFormField('sys', d.sys); setFormField('th', d.th); }
  else if (a === 'th' && v) {
    const prev = S.acts.slice().sort((x, y) => (y.d + y.s).localeCompare(x.d + x.s)).find(x => x.th === v);
    if (prev) { setFormField('cat', prev.cat); setFormField('w', prev.w); setFormField('sys', prev.sys); setFormField('pn', prev.pn || ''); }
  }
}
function fieldChange(el, final) { fcEl = el; try { fieldChange_(el, final); } finally { fcEl = null; } }
function fieldChange_(el, final) {
  const [scope, a, b] = el.dataset.f.split(':');
  let v = el.value;
  if (final && el.classList.contains('tq') && /^(form:[seu]|day:([seap]|hoAb)|act:[^:]+:[seu])$/.test(el.dataset.f)) {
    const nv = normT(v, !!el.dataset.dur);
    if (nv === null) { toast('Uhrzeit nicht erkannt, bitte so eingeben: 09:30'); render(); return; }
    if (nv !== v) { v = nv; el.value = nv; }
  }
  if (scope === 'colv') { if (!final) return; const show = v === 'true'; if (a === 'pn') S.cfg.pnAn = show; else S.cfg.spaltenAus = Object.assign({}, S.cfg.spaltenAus, { [a]: !show }); commit(); return; }
  if (scope === 'col') { if (!final) return; S.cfg.spalten = Object.assign({}, S.cfg.spalten, { [a]: v.trim() }); commit(); return; }
  if (scope === 'form') { UI.form[a] = v; if (final) autofillForm(a, v); return; }
  if (!final) return;
  if (scope === 'day') {
    const k = el.dataset.k || UI.date;
    if (a === 'z') v = v === '' ? '' : +v;
    if (a === 't') v = normType(k, v);
    setDay(k, { [a]: v });
  } else if (scope === 'act') {
    const act = S.acts.find(x => x.id === a); if (!act) return;
    if (b === 'e' && v && H(v) <= H(act.s)) { toast('Bis muss nach Von liegen.'); render(); return; }
    act[b] = v;
    if (b === 'w' && isFocus(v)) { const d = focusDefaults(v); if (!act.sys) act.sys = d.sys; if (!act.th) act.th = d.th; }
    commit();
  } else if (scope === 'cfg' && a === 'hoWd') {
    const wd = +b, l = (S.cfg.hoWochentage || []).filter(x => x !== wd); if (el.checked) l.push(wd); S.cfg.hoWochentage = l.sort(); commit();
  } else if (scope === 'cfg') {
    if (el.dataset.md) { const md = mdParse(v); if (md === null) { toast('Bitte als Tag.Monat eingeben, z. B. 01.05.'); render(); return; } v = md; }
    if (el.dataset.bool) v = v === 'true';
    if (el.dataset.nullable && String(v).trim() === '') { S.cfg[a] = null; commit(); return; }
    if (el.dataset.int) v = parseInt(v, 10) || 0;
    if (el.dataset.num) { v = parseFloat(String(v).replace(',', '.')); if (isNaN(v)) return; if (el.dataset.pct) v /= 100; }
    S.cfg[a] = v; commit();
  } else if (scope === 'bk') {
    if (a === 'keep') { const n = parseInt(v, 10); if (!(n >= 1)) { render(); return; } BK.cfg.keep = n; } else BK.cfg[a] = v;
    DB.set('backup', BK.cfg); render();
  } else if (scope === 'wiz') {
    const w = UI.wiz; if (!w) return;
    if (a === 'ab') { if (!v) return; w.ab = v; w.rest = wizDefaults(w.ab, w.urlaubJahr); render(); return; }
    v = parseFloat(String(v).replace(',', '.')); if (isNaN(v)) return; w[a] = v;
    if (a === 'urlaubJahr') { w.rest = wizDefaults(w.ab, v); render(); }
  } else if (scope === 'rgw') {
    const x = (S.cfg.regeln || [])[+a]; if (!x || !x.wechsel) return;
    v = parseFloat(String(v).replace(',', '.')); if (isNaN(v)) { render(); return; } x.wechsel[b] = v; commit();
  } else if (scope === 'rg') {
    const x = (S.cfg.regeln || [])[+a]; if (!x) return;
    if (b === 'ab') { if (!v) { render(); return; } x.ab = v; S.cfg.regeln.sort((p, q) => p.ab.localeCompare(q.ab)); }
    else {
      if (el.dataset.md) { const md = mdParse(v); if (md === null) { toast('Bitte als Tag.Monat eingeben, z. B. 01.05.'); render(); return; } v = md; }
      if (el.dataset.bool) v = v === 'true';
      if (el.dataset.num) { v = parseFloat(String(v).replace(',', '.')); if (isNaN(v)) { render(); return; } }
      x[b] = v;
    }
    commit();
  } else if (scope === 'sv') {
    const x = S.cfg.sollVerlauf[+a]; if (!x) return;
    if (b === 'soll') { const n = parseFloat(String(v).replace(',', '.')); if (!(n > 0)) { render(); return; } x.soll = n; } else { if (!v) { render(); return; } x.ab = v; }
    commit();
  } else if (scope === 'pay') {
    setPay(a, b, v === '' ? '' : parseFloat(v));
  } else if (scope === 'ui') {
    if (a === 'date') { if (!v) return; UI.date = v; UI.year = +v.slice(0, 4); } else UI[a] = v; render();
  } else if (scope === 'filt') { UI.filt[a] = v; UI.filt.limit = 200; render(); }
  else if (scope === 'range') { UI.range[a] = v; if (a === 'from' && !UI.range.to) UI.range.to = v; if (a === 'from' || a === 't') render(); }
  else if (scope === 'file') {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onerror = () => toast('Datei konnte nicht gelesen werden.');
    rd.onload = () => {
      try {
        toast(I18N.tx('Lese') + ' ' + f.name + ' …');
        setTimeout(async () => {
          try {
            if (a === 'xlsx') await importWorkbook(rd.result); else importJSON(rd.result);
            UI.tab = 'einst'; UI.sub = 'daten'; UI.date = todayKey(); render(); toast('Import abgeschlossen.');
          } catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
        }, 30);
      } catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
    };
    if (a === 'xlsx') rd.readAsArrayBuffer(f); else rd.readAsText(f);
  }
}
/* Browser-Zeitfelder (type=time) melden "change" schon nach jedem Segment (Stunde, erste Minutenziffer).
   Würde dann gespeichert und neu gezeichnet, verliert das Feld mitten in der Eingabe den Fokus:
   Der Cursor springt nicht zu den Minuten und aus 08:45 wird 08:04. Deshalb erst beim Verlassen oder mit Enter übernehmen. */
const isTime = el => el && el.tagName === 'INPUT' && el.type === 'time';
/* Beim Wechsel zwischen den Segmenten ist das Feld kurzzeitig nicht fokussiert, daher erst im nächsten Tick prüfen */
const flushTime = el => setTimeout(() => { if (el.dataset.pending && el.isConnected && document.activeElement !== el) { delete el.dataset.pending; fieldChange(el, true); } }, 0);
document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-f]'); if (!el) return;
  if (isTime(el)) { el.dataset.pending = '1'; flushTime(el); return; }
  fieldChange(el, true);
});
document.addEventListener('focusout', ev => { const el = ev.target; if (isTime(el) && el.dataset.f && el.dataset.pending) flushTime(el); });

document.addEventListener('input', ev => { const el = ev.target.closest('[data-f]'); if (el && el.dataset.f.startsWith('form:')) fieldChange(el, false); });
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.closest('#addRow') && ev.target.tagName === 'INPUT') { ev.preventDefault(); ev.target.blur(); actions.addAct(); }
  else if (ev.key === 'Enter' && isTime(ev.target) && ev.target.dataset.pending) { ev.preventDefault(); ev.target.blur(); }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => drawCharts());

/* ---------- Urlaub malen ---------- */
let lastPT = 'mouse', lastDetail = 1, painting = null;
function cellType(k) { const d = S.days[k]; return (d && d.t) || E.defaultType(k, S.cfg); }
function paintBegin(k) {
  const cur = (S.days[k] || {}).t, b = UI.brush;
  const clear = b === 'arbeit' ? true : cur === b;
  painting = { clear, n: 0 }; paintApply(k);
}
function paintApply(k) {
  if (!painting) return; const r = R.map[k]; if (!r || r.wd >= 6 || r.hol) return;
  const b = UI.brush, d = Object.assign({}, S.days[k] || {});
  if (painting.clear) { if (b === 'arbeit' && E.defaultType(k, S.cfg) === 'Urlaub - halb') d.t = 'arbeit'; else delete d.t; }
  else d.t = b;
  if (isEmptyDay(d)) delete S.days[k]; else S.days[k] = d;
  painting.n++;
  const el = document.querySelector('.pd[data-k="' + k + '"]');
  if (el) { const t = cellType(k); el.className = 'pd ' + tyClass(t) + (k > todayKey() && !isWorkType(t) ? ' fut' : '') + (k === todayKey() ? ' today' : ''); }
}
function paintEnd() { if (!painting) return; const n = painting.n; painting = null; if (n) commit(); }
document.addEventListener('pointerdown', ev => {
  lastPT = ev.pointerType;
  if (ev.pointerType === 'touch' || ev.button !== 0) return;
  const c = ev.target.closest('.pd[data-p]'); if (!c) return;
  ev.preventDefault(); paintBegin(c.dataset.k);
});
document.addEventListener('pointerover', ev => { if (!painting) return; const c = ev.target.closest('.pd[data-p]'); if (c) paintApply(c.dataset.k); });
document.addEventListener('pointerup', paintEnd);
document.addEventListener('pointercancel', paintEnd);

/* ---------- Profilwahl ---------- */
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
function chooseProfile() {
  return new Promise(res => {
    const draw = () => {
      $('#view').innerHTML = `<section class="card" style="max-width:640px;margin:40px auto"><div class="card-h"><h3>Willkommen bei Taktbuch</h3><div class="seg" role="group" aria-label="Language" data-nt>${['de', 'en'].map(l => `<button data-lg="${l}" aria-pressed="${I18N.lang === l}">${l === 'de' ? 'Deutsch' : 'English'}</button>`).join('')}</div></div>
        <p class="hint" style="margin:0 0 14px">Wähle eine Vorlage. Alle Regeln lassen sich später unter „Einstellungen“ einzeln ändern. Hast du Taktbuch (früher „Zeitwerk“) oder das frühere „Stundenkonto“ schon benutzt, wähle dieselbe Vorlage wie damals, damit deine Daten gefunden werden.</p>
        <div style="display:grid;gap:10px">${Object.entries(PROFILES).map(([k, p]) => `<button class="btn ${k === 'voll' ? 'primary' : ''}" data-pf="${k}" style="text-align:left;padding:12px 14px"><b>${esc(p.name)}</b><br><span class="hint">${k === 'voll' ? 'Resturlaub verfällt am 1.5., Zeitkonto wird am 31.10. gekappt, 24.12. und 31.12. sind halbe Urlaubstage.' : 'Kein Verfall, keine Kappung, 24.12. und 31.12. sind normale Arbeitstage.'}</span></button>`).join('')}</div></section>`;
      I18N.apply();
      $('#view').querySelectorAll('[data-lg]').forEach(b => b.addEventListener('click', () => { I18N.set(b.dataset.lg, true); draw(); }));
      $('#view').querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => { ls.set('zeitwerk-profile', b.dataset.pf); I18N.set(I18N.lang, true); res(b.dataset.pf); }));
    };
    draw();
  });
}
async function detectProfile() {
  // Online: Hat das Konto schon Daten, keine Vorlagen-Frage (die gilt nur für den allerersten Start).
  // Die Vorlage bestimmt nur Standardwerte; gespeicherte Einstellungen gehen immer vor.
  if (window.__ZW_TARGET === 'online' && await DB.get('state')) { const p = ls.get('zeitwerk-profile'); return PROFILES[p] ? p : 'voll'; }
  let names = null;
  try { if (indexedDB.databases) names = (await indexedDB.databases()).map(d => d.name); } catch (e) { }
  if (names) { if (names.includes(PROFILES.voll.db)) return 'voll'; if (names.includes(PROFILES.einfach.db)) return 'einfach'; }
  const p = ls.get('zeitwerk-profile'); if (PROFILES[p]) return p;
  if (!I18N.stored()) I18N.set(I18N.browserDefault(), false);   // erster Start: Browsersprache vorwählen
  return chooseProfile();
}

/* ---------- Update-Prüfung (GitHub Releases) ---------- */
const semver = v => String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
const isNewer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
function showUpdate(info) {
  const el = $('#updbanner'); if (!el) return;
  if (!info || !isNewer(info.tag, VERSION) || ls.get('zeitwerk-upd-skip') === info.tag) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="banner"><span><b>Neue Version ${esc(info.tag.replace(/^v/, ''))} verfügbar</b> (du hast ${esc(VERSION)}). Speichere vorher unter „Daten“ eine Sicherung. Deine Daten bleiben im Browser erhalten, wenn du die neue Datei im selben Browser öffnest.</span>
    <button class="btn primary" id="updInst">Installieren</button><a class="btn" id="updDl" target="_blank" rel="noopener">Herunterladen</a><button class="btn" id="updNotes">Was ist neu?</button><button class="btn" id="updSkip">Später</button>
    <pre id="updPre" hidden style="flex-basis:100%;margin:6px 0 0;white-space:pre-wrap;font:inherit;font-size:13px"></pre></div>`;
  $('#updDl').href = info.asset || info.url;
  $('#updPre').textContent = info.notes || 'Keine Hinweise hinterlegt.';
  $('#updInst').onclick = () => installUpdate(info);
  if (!window.showSaveFilePicker) $('#updInst').hidden = true;
  $('#updNotes').onclick = () => { const p = $('#updPre'); p.hidden = !p.hidden; };
  $('#updSkip').onclick = () => { ls.set('zeitwerk-upd-skip', info.tag); el.innerHTML = ''; };
}
/* Neue Version direkt über die bestehende Datei schreiben (Chrome/Edge): Datei wählen, bestätigen, fertig.
   Die Datei kommt von raw.githubusercontent.com (Branch "dist", wird beim Release gebaut), weil GitHubs
   Release-Download im Browser wegen CORS nicht lesbar ist. Der Dateidialog kommt zuerst (Klick-Berechtigung). */
async function installUpdate(info) {
  const fallback = msg => { alert(I18N.tx('Direktes Überschreiben ging nicht. Die Datei wird stattdessen heruntergeladen.') + (msg ? ' (' + msg + ')' : '')); window.open(info.asset || info.url, '_blank'); };
  let h;
  try { h = await window.showSaveFilePicker({ suggestedName: (() => { const f = decodeURIComponent(location.pathname.split('/').pop() || ''); return /\.html?$/i.test(f) ? f : 'taktbuch.html'; })(), types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }] }); }
  catch (e) { if (e && e.name === 'AbortError') return; fallback(e && e.message); return; }
  try {
    const r = await fetch('https://raw.githubusercontent.com/' + REPO + '/dist/taktbuch.html?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    if (!txt.includes("__ZW_VERSION='" + info.tag.replace(/^v/, '') + "'")) throw new Error(I18N.tx('Die neue Datei ist noch nicht bereit, bitte in ein paar Minuten erneut versuchen.'));
    if (txt.length < 100000) throw new Error('Datei unvollständig');
    let old = ''; try { old = await (await h.getFile()).text(); } catch (e) { }
    const size = new Blob([txt]).size;
    const put = async t => { const w = await h.createWritable(); await w.write(t); await w.close(); };
    await put(txt);
    const chk = await h.getFile();   // nachprüfen, sonst alte Version zurückschreiben
    if (chk.size !== size) { try { if (old) await put(old); } catch (e) { } throw new Error(I18N.tx('Schreiben unvollständig, die alte Version wurde wiederhergestellt.')); }
    alert(I18N.tx('Aktualisiert. Die Seite wird jetzt neu geladen.')); location.reload();
  } catch (e) { fallback(e && e.message); }
}
async function checkUpdate(manual) {
  const st = $('#updState');
  const say = t => { if (st) st.textContent = t; };
  if (!REPO) { say('In dieser Version ist keine Update-Prüfung eingerichtet.'); return; }
  let info = null; try { info = JSON.parse(ls.get('zeitwerk-upd-info') || 'null'); } catch (e) { }
  const last = +ls.get('zeitwerk-upd-last') || 0;
  if (!manual && Date.now() - last < 36e5) { showUpdate(info); return; }
  say('prüfe …');
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
    clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(), as = (j.assets || []).find(a => /\.html$/i.test(a.name));
    info = { tag: j.tag_name, url: j.html_url, asset: as ? as.browser_download_url : '', aid: as ? as.id : 0, notes: String(j.body || '').slice(0, 4000) };
    ls.set('zeitwerk-upd-info', JSON.stringify(info)); ls.set('zeitwerk-upd-last', String(Date.now()));
    if (manual) { ls.set('zeitwerk-upd-skip', ''); say(isNewer(info.tag, VERSION) ? 'Neue Version ' + info.tag.replace(/^v/, '') + ' verfügbar.' : 'Du hast die aktuelle Version.'); }
    showUpdate(info);
  } catch (e) { say(manual ? 'Prüfung nicht möglich (offline oder Zugriff gesperrt).' : ''); if (!manual) ls.set('zeitwerk-upd-last', String(Date.now())); /* nach Fehler in 1 Stunde erneut versuchen */ showUpdate(info); }
}

/* ---------- Problem melden (mailto, nichts wird automatisch gesendet) ---------- */
const REPORT_MAIL = 'Taktbuch@pm.me';
function reportProblem() {
  const en = I18N.lang === 'en', c = S.cfg;
  const on = [c.ortAn && 'Arbeitsort', c.auszahlAn && 'Auszahlung', c.raster === '15' && 'Viertelstunden', c.pnAn && 'Projektnummer', (c.regeln || []).length && 'Regeln ab Datum'].filter(Boolean).join(', ');
  const tech = ['Version: ' + VERSION, 'Profil: ' + PROFILE, 'Sprache: ' + I18N.lang, 'Browser: ' + navigator.userAgent, 'Schalter: ' + (on || '-')].join('\n');
  const body = (en ? 'What did you want to do? What happened? What did you expect?\n\n\n\n' : 'Was wolltest du tun? Was ist passiert? Was hast du erwartet?\n\n\n\n') +
    (en ? '--- Technical details (added automatically, no data from the app) ---\n' : '--- Technische Angaben (automatisch ergänzt, keine Daten aus der App) ---\n') + tech;
  location.href = 'mailto:' + REPORT_MAIL + '?subject=' + encodeURIComponent('Taktbuch ' + VERSION + (en ? ': feedback' : ': Meldung')) + '&body=' + encodeURIComponent(body);
}

/* ---------- Automatische Sicherung (Ordner per File System Access API, sonst Erinnerung) ---------- */
const BK = { cfg: { handle: null, interval: 'daily', keep: 10 } };
const BK_SUPPORTED = typeof window.showDirectoryPicker === 'function';
const bkLast = () => +ls.get('zeitwerk-bk-last-' + PROFILE) || 0;
const markBackup = () => ls.set('zeitwerk-bk-last-' + PROFILE, String(Date.now()));
const bkDue = () => Date.now() - bkLast() >= (BK.cfg.interval === 'weekly' ? 7 : 1) * 864e5 - 36e5;
const bkName = d => 'taktbuch-sicherung-' + PROFILE + '-' + d + '.json';
async function bkPermission(request) {
  const h = BK.cfg.handle; if (!h) return 'none';
  try { let p = await h.queryPermission({ mode: 'readwrite' }); if (p === 'prompt' && request) p = await h.requestPermission({ mode: 'readwrite' }); return p; } catch (e) { return 'denied'; }
}
async function backupNow(manual) {
  const h = BK.cfg.handle;
  if (!h) { if (manual) toast('Erst einen Ordner wählen.'); return false; }
  const perm = await bkPermission(manual);
  if (perm !== 'granted') { if (manual) toast('Zugriff auf den Ordner wurde nicht erlaubt.'); return false; }
  try {
    const txt = exportJSON(), name = bkName(todayKey());
    const fh = await h.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(txt); await w.close();
    if ((await fh.getFile()).size !== new Blob([txt]).size) throw new Error('Datei unvollständig');
    markBackup(); showBackupBanner(null);
    const re = new RegExp('^taktbuch-sicherung-' + PROFILE + '-\\d{4}-\\d{2}-\\d{2}\\.json$'), names = [];
    for await (const [n] of h.entries()) if (re.test(n)) names.push(n);
    names.sort().reverse(); for (const n of names.slice(Math.max(1, BK.cfg.keep || 10))) { try { await h.removeEntry(n); } catch (e) { } }
    if (manual) toast(I18N.tx('Sicherung gespeichert:') + ' ' + name); if (UI.tab === 'einst') render();
    return true;
  } catch (e) { if (manual) toast(I18N.tx('Sicherung fehlgeschlagen:') + ' ' + (e && e.message)); return false; }
}
async function pickBackupDir() {
  if (!BK_SUPPORTED) { toast('Dieser Browser kann das nicht. Nutze Chrome oder Edge.'); return; }
  try {
    const h = await window.showDirectoryPicker({ id: 'taktbuch-backup', mode: 'readwrite' });
    BK.cfg = Object.assign({ interval: 'daily', keep: 10 }, BK.cfg, { handle: h }); await DB.set('backup', BK.cfg);
    await backupNow(true); render();
  } catch (e) { if (!e || e.name !== 'AbortError') toast(I18N.tx('Ordner konnte nicht gewählt werden:') + ' ' + (e && e.message)); }
}
function showBackupBanner(kind) {
  const el = $('#bkbanner'); if (!el) return;
  if (!kind) { el.innerHTML = ''; return; }
  const days = bkLast() ? Math.floor((Date.now() - bkLast()) / 864e5) : null;
  el.innerHTML = kind === 'perm'
    ? `<div class="banner"><span><b>Automatische Sicherung wartet.</b> Der Browser braucht nach dem Start eine Bestätigung für den Sicherungsordner.</span><span><button class="btn primary" id="bkYes" data-a="bkAllow">Jetzt bestätigen</button> <button class="btn" data-a="bkLater">Später</button></span></div>`
    : `<div class="banner"><span><b>Zeit für eine Sicherung.</b> ${days == null ? I18N.tx('Es gibt noch keine Sicherung.') : I18N.tx('Die letzte Sicherung ist') + ' ' + days + ' ' + I18N.tx('Tage alt.')} Die Daten liegen nur in diesem Browser.</span><span><button class="btn primary" data-a="bkDownload">Sicherung speichern</button> <button class="btn" data-a="bkLater">Später</button></span></div>`;
  I18N.apply();
}
async function autoBackup() {
  if (window.__ZW_TARGET === 'online') return;   // online liegen die Daten auf dem Server (eigenes Backup)
  if (S.demo || !bkDue()) return;
  const snooze = +ls.get('zeitwerk-bk-snooze-' + PROFILE) || 0; if (Date.now() - snooze < 36e5 * 6) return;
  if (BK.cfg.handle) { const p = await bkPermission(false); if (p === 'granted') await backupNow(false); else showBackupBanner('perm'); return; }
  if (!bkLast()) { markBackup(); return; }    // erster Start: Erinnerung erst nach einem Intervall
  showBackupBanner('remind');
}

/* ---------- Start ---------- */
(async function boot() {
  I18N.start();
  applyProfile(await detectProfile());
  let loaded = false;
  try {
    const raw = await DB.get('state');
    if (raw) { const o = JSON.parse(raw); if (o && o.v === 1) { S = Object.assign({ demo: false, pay: {} }, o); S.cfg = Object.assign({}, DEFAULT_CFG, o.cfg); loaded = true; } }
  } catch (e) { /* leer starten */ }
  if (!loaded) { makeDemo(); }
  try { const b = await DB.get('backup'); if (b) BK.cfg = Object.assign({ interval: 'daily', keep: 10 }, b); } catch (e) { }
  let t = ls.get('stundenkonto-tab-' + PROFILE); if (t === 'daten') t = 'einst'; if (t && TABS.some(x => x[0] === t)) UI.tab = t;
  recompute(); render(); I18N.apply();
  $('#saveState').textContent = loaded ? 'geladen' : 'Beispiel';
  setInterval(timerTick, 30000);
  setTimeout(() => checkUpdate(false), 1500);
  setTimeout(autoBackup, 4000);
  showWhatsNew(loaded);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkUpdate(false); autoBackup(); } }); /* auch bei lange offenem Tab */
})();
window.addEventListener('pagehide', () => { ls.set('stundenkonto-tab-' + PROFILE, UI.tab); });
