// Baustellen-Chef – Oberfläche & Ablaufsteuerung
import { LEVEL, GEWERKE, FIRMEN, NEBENKOSTEN, KONTAKT_URL } from './data.js';
import * as G from './game.js';

const $ = (sel) => document.querySelector(sel);
const eur = G.eur;
const ICON = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const EV_ICON = {
  regen: 'M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6zM8 18l-1 3M12 18l-1 3M16 18l-1 3',
  kran: 'M6 21V4h2v17M6 4h14M8 7l10-3M17 4v6M15 10h4v3h-4zM3 21h8',
  boden: 'M3 9h18M3 9l2 4h14l2-4M6 13l-1 8M18 13l1 8M9 17h6',
  lkw: 'M2 7h11v9H2zM13 10h4l3 3v3h-7zM6 18a1.5 1.5 0 1 0 0 .1M17 18a1.5 1.5 0 1 0 0 .1',
  preis: 'M4 18l6-6 4 4 6-8M20 8v5M20 8h-5',
  nachtrag: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  mangel: 'M12 3l10 18H2zM12 10v5M12 18v.1',
  estrich: 'M3 17h18M5 17V9h14v8M9 6c0-2 2-2 2-4M13 6c0-2 2-2 2-4',
};

let s = null;
let szene = null;
let tab = 'ablauf';
let modalOffen = false;
let letzterFokus = null;

// ---------- 3D ----------
async function starteSzene() {
  const schwach = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
  try {
    const { erstelleSzene } = await import('./scene.js');
    szene = erstelleSzene($('#c3d'), { qualitaet: schwach ? 'sparsam' : 'hoch', onQualitaet: grafikLabel });
    grafikLabel(szene.qualitaet);
  } catch (e) {
    console.warn('3D nicht verfügbar', e);
    $('#fallback').hidden = false; $('#btn-grafik').hidden = true;
  }
  const hint = $('#dreh-hint');
  const weg = () => { hint.style.opacity = 0; };
  $('#c3d').addEventListener('pointerdown', weg, { once: true });
  setTimeout(weg, 9000);
}
function grafikLabel(q) { $('#btn-grafik').textContent = 'Grafik: ' + (q === 'hoch' ? 'Hoch' : 'Sparsam'); }
$('#btn-grafik').addEventListener('click', () => { if (!szene) return; szene.setzeQualitaet(szene.qualitaet === 'hoch' ? 'sparsam' : 'hoch'); grafikLabel(szene.qualitaet); });

function szeneSync(sofort = false) {
  if (!szene || !s) return;
  const f = {}, aktiv = {};
  for (const g of GEWERKE) { const st = s.g[g.id]; f[g.id] = st.status === 'offen' ? 0 : st.status === 'laeuft' ? st.fortschritt : 1; if (st.status === 'laeuft' || st.status === 'nacharbeit') aktiv[g.id] = st.status === 'laeuft' ? st.trupps : 1; }
  if (sofort) szene.springe(f); else szene.setze(f, aktiv);
  szene.setze(f, aktiv);
  szene.wetter(s.wetter);
  szene.kranDefekt(s.kranDefekt && !s.kranErsatz);
  const w = $('#wetter');
  if (s.wetter === 'regen') { w.hidden = false; w.textContent = s.regenSchutz ? 'Regen · Wetterschutz aufgebaut' : 'Regenwoche'; }
  else if (s.kranDefekt && !s.kranErsatz) { w.hidden = false; w.textContent = 'Kran defekt – Stillstand'; }
  else w.hidden = true;
}

// ---------- Rendering ----------
function render() {
  if (!s) return;
  const p = G.prognose(s);
  if (s.fertig) { p.gesamt = s.ausgegeben; p.endWoche = s.endeWoche; }
  const budget = LEVEL.budget + s.budgetPlus;
  // HUD
  $('#hud-woche strong').textContent = `Woche ${s.fertig ? s.endeWoche : s.woche}`;
  const spaet = p.endWoche > s.versprochen;
  $('#hud-woche em').innerHTML = `Ziel Wo. ${s.versprochen} · ${matchMedia("(max-width: 860px)").matches ? "Prog." : "Prognose"} <span class="${spaet ? 'q-schlecht' : 'q-gut'}">Wo. ${p.endWoche}</span>`;
  const max = Math.max(budget, p.gesamt) * 1.02;
  $('#hud-geld .ist').style.width = (100 * s.ausgegeben) / max + '%';
  $('#hud-geld .prog').style.width = (100 * p.gesamt) / max + '%';
  $('#hud-geld .geldbalken').classList.toggle('ueber', p.gesamt > budget);
  $('#hud-geld strong').innerHTML = `${eur(s.ausgegeben)} · <span class="${p.gesamt > budget ? 'q-schlecht' : 'q-gut'}">${eur(p.gesamt)}</span> · ${eur(budget)}`;
  const q = Math.round(s.quali);
  $('#hud-quali strong').innerHTML = `<span class="${q >= 90 ? 'q-gut' : q >= 70 ? 'q-mittel' : 'q-schlecht'}">${q}</span> / 100`;

  renderTipp(p);
  if (tab === 'ablauf') renderAblauf(p);
  if (tab === 'kosten') renderKosten(p);
  if (tab === 'tagebuch') renderLog();
  const laeuft = GEWERKE.some((g) => ['laeuft', 'nacharbeit'].includes(s.g[g.id].status));
  const btn = $('#btn-woche');
  btn.disabled = s.fertig || modalOffen;
  btn.innerHTML = s.fertig ? 'Haus übergeben ✓' : laeuft ? `Woche ${s.woche} beenden <span aria-hidden="true">›</span>` : `Woche ${s.woche} abwarten <span aria-hidden="true">›</span>`;
}

function renderTipp(p) {
  const t = $('#tipp');
  if (s.fertig) { t.innerHTML = ''; return; }
  const startbar = GEWERKE.filter((g) => G.kannStarten(s, g.id));
  if (startbar.length) { t.innerHTML = `<b>Jetzt</b><span>Material ist da – erst mit einem Auftrag wird gebaut. ${startbar.map((g) => `<button class="btn btn-klein puls" data-start="${g.id}">${g.kurz} beauftragen</button>`).join(' ')}</span>`; return; }
  // Bestellen nötig?
  for (const g of GEWERKE) {
    const st = s.g[g.id];
    if (st.bestellt || st.status !== 'offen') continue;
    const frueh = Math.max(s.woche, ...g.nach.map((d) => (p.ende[d] || 0) + 1));
    if (frueh - s.woche <= g.liefer + 1) { t.innerHTML = `<b>Tipp</b><span>Material für <strong>${g.kurz}</strong> bestellen – Lieferzeit ${g.liefer} Woche${g.liefer === 1 ? '' : 'n'}.</span>`; return; }
  }
  const laeuft = GEWERKE.filter((g) => s.g[g.id].status === 'laeuft');
  if (laeuft.length) { t.innerHTML = `<b>Tipp</b><span>Es wird gebaut: ${laeuft.map((g) => g.kurz).join(', ')}. Mehr Trupps = schneller, aber teurer.</span>`; return; }
  const warte = GEWERKE.find((g) => s.g[g.id].bestellt && !G.materialDa(s, g.id));
  if (warte) { t.innerHTML = `<b>Achtung</b><span>Baustelle wartet auf Material für ${warte.kurz} (Woche ${s.g[warte.id].bestellt.ankunft}). Jede Woche Stillstand kostet trotzdem Geld.</span>`; return; }
  t.innerHTML = '';
}

function statusInfo(g) {
  const st = s.g[g.id];
  if (st.status === 'fertig') return ['fertig', `fertig · ${eur(st.mat + st.lohn + st.extra)}`];
  if (st.status === 'laeuft') return ['laeuft', `läuft · ${Math.round(st.fortschritt * 100)} %`];
  if (st.status === 'nacharbeit') return ['warn', 'Nacharbeit'];
  if (st.status === 'abnahme') return ['warn', 'Abnahme'];
  if (!G.abhaengigFertig(s, g.id)) return ['', 'wartet'];
  return ['', 'bereit'];
}

function renderAblauf(p) {
  const el = $('#tab-ablauf');
  el.innerHTML = GEWERKE.map((g) => {
    const st = s.g[g.id];
    const [cls, txt] = statusInfo(g);
    const gesperrt = !G.abhaengigFertig(s, g.id) && st.status === 'offen';
    let koerper = '';
    if (st.status === 'offen') {
      const fehlt = g.nach.filter((d) => s.g[d].status !== 'fertig').map((d) => G.GW[d].kurz);
      let mat;
      if (!st.bestellt) {
        mat = `<div class="zeile"><span class="muted">Material ${eur(G.materialPreis(s, g.id, false))} · Lieferzeit ${g.liefer === 0 ? 'sofort' : g.liefer + ' Wo.'}</span><span class="spacer"></span>
          <button class="btn btn-zweit btn-klein" data-bestell="${g.id}">Bestellen</button>
          ${g.liefer > 1 ? `<button class="btn btn-zweit btn-klein" data-express="${g.id}" title="Express: halbe Lieferzeit, +10 %">Express</button>` : ''}</div>`;
      } else if (!G.materialDa(s, g.id)) {
        mat = `<div class="zeile"><span class="warn-t">Material unterwegs – Lieferung Woche ${st.bestellt.ankunft}</span></div>`;
      } else mat = `<div class="zeile"><span class="ok">✓ Material ist da</span></div>`;
      const start = `<div class="zeile"><span class="muted">${fehlt.length ? 'Wartet auf: ' + fehlt.join(', ') : 'Vorarbeiten erledigt'}</span><span class="spacer"></span>
        <button class="btn btn-klein ${G.kannStarten(s, g.id) ? 'puls' : ''}" data-start="${g.id}" ${G.kannStarten(s, g.id) ? '' : 'disabled'}>Beauftragen</button></div>`;
      koerper = mat + start;
    } else if (st.status === 'laeuft') {
      const rate = G.tempo(g, st.trupps, st.firma);
      const rest = Math.ceil((1 - st.fortschritt) / rate - 1e-6);
      const wocheLohn = G.lohnProWoche(g, st.trupps, st.firma);
      koerper = `<div class="zeile"><span class="muted">${FIRMEN[st.firma].name}</span><span class="spacer"></span><span class="muted">noch ca. ${rest} Wo. · ${eur(Math.round(wocheLohn / 10) * 10)}/Wo.</span></div>
        <div class="zeile"><span>Trupps</span><span class="stepper"><button data-tr="${g.id}" data-d="-1" ${st.trupps <= 1 ? 'disabled' : ''} aria-label="Weniger Trupps">−</button><span>${st.trupps} ${st.trupps > g.std ? '(Hetze)' : st.trupps < g.std ? '(knapp)' : '(Standard)'}</span><button data-tr="${g.id}" data-d="1" ${st.trupps >= g.std + 1 ? 'disabled' : ''} aria-label="Mehr Trupps">+</button></span></div>
        <div class="balken"><i style="width:${st.fortschritt * 100}%"></i></div>`;
    } else if (st.status === 'nacharbeit') {
      koerper = `<div class="zeile warn-t">Firma bessert nach – noch ${st.nacharbeit} Woche${st.nacharbeit > 1 ? 'n' : ''}.</div>`;
    }
    return `<article class="gw ${st.status} ${gesperrt ? 'gesperrt' : ''}">
      <div class="gw-kopf"><div class="gw-icon">${ICON(g.icon)}</div><div class="gw-titel"><h3>${g.name}</h3><small>Plan: ${eur(g.kosten)} · ${g.dauer} Wo.</small></div><span class="status ${cls}">${txt}</span></div>
      ${koerper ? `<div class="gw-koerper">${koerper}</div>` : ''}</article>`;
  }).join('');
}

function renderKosten(p) {
  const budget = LEVEL.budget + s.budgetPlus;
  const plan = G.planWerte();
  const zins = (s.ausgegeben * LEVEL.zinsSatz) / 52;
  const zeilen = [
    ...GEWERKE.map((g) => { const st = s.g[g.id]; return [g.kurz, g.kosten, st.mat + st.lohn + st.extra]; }),
    ['Nebenkosten', plan.neben, s.posten.neben],
    ['Baustelleneinrichtung', plan.baustelle, s.posten.baustelle],
    ['Bauzeitzinsen', plan.zinsen, s.posten.zinsen],
    ['Doppelte Miete (Verzug)', 0, s.posten.miete],
    ['Nachträge', 0, s.posten.nachtrag],
  ];
  $('#tab-kosten').innerHTML = `
    <div class="kpi">
      <div><small>Budget</small><strong>${eur(budget)}</strong></div>
      <div><small>Bisher bezahlt</small><strong>${eur(s.ausgegeben)}</strong></div>
      <div><small>Prognose gesamt</small><strong class="${p.gesamt > budget ? 'plus' : 'minus'}">${eur(p.gesamt)}</strong></div>
      <div><small>Prognose Übergabe</small><strong>Woche ${p.endWoche}</strong></div>
    </div>
    <table class="liste"><thead><tr><th>Posten</th><th>Plan</th><th>bisher</th></tr></thead><tbody>
      ${zeilen.map(([n, pl, ist]) => `<tr><td>${n}</td><td>${eur(pl)}</td><td>${eur(ist)}</td></tr>`).join('')}
      <tr class="summe"><td>Summe</td><td>${eur(plan.gesamt)}</td><td>${eur(s.ausgegeben)}</td></tr>
    </tbody></table>
    <div class="erklaer"><h3>Warum kostet Zeit Geld?</h3>
      Jede Bauwoche kostet – auch wenn nichts vorangeht: Baustelleneinrichtung ${eur(LEVEL.baustelleProWoche)}, Bauzeitzinsen aktuell ca. ${eur(zins)}${s.woche > s.versprochen ? ` und ${eur(LEVEL.mieteProWoche)} doppelte Miete der Bauherren` : ''} pro Woche. Die Zinsen steigen, je mehr Geld schon verbaut ist.</div>
    <div class="erklaer"><h3>Nebenkosten – oft vergessen</h3>
      ${NEBENKOSTEN.map((n) => `${n.name}: ${eur(n.betrag)}`).join(' · ')}. Zusammen rund ${Math.round((plan.neben / plan.gesamt) * 100)} % der Gesamtkosten – noch ohne Grundstück, Grunderwerbsteuer und Notar.</div>
    <p class="hinweis-klein">Spielwerte, kein Angebot. Gerundete Beispielzahlen 2026 inkl. MwSt.</p>`;
}

function renderLog() {
  $('#tab-tagebuch').innerHTML = `<ul class="log">${s.log.map((l) => `<li class="${l.typ}"><b>Wo. ${l.woche}</b><span>${l.text}</span></li>`).join('')}</ul>`;
}

// ---------- Interaktion ----------
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
  ['ablauf', 'kosten', 'tagebuch'].forEach((t) => ($('#tab-' + t).hidden = t !== tab));
  render();
}));

$('#tab-ablauf').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.bestell) { G.bestelle(s, b.dataset.bestell, false); if (G.GW[b.dataset.bestell].liefer === 0) szene && szene.lieferung(); render(); }
  else if (b.dataset.express) { G.bestelle(s, b.dataset.express, true); render(); }
  else if (b.dataset.start) firmenDialog(b.dataset.start);
  else if (b.dataset.tr) { const st = s.g[b.dataset.tr]; G.setzeTrupps(s, b.dataset.tr, st.trupps + Number(b.dataset.d)); szeneSync(); render(); }
});

$('#tipp').addEventListener('click', (e) => { const b = e.target.closest('[data-start]'); if (b) firmenDialog(b.dataset.start); });

$('#btn-woche').addEventListener('click', () => {
  if (!s || s.fertig || modalOffen) return;
  const laeuft = GEWERKE.some((g) => ['laeuft', 'nacharbeit'].includes(s.g[g.id].status));
  const startbar = GEWERKE.filter((g) => G.kannStarten(s, g.id));
  if (!laeuft && startbar.length) {
    oeffneModal(`<div class="eyebrow">Achtung</div><h2 id="modal-titel">Auf der Baustelle arbeitet niemand!</h2>
      <p>Das Material für <b>${startbar.map((g) => g.kurz).join(' und ')}</b> ist da – aber noch keine Firma beauftragt. Ohne Auftrag wächst das Haus nicht, die Woche kostet trotzdem Geld (Baustelle und Zinsen).</p>
      <div class="optionen">${startbar.map((g) => `<button class="option" data-jetzt="${g.id}"><b>${g.kurz} jetzt beauftragen</b><small>Firma und Trupps wählen</small></button>`).join('')}
      <button class="option" id="trotzdem"><b>Trotzdem eine Woche warten</b><small>kostet ca. ${eur(LEVEL.baustelleProWoche + (s.ausgegeben * LEVEL.zinsSatz) / 52)}</small></button></div>`);
    $('#modal-inhalt').querySelectorAll('[data-jetzt]').forEach((b) => b.addEventListener('click', () => { schliesseModal(); firmenDialog(b.dataset.jetzt); }));
    $('#trotzdem').addEventListener('click', () => { schliesseModal(); G.endeWoche(s); nachWoche(); });
    return;
  }
  G.endeWoche(s);
  nachWoche();
});

function nachWoche() {
  for (const m of s.meldungen) { toast(m.text, m.typ === 'fertig' ? 'gut' : ''); if (m.typ === 'lieferung') szene && szene.lieferung(); }
  s.meldungen = [];
  szeneSync();
  render();
  if (s.fertig) { setTimeout(endabrechnung, 1600); return; }
  zeigeQueue();
}

function zeigeQueue() {
  if (!s.queue.length) { if (G.pruefeFertig(s)) { szeneSync(); render(); setTimeout(endabrechnung, 1200); } return; }
  const ev = s.queue.shift();
  oeffneModal(`
    <div class="eyebrow">Woche ${s.woche} · Ereignis</div>
    <div class="ev-kopf"><div class="ev-bild">${ICON(EV_ICON[ev.bild] || EV_ICON.mangel)}</div><div><h2 id="modal-titel">${ev.titel}</h2><p>${ev.text}</p></div></div>
    <div class="lehre"><b>Gut zu wissen:</b> ${ev.lehre}</div>
    <div class="optionen">${ev.optionen.map((o, i) => `<button class="option" data-i="${i}"><b>${o.label}</b>${o.info ? `<small>${o.info}</small>` : ''}</button>`).join('')}</div>`);
  $('#modal-inhalt').querySelectorAll('.option').forEach((b) => b.addEventListener('click', () => {
    ev.optionen[Number(b.dataset.i)].aktion();
    schliesseModal();
    szeneSync(); render();
    zeigeQueue();
  }));
}

function firmenDialog(id) {
  const g = G.GW[id];
  let firma = 'meister', trupps = g.std;
  const lohn = (f, n) => G.lohnGesamt(g, n, f);
  const wochen = (f, n) => Math.ceil(1 / G.tempo(g, n, f) - 1e-6);
  const risiko = (f) => { const m = FIRMEN[f].mangel; return m > 0.3 ? 'hoch' : m > 0.08 ? 'mittel' : 'gering'; };
  const zeichne = () => {
    oeffneModal(`
      <div class="eyebrow">Auftrag vergeben</div>
      <h2 id="modal-titel">${g.name}</h2>
      <p class="muted">${g.tipp}</p>
      <h3 style="font-size:16px">Welche Firma?</h3>
      <div class="firmen">${Object.entries(FIRMEN).map(([k, f]) => `<button class="option ${k === firma ? 'gewaehlt' : ''}" data-firma="${k}"><b>${f.name}</b><small>Lohn ca. ${eur(Math.round(lohn(k, trupps) / 100) * 100)} · ${wochen(k, trupps)} Wo. · Mängelrisiko ${risiko(k)}</small></button>`).join('')}</div>
      <h3 style="font-size:16px">Wie viele Trupps?</h3>
      <div class="truppwahl">${Array.from({ length: g.std + 1 }, (_, i) => i + 1).map((n) => `<button class="option ${n === trupps ? 'gewaehlt' : ''}" data-trupps="${n}"><b>${n} Trupp${n > 1 ? 's' : ''}</b><small>${n < g.std ? 'knapp – günstiger, langsamer' : n > g.std ? 'Hetze – schneller, teurer, mehr Fehler' : 'Standard'}<br>${wochen(firma, n)} Wo. · ${eur(Math.round(lohn(firma, n) / 100) * 100)}</small></button>`).join('')}</div>
      <div class="aktionen"><button class="btn btn-zweit" id="abbrechen">Abbrechen</button><button class="btn" id="beauftragen">Beauftragen</button></div>`);
    const box = $('#modal-inhalt');
    box.querySelectorAll('[data-firma]').forEach((b) => b.addEventListener('click', () => { firma = b.dataset.firma; zeichne(); box.querySelector(`[data-firma="${firma}"]`).focus(); }));
    box.querySelectorAll('[data-trupps]').forEach((b) => b.addEventListener('click', () => { trupps = Number(b.dataset.trupps); zeichne(); box.querySelector(`[data-trupps="${trupps}"]`).focus(); }));
    $('#abbrechen').addEventListener('click', () => { schliesseModal(); render(); });
    $('#beauftragen').addEventListener('click', () => { G.starte(s, id, firma, trupps); schliesseModal(); toast(`${g.kurz} beauftragt.`); szeneSync(); render(); });
  };
  zeichne();
}

// ---------- Modal mit Fokusfalle ----------
function oeffneModal(html, breit = false) {
  if (!modalOffen) letzterFokus = document.activeElement;
  modalOffen = true;
  const m = $('#modal'), box = m.querySelector('.modal-box');
  box.classList.toggle('breit', breit);
  $('#modal-inhalt').innerHTML = html;
  m.hidden = false;
  box.scrollTop = 0;
  const erstes = box.querySelector('button, a[href]');
  (erstes || box).focus({ preventScroll: true });
  $('#btn-woche').disabled = true;
}
function schliesseModal() {
  modalOffen = false; $('#modal').hidden = true;
  if (letzterFokus && document.contains(letzterFokus)) letzterFokus.focus({ preventScroll: true });
}
document.addEventListener('keydown', (e) => {
  if (!modalOffen || e.key !== 'Tab') return;
  const f = [...$('#modal').querySelectorAll('button:not([disabled]), a[href]')];
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
});

function toast(text, cls = '') {
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = text;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4300);
}

// ---------- Intro & Ende ----------
function intro() {
  const plan = G.planWerte();
  let puffer = false;
  const zeichne = () => oeffneModal(`
    <div class="eyebrow">Ein Spiel von DienerHaus</div>
    <h2 id="modal-titel">Baustellen-Chef</h2>
    <p>Du bist Bauleiter/in. ${LEVEL.bauherr} baut ein <b>${LEVEL.titel}</b> (${LEVEL.untertitel}). Dein Job: das Haus <b>pünktlich</b>, <b>im Budget</b> und <b>in guter Qualität</b> übergeben.</p>
    <div class="ziele">
      <div><b>Termin</b>Plan: ${LEVEL.planWochen} Bauwochen</div>
      <div><b>Budget</b>${eur(LEVEL.budget)} ohne Grundstück</div>
      <div><b>Qualität</b>wenig Mängel, zufriedene Bauherren</div>
    </div>
    <ol class="schritte">
      <li><b>Material bestellen</b> – mit Lieferzeit. Fenster brauchen Wochen!</li>
      <li><b>Beauftragen</b> – ist das Material da, auf „Beauftragen“ tippen und eine Firma wählen. <b>Erst dann wird gebaut!</b></li>
      <li><b>Woche beenden</b> – dann wird gebaut, bezahlt und es passiert etwas.</li>
      <li><b>Entscheiden</b> – Regen, Lieferverzug, Wünsche der Bauherren …</li>
    </ol>
    <h3 style="font-size:16px;margin-bottom:6px">Welchen Übergabetermin versprichst du?</h3>
    <div class="optionen">
      <button class="option ${!puffer ? 'gewaehlt' : ''}" data-p="0"><b>Woche ${LEVEL.planWochen + 1} – knapp geplant</b><small>Bauherren begeistert, wenn es klappt</small></button>
      <button class="option ${puffer ? 'gewaehlt' : ''}" data-p="1"><b>Woche ${LEVEL.planWochen + 4} – mit Zeitpuffer</b><small>sicherer, weniger Bonus</small></button>
    </div>
    <div class="aktionen" style="margin-top:16px"><button class="btn btn-gross" id="los">Baustelle eröffnen</button></div>
    <p class="hinweis-klein"><b>Spielwerte, kein Angebot:</b> Die Zahlen sind gerundete, realistische Beispielwerte für 2026 (Plan gesamt ca. ${eur(Math.round(plan.gesamt / 1000) * 1000)} inkl. Nebenkosten). Jedes echte Haus kostet anders. Das Haus im Spiel ist frei erfunden.</p>`);
  zeichne();
  const bind = () => {
    $('#modal-inhalt').querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { puffer = b.dataset.p === '1'; zeichne(); bind(); $(`[data-p="${b.dataset.p}"]`).focus(); }));
    $('#los').addEventListener('click', () => {
      schliesseModal();
      s = G.neuesSpiel({ puffer });
      if (new URLSearchParams(location.search).has('debug')) window.bc = { get s() { return s; }, G, nachWoche, zeigeQueue };
      szeneSync(true); render();
      toast('Baustelle eröffnet – bestelle das erste Material.');
    });
  };
  bind();
}

function sterne(n) { return '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`; }

function endabrechnung() {
  const a = G.abrechnung(s);
  szene && szene.finale(true);
  const gesamtSterne = a.sterne.zeit + a.sterne.kosten + a.sterne.quali;
  const urteil = gesamtSterne >= 8 ? 'Meisterhaft gebaut!' : gesamtSterne >= 6 ? 'Gut gemacht, Chef!' : gesamtSterne >= 4 ? 'Geschafft – mit Lehrgeld.' : 'Das Haus steht – aber es war teuer.';
  const lernen = [];
  const verzug = a.wochen - LEVEL.planWochen;
  if (verzug > 0) lernen.push(`${verzug} Woche${verzug > 1 ? 'n' : ''} länger als geplant – das hat allein an Baustelle, Zinsen und Miete rund ${eur(verzug * (LEVEL.baustelleProWoche + 250) + s.posten.miete)} gekostet.`);
  else lernen.push('Im Zeitplan geblieben – das spart Baustellenkosten, Zinsen und doppelte Miete.');
  if (s.posten.nachtrag > 0) lernen.push(`Änderungswünsche haben ${eur(s.posten.nachtrag)} gekostet. Je früher sie feststehen, desto günstiger.`);
  const guenstig = GEWERKE.filter((g) => s.g[g.id].firma === 'guenstig').length;
  if (guenstig) lernen.push(`${guenstig}× günstiger Subunternehmer: Der Preis sinkt, aber Mängel kosten Zeit oder Qualität.`);
  const ausreisser = a.zeilen.filter((z) => z.plan > 0).map((z) => ({ ...z, d: z.ist - z.plan })).sort((x, y) => y.d - x.d)[0];
  if (ausreisser && ausreisser.d > 1000) lernen.push(`Größte Abweichung: ${ausreisser.name.split(' (')[0]} mit +${eur(ausreisser.d)} gegenüber dem Plan.`);
  lernen.push(`Die Nebenkosten (${eur(s.posten.neben)}) und die Außenanlagen werden in echten Budgets oft vergessen.`);

  oeffneModal(`
    <div class="eyebrow">Schlüsselübergabe · Woche ${a.wochen}</div>
    <h2 id="modal-titel">${urteil}</h2>
    <p>Das ${LEVEL.titel} ist fertig. Hier ist deine Endabrechnung – Plan gegen Ist.</p>
    <div class="sterne">
      <div><small>Zeit</small><div class="st">${sterne(a.sterne.zeit)}</div><b>${a.wochen} von ${LEVEL.planWochen} Wo.</b></div>
      <div><small>Kosten</small><div class="st">${sterne(a.sterne.kosten)}</div><b>${eur(a.ist)}</b><small>Budget ${eur(a.budget)}</small></div>
      <div><small>Qualität</small><div class="st">${sterne(a.sterne.quali)}</div><b>${a.quali} / 100</b></div>
    </div>
    <table class="liste"><thead><tr><th>Gewerk / Posten</th><th>Plan</th><th>Ist</th><th>Diff.</th></tr></thead><tbody>
      ${a.zeilen.map((z) => { const d = z.ist - z.plan; return `<tr><td>${z.name}${z.firma ? `<br><small class="muted">${FIRMEN[z.firma].name}</small>` : ''}</td><td>${eur(z.plan)}</td><td>${eur(z.ist)}</td><td class="${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">${d === 0 ? '–' : (d > 0 ? '+' : '') + eur(d)}</td></tr>`; }).join('')}
      <tr class="summe"><td>Gesamt${s.budgetPlus ? ' (Plan inkl. Nachträge)' : ''}</td><td>${eur(a.plan)}</td><td>${eur(a.ist)}</td><td class="${a.ist > a.plan ? 'plus' : 'minus'}">${(a.ist - a.plan > 0 ? '+' : '') + eur(a.ist - a.plan)}</td></tr>
    </tbody></table>
    <h3 style="font-size:17px;margin-top:18px">Was du gelernt hast</h3>
    <ul class="lernen">${lernen.map((l) => `<li>${l}</li>`).join('')}</ul>
    <div class="cta"><div><h3>Echtes Projekt? Sprich mit uns.</h3><p>Planung, Kosten und Bauzeit für dein Haus – ehrlich gerechnet.</p></div><a class="btn" href="${KONTAKT_URL}" id="cta-link">Kontakt aufnehmen</a></div>
    <div class="aktionen"><button class="btn btn-zweit" id="ansehen">Haus ansehen</button><button class="btn" id="nochmal">Nochmal spielen</button></div>
    <p class="hinweis-klein"><b>Spielwerte, kein Angebot.</b> Alle Beträge sind gerundete Beispielwerte (2026, inkl. MwSt., ohne Grundstück) und keine Kalkulation oder Preisangabe von DienerHaus. Das Haus ist frei erfunden.</p>`, true);
  $('#nochmal').addEventListener('click', () => location.reload());
  $('#ansehen').addEventListener('click', () => { schliesseModal(); ansehenLeiste(); });
}

function ansehenLeiste() {
  $('#tipp').innerHTML = '<b>Fertig!</b><span>Dreh dein Haus in Ruhe. <button class="linkbtn" id="zur-abrechnung">Endabrechnung zeigen</button></span>';
  $('#zur-abrechnung').addEventListener('click', endabrechnung);
}

$('#btn-hilfe').addEventListener('click', () => {
  if (modalOffen) return;
  oeffneModal(`<div class="eyebrow">Spielanleitung</div><h2 id="modal-titel">So spielst du</h2>
    <ol class="schritte">
      <li>Jede Runde ist eine <b>Bauwoche</b>. Mit „Woche beenden“ wird gebaut und bezahlt.</li>
      <li>Ein Gewerk startet nur, wenn die <b>Vorarbeiten fertig</b> sind und das <b>Material da</b> ist.</li>
      <li><b>Firma:</b> günstig = weniger Lohn, aber Pfusch-Risiko. Premium = teurer, schneller, sorgfältig.</li>
      <li><b>Trupps:</b> mehr Leute = schneller, aber teurer und fehleranfälliger. Weniger = günstiger, aber länger.</li>
      <li>Jede Woche kostet Geld: <b>Baustelleneinrichtung und Bauzeitzinsen</b>. Nach dem versprochenen Termin zahlen die Bauherren zusätzlich <b>doppelte Miete</b>.</li>
      <li>Am Ende gibt es <b>Sterne</b> für Zeit, Kosten und Qualität.</li>
    </ol>
    <p class="hinweis-klein">Spielwerte, kein Angebot. Keine Cookies, kein Tracking – das Spiel läuft komplett in deinem Browser.</p>
    <div class="aktionen"><button class="btn" id="ok">Weiterbauen</button></div>`);
  $('#ok').addEventListener('click', () => { schliesseModal(); render(); });
});

starteSzene();
intro();
