// Baustellen-Chef – Spielkern (ohne Grafik/DOM). Rundenbasiert, eine Runde = eine Bauwoche.
import { LEVEL, NEBENKOSTEN, GEWERKE, FIRMEN, ZEIT_STERNE, QUALI_STERNE } from './data.js';

const R = Math.random;
const rund = (x, s = 100) => Math.round(x / s) * s;

export const GW = Object.fromEntries(GEWERKE.map((g) => [g.id, g]));

// Lohn für das ganze Gewerk: mehr Trupps behindern sich gegenseitig (leicht höhere Gesamtstunden)
export function lohnGesamt(g, trupps, firma) { return g.kosten * (1 - g.mat) * FIRMEN[firma].preis * Math.pow(trupps / g.std, 0.15); }
export function lohnProWoche(g, trupps, firma) { return tempo(g, trupps, firma) * lohnGesamt(g, trupps, firma); }
export function tempo(g, trupps, firma) { return (FIRMEN[firma].tempo * Math.pow(trupps / g.std, 0.85)) / g.dauer; }

export function neuesSpiel({ puffer }) {
  const s = {
    woche: 1,
    puffer,
    versprochen: LEVEL.planWochen + (puffer ? 4 : 1),
    quali: 85,
    preisIndex: 1,
    ausgegeben: 0,
    budgetPlus: 0,
    posten: { neben: 0, baustelle: 0, zinsen: 0, miete: 0, nachtrag: 0 },
    g: {},
    wetter: 'sonne', regenSchutz: false, kranDefekt: false, kranErsatz: false,
    zaehler: {},
    queue: [],
    meldungen: [],
    log: [],
    flags: {},
    fertig: false,
    endeWoche: null,
  };
  for (const g of GEWERKE) {
    s.g[g.id] = { status: 'offen', fortschritt: 0, trupps: g.std, firma: null, bestellt: null, mat: 0, lohn: 0, extra: 0, nacharbeit: 0, start: null, ende: null };
  }
  for (const n of NEBENKOSTEN) if (n.wann === 'start') zahle(s, n.betrag, 'neben');
  log(s, 'Planung, Statik, Gutachten und Genehmigung sind bezahlt – es kann losgehen.');
  beginWoche(s);
  return s;
}

function log(s, text, typ = 'info') { s.log.unshift({ woche: s.woche, text, typ }); }
function zahle(s, betrag, posten, gid, art = 'extra') {
  betrag = Math.round(betrag);
  s.ausgegeben += betrag;
  if (gid) s.g[gid][art] += betrag; else s.posten[posten] += betrag;
}
function aktiv(s, id) { return s.g[id].status === 'laeuft'; }
function fertigG(s, id) { return s.g[id].status === 'fertig'; }

// ---------- Aktionen des Spielers ----------
export function materialDa(s, id) { const b = s.g[id].bestellt; return !!b && b.ankunft <= s.woche; }
export function abhaengigFertig(s, id) { return GW[id].nach.every((d) => fertigG(s, d)); }
export function kannStarten(s, id) { return s.g[id].status === 'offen' && abhaengigFertig(s, id) && materialDa(s, id); }
export function materialPreis(s, id, express) { const g = GW[id]; return rund(g.kosten * g.mat * s.preisIndex * (express ? 1.1 : 1)); }
export function lieferzeit(id, express) { const l = GW[id].liefer; return express ? Math.ceil(l / 2) : l; }

export function bestelle(s, id, express = false) {
  const st = s.g[id];
  if (st.bestellt) return;
  const betrag = materialPreis(s, id, express);
  st.bestellt = { ankunft: s.woche + lieferzeit(id, express), betrag, express };
  zahle(s, betrag, null, id, 'mat');
  log(s, `Material für ${GW[id].kurz} bestellt${express ? ' (Express)' : ''}: ${eur(betrag)}, Lieferung Woche ${st.bestellt.ankunft}.`);
}

export function starte(s, id, firma, trupps) {
  if (!kannStarten(s, id)) return false;
  const st = s.g[id];
  Object.assign(st, { status: 'laeuft', firma, trupps, start: s.woche });
  if (id === 'ins') { const n = NEBENKOSTEN.find((x) => x.id === 'anschluesse'); zahle(s, n.betrag, 'neben'); log(s, `Hausanschlüsse beauftragt: ${eur(n.betrag)}.`); }
  log(s, `${GW[id].kurz} gestartet – ${FIRMEN[firma].name}, ${trupps} Trupp${trupps > 1 ? 's' : ''}.`);
  return true;
}

export function setzeTrupps(s, id, n) { const st = s.g[id]; if (st.status === 'laeuft') st.trupps = Math.max(1, Math.min(GW[id].std + 1, n)); }

// ---------- Wochenablauf ----------
function beginWoche(s) {
  s.wetter = 'sonne'; s.regenSchutz = false; s.kranDefekt = false; s.kranErsatz = false;
  for (const g of GEWERKE) {
    const b = s.g[g.id].bestellt;
    if (b && b.ankunft === s.woche && g.liefer > 0) s.meldungen.push({ typ: 'lieferung', gid: g.id, text: `Lieferung: Material für ${g.kurz} ist da.` });
  }
  if (s.woche > 1) wuerfleEreignis(s);
}

export function endeWoche(s) {
  if (s.fertig) return;
  const fertigDieseWoche = [];
  for (const g of GEWERKE) {
    const st = s.g[g.id];
    if (st.status === 'nacharbeit') {
      st.nacharbeit -= 1;
      if (st.nacharbeit <= 0) { st.status = 'fertig'; st.ende = s.woche; fertigDieseWoche.push(g.id); log(s, `${g.kurz}: Nacharbeit erledigt, abgenommen.`, 'gut'); }
      continue;
    }
    if (st.status !== 'laeuft') continue;
    const fNom = tempo(g, st.trupps, st.firma);
    let f = fNom;
    if (s.wetter === 'regen' && g.draussen) f *= s.regenSchutz ? 0.7 : 0.35;
    if (g.kran && s.kranDefekt && !s.kranErsatz) f = 0;
    const rest = 1 - st.fortschritt;
    const anteil = f > 0 ? Math.min(1, rest / f) : 0;
    zahle(s, fNom * anteil * lohnGesamt(g, st.trupps, st.firma), null, g.id, 'lohn'); // bei Regen wird bezahlt, aber weniger geschafft
    st.fortschritt = Math.min(1, st.fortschritt + f); if (st.fortschritt > 0.999) st.fortschritt = 1;
    if (st.trupps > g.std) s.quali -= 0.5;
    if (s.wetter === 'regen' && g.draussen && !s.regenSchutz && g.id === 'roh') s.quali -= 2;
    if (g.id === 'inn' && st.fortschritt >= 0.35 && !s.flags.estrich) { s.flags.estrich = true; s.queue.push(evEstrich(s)); }
    if (st.fortschritt >= 1) abnahme(s, g.id, fertigDieseWoche);
  }
  const offen = GEWERKE.some((g) => !fertigG(s, g.id));
  zahle(s, LEVEL.baustelleProWoche, 'baustelle');
  zahle(s, (s.ausgegeben * LEVEL.zinsSatz) / 52, 'zinsen');
  if (s.woche > s.versprochen) {
    zahle(s, LEVEL.mieteProWoche, 'miete');
    s.quali -= 1.5;
    if (s.woche === s.versprochen + 1) log(s, 'Der versprochene Übergabetermin ist überschritten – die Bauherren zahlen weiter Miete.', 'schlecht');
  }
  s.quali = Math.max(0, Math.min(100, s.quali));
  for (const id of fertigDieseWoche) s.meldungen.push({ typ: 'fertig', gid: id, text: `${GW[id].kurz} fertig und abgenommen.` });
  if (!offen || GEWERKE.every((g) => fertigG(s, g.id))) {
    s.fertig = true; s.endeWoche = s.woche;
    if (s.woche <= s.versprochen) { s.quali = Math.min(100, s.quali + (s.puffer ? 3 : 8)); }
    log(s, `Schlüsselübergabe in Woche ${s.woche}!`, 'gut');
    return;
  }
  s.woche += 1;
  beginWoche(s);
}

function abnahme(s, id, fertigListe) {
  const g = GW[id], st = s.g[id];
  st.ende = s.woche;
  let p = FIRMEN[st.firma].mangel + (st.trupps > g.std ? 0.1 : 0);
  if (id === 'inn' && s.flags.feuchteRisiko && !s.flags.feuchteGeprueft) {
    s.flags.feuchteGeprueft = true;
    if (R() < 0.5) {
      st.status = 'nacharbeit'; st.nacharbeit = 2;
      zahle(s, 7500, null, id); s.quali -= 12;
      s.queue.push({ id: 'feuchte', bild: 'mangel', titel: 'Feuchteschaden!', text: 'Der Estrich war noch nicht trocken: Das Parkett wölbt sich, an den Wänden zeigt sich Schimmel. Rückbau und Neuverlegung kosten 7.500 € und 2 Wochen.', lehre: 'Trocknungszeiten sind kein Luxus – sie verhindern teure Bauschäden.', optionen: [{ label: 'Verstanden', aktion: () => {} }] });
      log(s, 'Feuchteschaden im Innenausbau: +7.500 €, +2 Wochen.', 'schlecht');
      return;
    }
  }
  if (R() < p) {
    st.status = 'abnahme';
    s.queue.push(evMangel(s, id));
  } else {
    st.status = 'fertig';
    if (st.firma === 'premium') s.quali += 1.5;
    fertigListe.push(id);
  }
}

// Falls ein Gewerk am Wochenanfang (z. B. durch Preisminderung) fertig wird
export function pruefeFertig(s) {
  if (s.fertig || !GEWERKE.every((g) => fertigG(s, g.id))) return false;
  s.fertig = true; s.endeWoche = s.woche - 1;
  if (s.endeWoche <= s.versprochen) s.quali = Math.min(100, s.quali + (s.puffer ? 3 : 8));
  log(s, `Schlüsselübergabe nach Woche ${s.endeWoche}!`, 'gut');
  return true;
}

// ---------- Ereignisse ----------
function zaehl(s, id) { return s.zaehler[id] || 0; }
function wuerfleEreignis(s) {
  // fest: Bodengutachten-Überraschung kurz nach Start der Erdarbeiten
  if (aktiv(s, 'erd') && !s.flags.boden) {
    s.flags.boden = true;
    if (R() < 0.6) { s.queue.push(evBoden(s)); return; }
  }
  if (R() > 0.36) return;
  const draussen = GEWERKE.some((g) => g.draussen && aktiv(s, g.id));
  const kandidaten = [];
  if (draussen && zaehl(s, 'regen') < 3) kandidaten.push(['regen', 3]);
  const offeneLieferung = GEWERKE.filter((g) => { const b = s.g[g.id].bestellt; return b && b.ankunft > s.woche && !b.verzug; });
  if (offeneLieferung.length && zaehl(s, 'liefer') < 2) kandidaten.push(['liefer', 2.2]);
  const unbestellt = GEWERKE.filter((g) => !s.g[g.id].bestellt);
  if (unbestellt.length >= 2 && zaehl(s, 'preis') < 2) kandidaten.push(['preis', 1.4]);
  if (s.woche >= 3 && zaehl(s, 'nachtrag') < 2 && nachtragOptionen(s).length) kandidaten.push(['nachtrag', 1.6]);
  if ((aktiv(s, 'roh') || aktiv(s, 'dach')) && zaehl(s, 'kran') < 1) kandidaten.push(['kran', 1.5]);
  if (!kandidaten.length) return;
  const summe = kandidaten.reduce((a, k) => a + k[1], 0);
  let r = R() * summe, wahl = kandidaten[0][0];
  for (const [id, w] of kandidaten) { if ((r -= w) <= 0) { wahl = id; break; } }
  s.zaehler[wahl] = zaehl(s, wahl) + 1;
  const ev = { regen: evRegen, liefer: () => evLiefer(s, offeneLieferung[Math.floor(R() * offeneLieferung.length)].id), preis: () => evPreis(s, unbestellt), nachtrag: evNachtrag, kran: evKran }[wahl](s);
  s.queue.push(ev);
}

// Testhilfe: bestimmtes Ereignis erzwingen
export function erzwinge(s, typ) {
  const offen = GEWERKE.filter((g) => s.g[g.id].bestellt && s.g[g.id].bestellt.ankunft > s.woche);
  const map = { regen: evRegen, kran: evKran, nachtrag: evNachtrag, boden: evBoden, preis: (x) => evPreis(x, GEWERKE.filter((g) => !x.g[g.id].bestellt)), liefer: (x) => offen.length && evLiefer(x, offen[0].id) };
  const ev = map[typ] && map[typ](s);
  if (ev) s.queue.push(ev);
}

function aktivDraussen(s) { return GEWERKE.find((g) => g.draussen && aktiv(s, g.id)); }

function evRegen(s) {
  s.wetter = 'regen';
  const g = aktivDraussen(s);
  return {
    id: 'regen', bild: 'regen', titel: 'Regenwoche', text: `Für die ganze Woche ist Dauerregen angesagt. Draußen geht die Arbeit (${g ? g.kurz : 'Außenarbeiten'}) nur langsam voran.`,
    lehre: 'Wetter ist der Klassiker unter den Bauverzögerungen – ein Zeitpuffer im Bauzeitenplan fängt so etwas auf.',
    optionen: [
      { label: 'Wetterschutz & Planen aufbauen', info: '1.200 € · Tempo 70 %', aktion: () => { s.regenSchutz = true; zahle(s, 1200, null, (g || GW.roh).id); log(s, 'Regen: Wetterschutz aufgebaut (1.200 €).'); } },
      { label: 'Durchziehen ohne Schutz', info: '0 € · Tempo 35 %' + (g && g.id === 'roh' ? ' · nasses Mauerwerk' : ''), aktion: () => log(s, 'Regen: ohne Schutz weitergearbeitet.') },
    ],
  };
}

function evKran(s) {
  const g = aktiv(s, 'roh') ? GW.roh : GW.dach;
  return {
    id: 'kran', bild: 'kran', titel: 'Kranausfall', text: 'Der Turmdrehkran meldet einen Hydraulikschaden. Ohne Kran keine schweren Steine, keine Deckenteile, kein Dachstuhl.',
    lehre: 'Auf der Baustelle hängt vieles an einer Maschine – Stillstand kostet trotzdem Geld (Baustelleneinrichtung, Zinsen).',
    optionen: [
      { label: 'Ersatzkran mieten', info: '2.800 € · kein Zeitverlust', aktion: () => { s.kranErsatz = true; zahle(s, 2800, null, g.id); log(s, 'Ersatzkran gemietet (2.800 €).'); } },
      { label: 'Reparatur abwarten', info: '0 € · 1 Woche Stillstand ' + g.kurz, aktion: () => { s.kranDefekt = true; log(s, 'Kran defekt – eine Woche Stillstand.', 'schlecht'); } },
    ],
  };
}

function evBoden(s) {
  return {
    id: 'boden', bild: 'boden', titel: 'Schlechtes Bodengutachten', text: 'Beim Aushub zeigt sich: Unter der Grasnarbe liegt eine weiche Lehmschicht. Laut Gutachter trägt der Boden die Bodenplatte so nicht.',
    lehre: 'Der Baugrund ist das größte unsichtbare Risiko – deshalb gehört ein Bodengutachten vor jede Planung.',
    optionen: [
      { label: 'Bodenaustausch mit Schotter', info: '8.000 € · +1 Woche', aktion: () => { zahle(s, 8000, null, 'erd'); s.g.erd.fortschritt = Math.max(0, s.g.erd.fortschritt - 1 / GW.erd.dauer); log(s, 'Bodenaustausch: 8.000 €, +1 Woche.', 'schlecht'); } },
      { label: 'Verstärkte Bodenplatte', info: '11.500 € · kein Zeitverlust', aktion: () => { zahle(s, 11500, null, 'erd'); log(s, 'Verstärkte Bodenplatte nach neuer Statik: 11.500 €.', 'schlecht'); } },
    ],
  };
}

function evLiefer(s, id) {
  const st = s.g[id];
  const extra = rund(st.bestellt.betrag * 0.12);
  return {
    id: 'liefer', bild: 'lkw', titel: 'Lieferverzug', text: `Der Händler meldet: Das Material für ${GW[id].kurz} kommt zwei Wochen später (geplant: Woche ${st.bestellt.ankunft}).`,
    lehre: 'Lieferketten sind ein echtes Risiko. Wer früh bestellt, hat Luft – bindet aber früher Geld.',
    optionen: [
      { label: 'Bei anderem Händler nachkaufen', info: `+${eur(extra)} · pünktlich`, aktion: () => { st.bestellt.verzug = true; zahle(s, extra, null, id, 'mat'); log(s, `Lieferverzug ${GW[id].kurz}: anderer Händler (+${eur(extra)}).`); } },
      { label: 'Warten', info: '0 € · +2 Wochen Lieferzeit', aktion: () => { st.bestellt.verzug = true; st.bestellt.ankunft += 2; log(s, `Lieferverzug ${GW[id].kurz}: neue Lieferung Woche ${st.bestellt.ankunft}.`, 'schlecht'); } },
    ],
  };
}

function evPreis(s, unbestellt) {
  const stoff = ['Stahl und Beton', 'Dämmstoffe und Holz', 'Kupfer und Kunststoffe'][zaehl(s, 'preis') % 3];
  const betroffen = unbestellt.map((g) => g.kurz).join(', ');
  return {
    id: 'preis', bild: 'preis', titel: 'Preissteigerung', text: `Die Preise für ${stoff} ziehen an: Alles Material, das noch nicht bestellt ist, wird 6 % teurer. Betroffen: ${betroffen}.`,
    lehre: 'Gebundene Preise schützen vor Preissprüngen – deshalb vereinbaren viele Bauherren Festpreise.',
    optionen: [{ label: 'Hinnehmen', info: 'unbestelltes Material +6 %', aktion: () => { s.preisIndex *= 1.06; log(s, `Preissteigerung: unbestelltes Material +6 %.`, 'schlecht'); } }],
  };
}

const NACHTRAEGE = [
  { text: 'zusätzliche Steckdosen, Netzwerkdosen und eine Vorbereitung für die Wallbox', betrag: 3200, gid: 'ins' },
  { text: 'eine bodentiefe Terrassentür statt des normalen Wohnzimmerfensters', betrag: 4800, gid: 'fen' },
  { text: 'ein zusätzliches Dachfenster im Bad', betrag: 2600, gid: 'dach' },
  { text: 'eine größere Terrasse mit Natursteinplatten', betrag: 5500, gid: 'aus' },
  { text: 'großformatige Fliesen statt Standardfliesen im Bad', betrag: 3900, gid: 'inn' },
];
function nachtragOptionen(s) { return NACHTRAEGE.filter((n) => s.g[n.gid].status === 'offen' || s.g[n.gid].status === 'laeuft').filter((n) => !s.flags['nt_' + n.gid]); }

function evNachtrag(s) {
  const opt = nachtragOptionen(s);
  const n = opt[Math.floor(R() * opt.length)];
  s.flags['nt_' + n.gid] = true;
  const st = s.g[n.gid];
  const spaet = st.status === 'laeuft' || !!st.bestellt;
  const betrag = rund(n.betrag * (spaet ? 1.5 : 1));
  const verzug = spaet ? 1 : 0;
  const anwenden = (b) => {
    zahle(s, b, 'nachtrag'); s.budgetPlus += b;
    if (verzug && st.status === 'laeuft') st.fortschritt = Math.max(0, st.fortschritt - 1 / GW[n.gid].dauer);
    else if (verzug && st.bestellt) st.bestellt.ankunft = Math.max(st.bestellt.ankunft, s.woche) + 1;
  };
  return {
    id: 'nachtrag', bild: 'nachtrag', titel: 'Die Bauherren haben einen Wunsch', text: `Familie Wegner wünscht sich ${n.text}.` + (spaet ? ` Das Gewerk ${GW[n.gid].kurz} ist schon bestellt bzw. in Arbeit – die Änderung wird teurer und kostet Zeit.` : ' Noch ist das Gewerk nicht bestellt – die Änderung ist gut machbar.'),
    lehre: 'Änderungen während des Baus heißen „Nachtrag“. Je später sie kommen, desto teurer werden sie.',
    optionen: [
      { label: 'Annehmen (Nachtrag)', info: `+${eur(betrag)}${verzug ? ' · +1 Woche' : ''} · Budget steigt mit`, aktion: () => { anwenden(betrag); s.quali += 3; log(s, `Nachtrag angenommen: ${n.text} (+${eur(betrag)}).`); } },
      { label: 'Günstigere Variante vorschlagen', info: `+${eur(rund(betrag * 0.5))} · Bauherren halb zufrieden`, aktion: () => { anwenden(rund(betrag * 0.5)); s.quali += 1; log(s, `Nachtrag als Sparvariante (+${eur(rund(betrag * 0.5))}).`); } },
      { label: 'Ablehnen', info: '0 € · Zufriedenheit sinkt', aktion: () => { s.quali -= 6; log(s, 'Nachtrag abgelehnt – die Bauherren sind enttäuscht.', 'schlecht'); } },
    ],
  };
}

const MANGEL_TEXT = {
  erd: 'Die Bodenplatte hat Höhenabweichungen über der Toleranz.',
  roh: 'Mauerwerk nicht im Lot, Fugen unsauber, eine Öffnung sitzt falsch.',
  dach: 'An der Traufe ist das Dach undicht, einige Ziegel liegen falsch.',
  fen: 'Die Fenster sind schlecht abgedichtet – es zieht.',
  ins: 'Leitungen wurden nicht nach Plan verlegt, ein Abfluss hat zu wenig Gefälle.',
  inn: 'Risse im Putz, ungleichmäßige Fliesenfugen, Kratzer im Boden.',
  aus: 'Das Pflaster wurde nicht richtig verdichtet und sackt ab.',
};
function evMangel(s, id) {
  const st = s.g[id];
  const wochen = st.firma === 'guenstig' ? 2 : 1;
  const minderung = rund((st.lohn + st.mat) * 0.05);
  return {
    id: 'mangel', bild: 'mangel', titel: `Mängel bei der Abnahme: ${GW[id].kurz}`, text: MANGEL_TEXT[id] + (st.firma === 'guenstig' ? ' Der günstige Subunternehmer hat gepfuscht.' : ''),
    lehre: 'Bei der Abnahme genau hinschauen lohnt sich: Danach muss der Bauherr Mängel selbst beweisen.',
    optionen: [
      { label: 'Nachbessern lassen', info: `Firma zahlt · +${wochen} Woche${wochen > 1 ? 'n' : ''}`, aktion: () => { st.status = 'nacharbeit'; st.nacharbeit = wochen; log(s, `${GW[id].kurz}: Nacharbeit angeordnet (+${wochen} Wo.).`, 'schlecht'); } },
      { label: 'Preisminderung, so lassen', info: `−${eur(minderung)} · Qualität sinkt deutlich`, aktion: () => { st.status = 'fertig'; zahle(s, -minderung, null, id); s.quali -= 10; log(s, `${GW[id].kurz}: Mangel akzeptiert, Minderung ${eur(minderung)}.`, 'schlecht'); } },
    ],
  };
}

function evEstrich(s) {
  // übersprungene Trocknungszeit ist kein gesparter Lohn – die Arbeit danach muss trotzdem gemacht werden
  const lohnFuer = (anteil) => { const st = s.g.inn; zahle(s, anteil * lohnGesamt(GW.inn, st.trupps, st.firma), null, 'inn', 'lohn'); };
  return {
    id: 'estrich', bild: 'estrich', titel: 'Der Estrich ist drin', text: 'Der Zementestrich liegt. Jetzt muss er trocknen, bevor Fliesen und Parkett darauf dürfen. Der Plan sieht zwei Wochen Trocknung vor.',
    lehre: 'Zeit gegen Sicherheit: Wer Trocknungszeiten abkürzt, riskiert Feuchteschäden, die viel teurer sind als jede Woche Wartezeit.',
    optionen: [
      { label: 'Normal trocknen lassen', info: '0 € · sicher', aktion: () => log(s, 'Estrich trocknet nach Plan.') },
      { label: 'Bautrockner mieten', info: '1.400 € · −1 Woche · sicher', aktion: () => { zahle(s, 1400, null, 'inn'); lohnFuer(1 / GW.inn.dauer); s.g.inn.fortschritt = Math.min(0.99, s.g.inn.fortschritt + 1 / GW.inn.dauer); log(s, 'Bautrockner gemietet (1.400 €), eine Woche gespart.'); } },
      { label: 'Sofort weiterarbeiten', info: '0 € · −2 Wochen · Risiko Feuchteschaden', aktion: () => { s.flags.feuchteRisiko = true; lohnFuer(2 / GW.inn.dauer); s.g.inn.fortschritt = Math.min(0.99, s.g.inn.fortschritt + 2 / GW.inn.dauer); log(s, 'Estrich nicht ausgetrocknet – es wird weitergearbeitet.', 'schlecht'); } },
    ],
  };
}

// ---------- Prognose & Auswertung ----------
// Projektion: wann wird fertig, was kostet der Rest (bei aktuellen Einstellungen, ohne neue Ereignisse)
export function prognose(s) {
  const ende = {};
  let restKosten = 0;
  for (const g of GEWERKE) {
    const st = s.g[g.id];
    if (st.status === 'fertig') { ende[g.id] = st.ende; continue; }
    const depEnde = Math.max(s.woche - 1, ...g.nach.map((d) => ende[d]));
    if (st.status === 'nacharbeit' || st.status === 'abnahme') { ende[g.id] = s.woche - 1 + Math.max(1, st.nacharbeit); continue; }
    const firma = st.firma || 'meister', trupps = st.trupps;
    const rate = tempo(g, trupps, firma);
    const rest = 1 - st.fortschritt;
    const wochen = Math.ceil(rest / rate - 1e-6);
    let start;
    if (st.status === 'laeuft') start = s.woche;
    else {
      const ankunft = st.bestellt ? st.bestellt.ankunft : s.woche + g.liefer;
      start = Math.max(depEnde + 1, ankunft);
      if (!st.bestellt) restKosten += materialPreis(s, g.id, false);
    }
    ende[g.id] = start + wochen - 1;
    restKosten += rest * lohnGesamt(g, trupps, firma);
  }
  if (s.g.ins.status === 'offen') restKosten += NEBENKOSTEN.find((n) => n.id === 'anschluesse').betrag;
  const endWoche = Math.max(...Object.values(ende));
  const restWochen = Math.max(0, endWoche - s.woche + 1);
  restKosten += restWochen * LEVEL.baustelleProWoche;
  restKosten += restWochen * ((s.ausgegeben + restKosten / 2) * LEVEL.zinsSatz) / 52;
  restKosten += Math.max(0, endWoche - Math.max(s.versprochen, s.woche - 1)) * LEVEL.mieteProWoche;
  return { endWoche, gesamt: rund(s.ausgegeben + restKosten), ende };
}

// Plan-Werte (Soll) – idealer Ablauf, Meisterbetriebe, keine Störungen
export function planWerte() {
  const sched = { erd: [1, 3], roh: [4, 9], dach: [10, 12], fen: [10, 10], ins: [13, 16], inn: [17, 23], aus: [17, 18] };
  const proWoche = Array(LEVEL.planWochen + 2).fill(0);
  proWoche[0] += NEBENKOSTEN.filter((n) => n.wann === 'start').reduce((a, n) => a + n.betrag, 0);
  for (const g of GEWERKE) {
    const [a, b] = sched[g.id];
    proWoche[Math.max(1, a - g.liefer)] += g.kosten * g.mat;
    for (let w = a; w <= b; w++) proWoche[w] += (g.kosten * (1 - g.mat)) / (b - a + 1);
  }
  proWoche[13] += 15000;
  let summe = 0, zinsen = 0;
  for (let w = 0; w <= LEVEL.planWochen; w++) { summe += proWoche[w]; if (w >= 1) { summe += LEVEL.baustelleProWoche; zinsen += (summe * LEVEL.zinsSatz) / 52; } }
  const zeilen = GEWERKE.map((g) => ({ id: g.id, name: g.name, plan: g.kosten }));
  const neben = NEBENKOSTEN.reduce((a, n) => a + n.betrag, 0);
  const baustelle = LEVEL.planWochen * LEVEL.baustelleProWoche;
  zinsen = rund(zinsen);
  const gesamt = zeilen.reduce((a, z) => a + z.plan, 0) + neben + baustelle + zinsen;
  return { zeilen, neben, baustelle, zinsen, gesamt };
}

export function abrechnung(s) {
  const p = planWerte();
  const zeilen = p.zeilen.map((z) => { const st = s.g[z.id]; return { ...z, ist: st.mat + st.lohn + st.extra, firma: st.firma }; });
  zeilen.push({ id: 'neben', name: 'Nebenkosten (Planung, Statik, Gutachten, Genehmigung, Anschlüsse)', plan: p.neben, ist: s.posten.neben });
  zeilen.push({ id: 'baustelle', name: `Baustelleneinrichtung (${eur(LEVEL.baustelleProWoche)}/Woche)`, plan: p.baustelle, ist: s.posten.baustelle });
  zeilen.push({ id: 'zinsen', name: 'Bauzeitzinsen', plan: p.zinsen, ist: s.posten.zinsen });
  zeilen.push({ id: 'miete', name: 'Doppelte Miete durch Verzug', plan: 0, ist: s.posten.miete });
  zeilen.push({ id: 'nachtrag', name: 'Nachträge (Wünsche der Bauherren)', plan: 0, ist: s.posten.nachtrag });
  const plan = p.gesamt + s.budgetPlus;
  const budget = LEVEL.budget + s.budgetPlus;
  const ist = s.ausgegeben;
  const wochen = s.endeWoche;
  const sterne = {
    zeit: wochen <= ZEIT_STERNE[0] ? 3 : wochen <= ZEIT_STERNE[1] ? 2 : wochen <= ZEIT_STERNE[2] ? 1 : 0,
    kosten: ist <= plan ? 3 : ist <= budget ? 2 : ist <= budget * 1.04 ? 1 : 0,
    quali: s.quali >= QUALI_STERNE[0] ? 3 : s.quali >= QUALI_STERNE[1] ? 2 : s.quali >= QUALI_STERNE[2] ? 1 : 0,
  };
  return { zeilen, plan, budget, ist, wochen, sterne, quali: Math.round(s.quali), pünktlich: wochen <= s.versprochen };
}

export function eur(x) { return (x < 0 ? '−' : '') + Math.abs(Math.round(x)).toLocaleString('de-DE') + ' €'; }
