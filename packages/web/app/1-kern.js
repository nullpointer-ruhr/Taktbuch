'use strict';
const E = window.StundenEngine;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => (n < 10 ? '0' : '') + n;

/* ---------- Zeit- und Zahlenformate ---------- */
const H = s => { if (s == null || s === '') return 0; const m = /^(\d{1,2}):(\d{2})/.exec(s); return m ? +m[1] + +m[2] / 60 : 0; };
const HM = h => { if (!h && h !== 0) return ''; const t = Math.round(h * 60); return pad2(Math.floor(t / 60) % 24) + ':' + pad2(t % 60); };
const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
/* Zeitraster: 'min' = minutengenau, '15' = Viertelstunden (Jetzt-Knöpfe und Timer werden auf die nächste Viertelstunde gerundet,
   eingetippte Uhrzeiten bleiben minutengenau, damit man z. B. Stempeluhr-Zeiten aus dem Büro übernehmen kann) */
const snap = v => { if (!v || !S.cfg || S.cfg.raster !== '15' || !/^\d{2}:\d{2}$/.test(v)) return v; const m = Math.min(23 * 60 + 45, Math.round((+v.slice(0, 2) * 60 + +v.slice(3)) / 15) * 15); return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); };
/* Viertelstunden-Modus: Textfeld mit Auswahlliste des ganzen Tages statt des Browser-Zeitfelds (dessen Minutenliste lässt sich nicht beschränken) */
const tAttr = dur => (S.cfg && S.cfg.raster === '15' ? (dur ? ' type="text" class="tq" data-dur="1" inputmode="numeric" autocomplete="off" list="dl-d15"' : ' type="text" class="tq" inputmode="numeric" autocomplete="off" placeholder="hh:mm" list="dl-t15"') : ' type="time"');
function normT(v, dur) {   // "9", "930", "09:30", "9:30" -> "09:30" (minutengenau, nicht gerundet), ungültig -> null. Bei Dauern (Pause usw.) sind 1-2 Ziffern Minuten: "30" -> "00:30"
  v = String(v == null ? '' : v).trim(); if (!v) return '';
  let h, m; const c = /^(\d{1,2})[:.](\d{1,2})$/.exec(v), d = /^(\d{1,4})$/.exec(v);
  if (c) { h = +c[1]; m = +c[2]; } else if (d) { const s = d[1]; if (s.length <= 2) { if (dur) { h = Math.floor(+s / 60); m = +s % 60; } else { h = +s; m = 0; } } else { h = +s.slice(0, s.length - 2); m = +s.slice(-2); } } else return null;
  if (h > 23 || m > 59) return null;
  return pad2(h) + ':' + pad2(m);
}
const REGION_NAMES = { DE: 'Nur bundesweite Feiertage', BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz', SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen' };
const COLD = { cat: 'Kategorie', w: 'Art', sys: 'System', pn: 'Projektnummer', th: 'Thema' };
const pnOn = () => !!(S.cfg && S.cfg.pnAn);
/* Spalten der Tätigkeiten ein-/ausblenden (Projektnummer ist standardmäßig aus, die anderen an; Werte bleiben gespeichert) */
const colOn = f => (f === 'pn' ? pnOn() : !(S.cfg && S.cfg.spaltenAus && S.cfg.spaltenAus[f]));
const colN = c => (S.cfg && S.cfg.spalten && S.cfg.spalten[c]) || COLD[c];
const nowStr = () => { const d = new Date(); return snap(pad2(d.getHours()) + ':' + pad2(d.getMinutes())); };
const todayKey = () => { const d = new Date(); return E.key(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
function fmtDec(x, dp = 2) { return (Math.round(x * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp).replace(/^-0\.0+$/, '0.' + '0'.repeat(dp)).replace('.', I18N.lang === 'en' ? '.' : ','); }
function fmtT(x, signed) { // Stunden gemaess Einstellung
  if (x == null || isNaN(x)) return '–';
  const sg = signed ? (x > 0.0049 ? '+' : x < -0.0049 ? '−' : '') : (x < 0 ? '−' : '');
  const a = Math.abs(x);
  if (S.cfg.anzeige === 'hm') { const t = Math.round(a * 60); return sg + Math.floor(t / 60) + ':' + pad2(t % 60); }
  return sg + fmtDec(a);
}
const fmtDate = k => { const p = E.parse(k); return WD[E.weekday(k) - 1] + ' ' + pad2(p.d) + '.' + pad2(p.m) + '.' + p.y; };
const fmtShort = k => { const p = E.parse(k); return WD[E.weekday(k) - 1] + ' ' + pad2(p.d) + '.' + pad2(p.m) + '.'; };
const cls = x => (x > 0.0049 ? 'pos' : x < -0.0049 ? 'neg' : 'muted');

/* ---------- Zustand ---------- */
/* Profile (Vorlagen): "voll" = mit Urlaubsverfall, Kappung und halben Feiertagen, "einfach" = ohne.
   Die Datenbanknamen bleiben aus Kompatibilitätsgründen wie in früheren Versionen. */
const VERSION = window.__ZW_VERSION || 'dev', REPO = window.__ZW_REPO || '';
const PROFILES = { voll: { db: 'stundenkonto', name: 'Mit Urlaubsverfall und Kappung' }, einfach: { db: 'stundenkonto-linda', name: 'Einfach, ohne Verfall und Kappung' } };
let PROFILE = 'voll', DEFAULT_CFG = {};
function applyProfile(p) {
  PROFILE = PROFILES[p] ? p : 'voll';
  DEFAULT_CFG = Object.assign({}, E.DEFAULTS, { anzeige: 'dez', standardThema: I18N.lang === 'en' ? 'Work' : 'Arbeit', nettoAb: '9999-12-31', payRise: 0.025, payRiseMonat: 4, mirAn: true, raster: 'min', spalten: {}, pnAn: false, spaltenAus: {}, region: 'NW', payRiseArt: 'pct', payRiseEur: 0, zahltagModus: 'letzte4' },
    PROFILE === 'einfach' ? { urlaubVerfall: '', kappungTag: '', halbeTage: false, lzkMax: 0, payRiseMonat: 0, mirAn: false } : {});
  S.cfg = Object.assign({}, DEFAULT_CFG); E.setRegion(S.cfg.region);
}
let S = { v: 1, cfg: {}, days: {}, acts: [], pay: {}, demo: false };
let fcEl = null;   // Feld, dessen Änderung gerade übernommen wird (render() übernimmt dessen Rohwert nicht)
const UI = { sub: 'einst', uy: new Date().getFullYear(), payYear: new Date().getFullYear(), brush: 'Urlaub', tab: 'heute', date: todayKey(), year: new Date().getFullYear(), month: new Date().getMonth() + 1,
  form: { s: '', e: '', u: '', cat: '', w: '', sys: '', pn: '', th: '' },
  filt: { y: '', m: '', cat: '', w: '', sys: '', pn: '', q: '', limit: 200 }, dim: 'cat', pivotYear: 'alle',
  range: { from: '', to: '', t: 'Urlaub', o: 'ho', kd: '', ot: '' }, report: null, confirm: '' };
let R = null; // Berechnung: { rows, map, years }

/* ---------- Speicher ----------
   DB kommt aus dem Speicher-Adapter (packages/web/storage/*.js), den build.py je nach
   Build-Ziel einsetzt. Vertrag: async get(k) -> Wert | undefined, async set(k, v) -> true | false. */
let saveTimer = null, canPersist = true;
function save() {
  const el = $('#saveState'); if (el) el.textContent = 'speichert …';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const ok = await DB.set('state', JSON.stringify(S));
    canPersist = ok; saveTimer = null; const e2 = $('#saveState');
    if (e2) e2.textContent = ok ? 'gespeichert' : 'nur Sitzung';
    if (DB.saved) DB.saved(ok);
  }, 500);
}

/* ---------- Berechnung ---------- */
function ensureSoll() {
  const c = S.cfg;
  if (!c.zahltagModus) c.zahltagModus = c.zahltagFeiertage === false ? 'letzte4raw' : 'letzte4';
  if (!Array.isArray(c.sollVerlauf) || !c.sollVerlauf.length) {
    c.sollVerlauf = c.sollAlt != null && c.sollWechsel ? [{ ab: c.startDatum, soll: c.sollAlt }, { ab: c.sollWechsel, soll: c.soll }] : [{ ab: c.startDatum, soll: c.soll }];
  }
  c.sollAlt = null; c.sollWechsel = '';
  c.sollVerlauf = c.sollVerlauf.filter(x => x && x.ab && typeof x.soll === 'number' && x.soll > 0).sort((x, y) => x.ab.localeCompare(y.ab));
  if (!c.sollVerlauf.length) c.sollVerlauf = [{ ab: c.startDatum, soll: 7.5 }];
  c.sollVerlauf[0].ab = c.startDatum;
  c.soll = E.sollAt(c, todayKey());
  if (c.urlaubVerfallAb || !Array.isArray(c.regeln)) { const m = E.migrate(c); c.regeln = m.regeln; c.urlaubVerfall = m.urlaubVerfall; c.urlaubVerfallAb = 0; }
}
function recompute() {
  E.setRegion(S.cfg.region);
  ensureSoll();
  // Stichtage, die versehentlich als TT.MM. gespeichert wurden, in MM-TT umwandeln (sonst greifen sie nie)
  for (const r of [S.cfg].concat(S.cfg.regeln || [])) for (const f of ['urlaubVerfall', 'kappungTag']) {
    if (r[f] && !/^\d{2}-\d{2}$/.test(r[f])) { const md = mdParse(r[f]); if (md) r[f] = md; }
  }
  const days = {};
  for (const k in S.days) {
    const d = S.days[k];
    days[k] = { s: H(d.s), e: H(d.e), a: H(d.a), t: d.t || (d.th && !/^(WE|Feiertag)$/.test(E.defaultType(k, S.cfg)) ? d.th : undefined), p: d.p ? H(d.p) : null, z: d.z, n: d.n, o: d.o, hoAb: d.hoAb ? H(d.hoAb) : 0, hoZ: d.hoZ, az: d.az, kd: d.kd, ot: d.ot };
  }
  const by = {}; let minAct = '9999-12-31';
  for (const a of S.acts) {
    if (!a.e) continue; const n = H(a.e) - H(a.s) - H(a.u); if (n <= 0) continue;
    by[a.d] = (by[a.d] || 0) + n; if (a.d < minAct) minAct = a.d;
  }
  S.cfg.nettoAb = minAct;
  const t = todayKey();
  const lastKey = Object.keys(S.days).sort().pop() || t;
  const endY = Math.max(+t.slice(0, 4) + 1, +lastKey.slice(0, 4));
  const rows = E.run(days, by, S.cfg, endY + '-12-31', t);
  const map = {}; rows.forEach((r, i) => { r.i = i; map[r.k] = r; });
  R = { rows, map, years: E.summarize(rows, S.cfg), by };
}
/** Zeile eines Tages. Vor dem Startdatum gibt es keine berechnete Zeile: dann eine leere, damit Tag,
    Woche und Kalender auch für eine Woche funktionieren, in der das Startdatum liegt oder die davor liegt. */
function dayRow(k) { return R.map[k] || emptyRow(k); }
function emptyRow(k) {
  const wd = E.weekday(k), vor = !!S.cfg.startDatum && k < S.cfg.startDatum;
  return { k, kw: E.isoWeek(k), wd, t: wd >= 6 ? 'WE' : 'arbeit', s: 0, e: 0, a: 0, pause: 0, pauseAuto: true, stunden: 0, over: 0, za: 0, zagen: 0,
    konto: vor ? +S.cfg.startSaldo || 0 : 0, rest: 0, ugen: 0, krank: 0, soll: 0, arbeitstag: 0, netto: 0, acts: 0, planned: false, hol: E.holidayName(k) || null,
    note: '', adj: 0, az: 0, ort: '', hoH: 0, kd: '', ot: '', loss: 0, lzk: 0, lzkIn: 0, verfall: 0, vorStart: vor, i: -1 };
}
/** Stichtage wie Urlaubsverfall und Kappung: gespeichert als MM-TT, angezeigt und eingegeben als TT.MM. */
const mdShow = v => (/^\d{2}-\d{2}$/.test(v || '') ? v.slice(3) + '.' + v.slice(0, 2) + '.' : (v || ''));
function mdParse(v) {
  v = String(v || '').trim(); if (!v) return '';
  let m = v.match(/^(\d{1,2})\.(\d{1,2})\.?$/), d, mo;
  if (m) { d = +m[1]; mo = +m[2]; } else if ((m = v.match(/^(\d{2})-(\d{2})$/))) { mo = +m[1]; d = +m[2]; } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]) return null;
  return pad2(mo) + '-' + pad2(d);
}
function commit(rerender = true) { recompute(); save(); if (rerender) render(); else updatePill(); }

/* ---------- Tagesdaten ändern ---------- */
function isEmptyDay(d) { return !(d.kd || d.ot || d.o || d.hoAb || d.hoZ || d.az || d.s || d.e || d.a || d.p || d.z || d.n || d.t || (d.th && d.th !== S.cfg.standardThema)); }
function setDay(k, patch, rerender = true) {
  const d = Object.assign({}, S.days[k] || {}, patch);
  for (const f of Object.keys(d)) if (d[f] === '' || d[f] === undefined || d[f] === 0 && (f === 'z' || f === 'az')) delete d[f];
  if (isEmptyDay(d)) delete S.days[k]; else S.days[k] = d;
  commit(rerender);
}
let actSeq = 0;
const newId = () => Date.now().toString(36) + (actSeq++).toString(36);

/* ---------- Demo-Daten ---------- */
function makeDemo() {
  const cfg = Object.assign({}, DEFAULT_CFG, { startDatum: (new Date().getFullYear() - 1) + '-01-01', startSaldo: 12.5, startUrlaub: 4, urlaubVerfallAb: 9999 });
  const days = {}, acts = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const t = todayKey(); const cats = ['PROJECT', 'RUN', 'TRAVEL'];
  const works = ['Meeting', 'Technical Work', 'Documentation', 'Focus time', 'Training'];
  const systems = ['Plattform A', 'Plattform B', 'Allgemein', 'Support'];
  const themes = ['Wochenplanung', 'Störung analysiert', 'Konzept überarbeitet', 'Abstimmung mit Team', 'Release vorbereitet', 'Code-Review'];
  for (let k = cfg.startDatum; k < t; k = E.addDays(k, 1)) {
    if (E.weekday(k) >= 6 || E.holidayName(k)) continue;
    const r = rnd();
    if (r < 0.07) { days[k] = { t: 'Urlaub' }; continue; }
    if (r < 0.09) { days[k] = { t: 'krank' }; continue; }
    if (r < 0.12) { days[k] = { t: 'Zeitausgleich' }; continue; }
    const s = 7.5 + Math.round(rnd() * 3) / 4, len = 8 + Math.round(rnd() * 6) / 4 - 0.5;
    days[k] = { s: HM(s), e: HM(s + len) };
    if (k > E.addDays(t, -120)) {
      let cur = s, n = 0; const end = s + len - 0.5;
      while (cur < end - 0.25 && n < 8) {
        const dur = Math.min(end - cur, [0.5, 0.75, 1, 1.5, 2][Math.floor(rnd() * 5)]); n++;
        acts.push({ id: newId(), d: k, s: HM(cur), e: HM(cur + dur), u: '', cat: cats[Math.floor(rnd() * 2.4)], w: works[Math.floor(rnd() * 5)], sys: systems[Math.floor(rnd() * 4)], th: themes[Math.floor(rnd() * themes.length)] });
        cur += dur + (rnd() < .3 ? 0.25 : 0);
      }
    }
  }
  const pay = {}, cy = new Date().getFullYear(), cm = new Date().getMonth() + 1;
  for (let y = cy - 1; y <= cy; y++) for (let m = 1; m <= 12; m++) {
    if (y === cy && m > cm) break;
    const b = y === cy - 1 || m < 4 ? 5200 : 5356, s = m === 4 ? 4100 : m === 11 ? b : m === 6 ? 900 : 0, u = Math.round((b + s) * 0.655 * 100) / 100;
    pay[y + '-' + pad2(m)] = { b, s, u, m: Math.round(rnd() * 30 * 100) / 100 };
  }
  S = { v: 1, cfg, days, acts, pay, demo: true };
}

/* ---------- Import / Export ---------- */
const xlDate = n => { const t = Math.round(n) * 864e5 + Date.UTC(1899, 11, 30); return E.fromUTC(t); };
const xlTime = n => (typeof n === 'number' ? Math.round((n % 1) * 1440) / 60 : 0);

/* Minimaler XLSX-Leser: liest nur die gewünschten Blätter (die Excel hat versteckte Blätter mit über 100 MB XML). */
async function inflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function readZip(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf); let eo = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  if (eo < 0) throw new Error('Keine gültige Excel-Datei.');
  const n = dv.getUint16(eo + 10, true); let p = dv.getUint32(eo + 16, true); const ent = {}; const td = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    ent[td.decode(u.subarray(p + 46, p + 46 + nl))] = { m: dv.getUint16(p + 10, true), cs: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
    p += 46 + nl + el + cl;
  }
  return async name => {
    const e = ent[name]; if (!e) return null;
    const nl = dv.getUint16(e.off + 26, true), el = dv.getUint16(e.off + 28, true), st = e.off + 30 + nl + el;
    const data = u.subarray(st, st + e.cs);
    return new TextDecoder().decode(e.m === 0 ? data : await inflateRaw(data));
  };
}
const colIdx = c => { let n = 0; for (const ch of c) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const unXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
async function readXlsx(buf, wanted) {
  const get = await readZip(buf);
  const wbx = await get('xl/workbook.xml'), rels = await get('xl/_rels/workbook.xml.rels');
  if (!wbx || !rels) throw new Error('Keine gültige Excel-Datei.');
  const relMap = {}; for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = /\bId="([^"]+)"/.exec(m[0]), tg = /\bTarget="([^"]+)"/.exec(m[0]); if (id && tg) relMap[id[1]] = tg[1]; }
  const sheets = {}; for (const m of wbx.matchAll(/<sheet\b[^>]*>/g)) { const nm = /\bname="([^"]+)"/.exec(m[0]), rid = /\br:id="([^"]+)"/.exec(m[0]); if (nm && rid) sheets[unXml(nm[1])] = relMap[rid[1]]; }
  const ssx = await get('xl/sharedStrings.xml'), ss = [];
  if (ssx) for (const m of ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(unXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const out = {};
  for (const name of wanted) {
    const path = sheets[name]; if (!path) continue;
    const xml = await get('xl/' + path.replace(/^\/?(xl\/)?/, '')); if (!xml) continue;
    const rows = [];
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attr = c[1], body = c[2]; if (!body) continue;
      const ref = /\br="([A-Z]+)(\d+)"/.exec(attr); if (!ref) continue;
      const t = (/\bt="([^"]+)"/.exec(attr) || [])[1], vm = /<v>([\s\S]*?)<\/v>/.exec(body); let v = null;
      if (t === 'inlineStr') v = unXml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
      else if (vm) v = t === 's' ? ss[+vm[1]] : t === 'str' ? unXml(vm[1]) : t === 'b' ? vm[1] === '1' : t === 'e' ? null : parseFloat(vm[1]);
      if (v === null || (typeof v === 'number' && isNaN(v))) continue;
      const r = +ref[2] - 1; (rows[r] || (rows[r] = []))[colIdx(ref[1])] = v;
    }
    out[name] = Array.from(rows, r => r || []);
  }
  return out;
}
async function importWorkbook(buf) {
  const sh = await readXlsx(buf, ['ab 2020', 'Zeiterfassung', 'Tätigkeiten', 'Gehalt', 'Config']);
  const zs = sh['ab 2020'] || sh['Zeiterfassung'];
  if (!zs) throw new Error('Blatt „ab 2020“ bzw. „Zeiterfassung“ nicht gefunden.');
  const dRows = zs.slice(1).filter(r => typeof r[1] === 'number');
  const aRows = (sh['Tätigkeiten'] || []).slice(1).filter(r => typeof r[2] === 'number');
  const n = x => (typeof x === 'number' ? x : 0);
  const first = dRows[0], k0 = xlDate(first[1]);
  const startSaldo = n(first[9]) - (n(first[8]) - n(first[11]));
  const startUrlaub = k0.slice(5) === '01-01' ? n(first[13]) - S.cfg.urlaubJahr : n(first[13]) + n(first[12]);
  const cfg = Object.assign({}, DEFAULT_CFG, { startDatum: k0, startSaldo, startUrlaub });
  // Config-Blatt: Soll-Wechsel (z. B. Teilzeit bis Datum) und Urlaubsanspruch
  const cs = sh['Config'];
  if (cs && cs[0] && cs[0][8] === 'worktime' && cs[0][9] === 'changedate' && cs[1] && cs[2] && typeof cs[1][8] === 'number' && typeof cs[2][8] === 'number' && typeof cs[1][9] === 'number' && cs[1][8] !== cs[2][8]) {
    cfg.sollAlt = cs[1][8]; cfg.soll = cs[2][8]; cfg.sollWechsel = xlDate(cs[1][9]);
  }
  if (cs && cs[0] && cs[0][6] === 'Urlaub' && cs[1] && typeof cs[1][6] === 'number') cfg.urlaubJahr = cs[1][6];
  const normRaw = raw => (/^krank$/i.test(raw) ? 'krank' : /^urlaub 0,5$/i.test(raw) ? 'Urlaub - halb' : /^urlaub$/i.test(raw) ? 'Urlaub' : raw);
  // häufigstes Thema an Arbeitstagen = Standardthema
  { const cnt = {}; for (const r of dRows) { const raw = normRaw(r[6] == null ? '' : String(r[6]).trim()); if (raw && !E.TYPES[raw] && !/^Relax\//.test(raw)) cnt[raw] = (cnt[raw] || 0) + 1; }
    const top = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0]; if (top && top[1] > dRows.length * 0.3) cfg.standardThema = top[0]; }
  const days = {}; let manual = 0;
  for (const r of dRows) {
    const k = xlDate(r[1]); const raw = normRaw(r[6] == null ? '' : String(r[6]).trim());
    const entry = {}; const s = xlTime(r[2]), e = xlTime(r[3]), a = xlTime(r[5]);
    if (s || e) { entry.s = HM(s); entry.e = HM(e); }
    if (a) entry.a = HM(a);
    const dt = E.defaultType(k, cfg);
    if (/^Relax\//.test(raw)) entry.t = 'Betriebsfrei';
    else if (E.TYPES[raw] && raw !== 'arbeit') { if (raw !== dt) entry.t = raw; }
    else if (raw && raw !== cfg.standardThema) entry.th = raw;
    else if (dt === 'Urlaub - halb' && (s || e)) entry.t = 'arbeit';
    if ((s || e) && e > s) { const d = e - s, p = xlTime(r[4]); if (Math.abs(p - E.autoPause(d)) > 0.02) { entry.p = HM(p); manual++; } }
    if (Object.keys(entry).length) days[k] = entry;
  }
  // Regelvarianten (Verfall 1.5., Kappung 31.10.) gegen die Excel-Werte prüfen, die mit den wenigsten Abweichungen gewinnt
  S = { v: 1, cfg, days, acts: [], pay: {}, demo: false };
  const tKonto = {}, tRest = {}; dRows.forEach(r => { const k = xlDate(r[1]); tKonto[k] = n(r[9]); tRest[k] = n(r[13]); });
  const score = () => { recompute(); let bad = 0, pk = null; for (const row of R.rows) { if (tKonto[row.k] == null) continue; if (row.k.slice(5) === '10-31' || row.k.slice(5) === '11-01') continue; if (pk) { if (Math.abs((row.konto - pk.konto) - (tKonto[row.k] - tKonto[pk.k])) > 0.02) bad++; if (Math.abs((row.rest - pk.rest) - (tRest[row.k] - tRest[pk.k])) > 0.02) bad += 3; } pk = row; } return bad; };
  recompute(); // wandelt „Verfall ab Jahr“ in eine Regel mit Datum um
  const rules = [cfg].concat(cfg.regeln || []), orig = rules.map(r => [r.urlaubVerfall, r.kappungTag]); let best = null;
  const setV = (fv, fk) => rules.forEach((r, i) => { r.urlaubVerfall = fv ? orig[i][0] : ''; r.kappungTag = fk ? orig[i][1] : ''; });
  for (const [fv, fk] of [[1, 1], [0, 1], [1, 0], [0, 0]]) {
    setV(fv, fk); const sc = score(); if (!best || sc < best.sc - 2.5) best = { sc, fv, fk };
  }
  setV(best.fv, best.fk);
  // Excel-Handkorrekturen als Tageskorrektur übernehmen, damit das Zeitkonto exakt passt
  const pay = {}, gs = sh['Gehalt'] || [], gh = gs[0] || [], lindaPay = gh.indexOf('variabler Anteil') >= 0;
  const gRows = gs.slice(1).filter(r => typeof r[0] === 'number'), c2 = x => Math.round(x * 100) / 100;
  const uCol = lindaPay ? 4 : 6;
  let lastU = ''; for (const r of gRows) if (typeof r[uCol] === 'number' && r[uCol] > 0) lastU = xlDate(r[0]).slice(0, 7);
  for (const r of gRows) {
    const ym = xlDate(r[0]).slice(0, 7); if (!lastU || ym > lastU || typeof r[1] !== 'number') continue;
    const e = { b: c2(r[1]), s: c2(n(r[2])) }; if (n(r[uCol]) > 0) e.u = c2(r[uCol]); if (!lindaPay && n(r[5])) e.m = c2(r[5]); pay[ym] = e;
  }
  S.pay = pay;
  let adj = 0;
  for (let g = 0; g < 400; g++) {
    recompute(); const row = R.rows.find(r => tKonto[r.k] != null && Math.abs(r.konto - tKonto[r.k]) > 0.02 && !(cfg.kappungTag && (r.k.slice(5) === cfg.kappungTag || r.k.slice(5) === '11-01')));
    if (!row) break;
    const cur = S.days[row.k] || {}; S.days[row.k] = Object.assign({}, cur, { z: +((cur.z || 0) + tKonto[row.k] - row.konto).toFixed(4) }); adj++;
  }
  // Spalten der Tätigkeiten nach Überschrift erkennen (Reihenfolge egal), sonst die klassischen Positionen
  const hd = ((sh['Tätigkeiten'] || [[]])[0] || []).map(x => String(x == null ? '' : x).trim().toLowerCase());
  const ALIAS = { cat: ['category', 'kategorie'], w: ['work', 'art', 'tätigkeit'], sys: ['system'], pn: ['projektnummer', 'projekt-nr', 'projekt-nr.', 'projekt nr', 'projektnr', 'projekt-nummer', 'project number', 'project no'], th: ['thema', 'topic'] };
  const col = {}; for (const f in ALIAS) { const i = hd.findIndex(h => ALIAS[f].includes(h)); if (i >= 0) col[f] = i; }
  const POS = { cat: 10, w: 11, sys: 12, th: 13 }; for (const f in POS) if (col[f] == null && !(f === 'th' && hd.length > 14 && false)) col[f] = POS[f];
  if (col.pn === col.th || Object.values(col).filter(v => v === col.pn).length > 1) delete col.pn;
  const rawHead = ((sh['Tätigkeiten'] || [[]])[0] || []);
  const sp = {};   // eigene Überschriften (z. B. „Projekte“) als Spaltennamen übernehmen, bekannte Namen nicht
  for (const f of ['cat', 'w', 'sys', 'pn', 'th']) { const h = rawHead[col[f]]; const t = h == null ? '' : String(h).trim(); if (t && !ALIAS[f].includes(t.toLowerCase())) sp[f] = t; }
  const cell = (r, f) => { const v = col[f] == null ? '' : r[col[f]]; if (v == null) return ''; return typeof v === 'number' ? String(Math.round(v) === v ? v : v) : String(v).trim(); };
  S.acts = aRows.map(r => ({ id: newId(), d: xlDate(r[2]), s: HM(xlTime(r[3])), e: HM(xlTime(r[4])), u: xlTime(r[5]) ? HM(xlTime(r[5])) : '', cat: cell(r, 'cat'), w: cell(r, 'w'), sys: cell(r, 'sys'), pn: cell(r, 'pn'), th: cell(r, 'th') }));
  const tipp = ['cat', 'w', 'sys', 'pn'].filter(f => { const vals = S.acts.map(a => a[f]).filter(Boolean); if (vals.length < 20) return false; const c = {}; vals.forEach(v => c[v] = (c[v] || 0) + 1); return Math.max(...Object.values(c)) / vals.length >= 0.85; }).map(f => colN(f));
  S.cfg.pnAn = S.acts.some(a => a.pn); S.cfg.spalten = sp; S.cfg.spaltenAus = {};
  UI.report = { days: Object.keys(S.days).length, acts: S.acts.length, pay: Object.keys(pay).length, adj, manual, tipp, cols: ['cat', 'w', 'sys', 'pn', 'th'].filter(f => col[f] != null).map(f => colN(f)).join(', '), from: k0, to: xlDate(dRows[dRows.length - 1][1]), rules: best.sc };
  commit(false);
}
function exportJSON() { return JSON.stringify({ app: 'stundenkonto', v: 1, exported: new Date().toISOString(), cfg: S.cfg, days: S.days, acts: S.acts, pay: S.pay || {} }); }
function importJSON(txt) {
  const o = JSON.parse(txt); if (o.app !== 'stundenkonto') throw new Error('Das ist keine Stundenkonto-Sicherung.');
  S = { v: 1, cfg: Object.assign({}, DEFAULT_CFG, o.cfg), days: o.days || {}, acts: o.acts || [], pay: o.pay || {}, demo: false };
  UI.report = { days: Object.keys(S.days).length, acts: S.acts.length, pay: Object.keys(S.pay).length, adj: 0, manual: 0, from: S.cfg.startDatum, to: '' };
  commit(false);
}
const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
function exportCSV() {
  const head = ['Datum', 'KW', 'Von', 'Bis', 'Unterbrechung', 'Netto h', ...['cat', 'w', 'sys', 'pn'].filter(colOn).map(colN), colN('th')].map(h => I18N.tx(h));
  const lines = [head.join(';')];
  for (const a of S.acts.slice().sort((x, y) => (x.d + x.s).localeCompare(y.d + y.s))) {
    const net = a.e ? (H(a.e) - H(a.s) - H(a.u)) : 0;
    lines.push([a.d, E.isoWeek(a.d), a.s, a.e, a.u, fmtDec(net), ...['cat', 'w', 'sys', 'pn'].filter(colOn).map(f => a[f] || ''), a.th].map(csvCell).join(';'));
  }
  return '﻿' + lines.join('\r\n');
}
async function saveFile(filename, data, type) {
  try {
    const dl = await window.claude?.use?.('downloads');
    if (!dl) throw new Error('nicht verfügbar');
    await dl.save({ filename, data });
    toast('Datei bereit: ' + filename);
  } catch (e) {
    try { const b = new Blob([data], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    catch (e2) { toast('Speichern der Datei nicht möglich.'); }
  }
}
let toastT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }
