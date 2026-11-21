// Baustellen-Chef – Spielwerte Level 1 „Einfamilienhaus“ (ca. 140 m²)
// Alle Zahlen sind gerundete SPIELWERTE (Stand 2026, brutto), kein Angebot und keine Kalkulation.

export const LEVEL = {
  id: 'efh',
  titel: 'Einfamilienhaus',
  untertitel: 'ca. 140 m² Wohnfläche · 2 Geschosse · Satteldach · Wärmepumpe',
  bauherr: 'Familie Wegner (erfunden)',
  planWochen: 23,          // reine Bauzeit nach Plan (kritischer Pfad)
  budget: 500000,          // Gesamtbudget der Bauherren (ohne Grundstück)
  baustelleProWoche: 650,  // Kran, Container, Bau-WC, Bauzaun, Baustrom/-wasser
  zinsSatz: 0.036,         // Bauzeitzinsen p. a. auf bereits abgerufenes Geld
  mieteProWoche: 300,      // Doppelbelastung: alte Miete läuft weiter, wenn die Übergabe sich verzögert
};

// Nebenkosten – fallen unabhängig vom Bauablauf an
export const NEBENKOSTEN = [
  { id: 'planung', name: 'Architekt / Planung', betrag: 30000, wann: 'start' },
  { id: 'statik', name: 'Statik & Energieberatung', betrag: 7000, wann: 'start' },
  { id: 'vermessung', name: 'Vermessung & Bodengutachten', betrag: 3500, wann: 'start' },
  { id: 'genehmigung', name: 'Baugenehmigung (Gebühren)', betrag: 2000, wann: 'start' },
  { id: 'anschluesse', name: 'Hausanschlüsse (Strom, Wasser, Abwasser, Telefon)', betrag: 15000, wann: 'ins' },
];

// Gewerke in Bau-Reihenfolge.
// kosten = Planpreis (Material + Lohn), mat = Materialanteil, dauer = Wochen mit std Trupps,
// liefer = Lieferzeit Material in Wochen, draussen = wetterabhängig, kran = braucht den Kran
export const GEWERKE = [
  {
    id: 'erd', name: 'Erdarbeiten & Bodenplatte', kurz: 'Bodenplatte', kosten: 34000, mat: 0.45,
    dauer: 3, std: 2, liefer: 0, draussen: true, kran: false, nach: [],
    icon: 'M3 17h18M5 17l3-6h8l3 6M9 11V7h6v4',
    tipp: 'Vor dem ersten Spatenstich steht das Bodengutachten: Es zeigt, ob der Boden das Haus überhaupt tragen kann.',
  },
  {
    id: 'roh', name: 'Rohbau (Mauerwerk & Decke)', kurz: 'Rohbau', kosten: 98000, mat: 0.5,
    dauer: 6, std: 2, liefer: 2, draussen: true, kran: true, nach: ['erd'],
    icon: 'M3 19h18M4 19v-5h7v5M13 19v-9h7v9M4 14h7M13 10h7',
    tipp: 'Der Rohbau ist meist der größte Einzelposten – in diesem Spiel rund ein Viertel der Baukosten.',
  },
  {
    id: 'dach', name: 'Dachstuhl & Eindeckung', kurz: 'Dach', kosten: 46000, mat: 0.5,
    dauer: 3, std: 2, liefer: 2, draussen: true, kran: true, nach: ['roh'],
    icon: 'M2 12l10-7 10 7M5 10v9h14v-9',
    tipp: 'Erst wenn Dach und Fenster dicht sind, darf der Innenausbau beginnen – sonst wird es drinnen nass.',
  },
  {
    id: 'fen', name: 'Fenster & Haustür', kurz: 'Fenster', kosten: 31000, mat: 0.75,
    dauer: 1, std: 1, liefer: 6, draussen: false, kran: false, nach: ['roh'],
    icon: 'M5 4h14v16H5zM12 4v16M5 12h14',
    tipp: 'Fenster werden nach Maß gefertigt. Mehrere Wochen Lieferzeit sind normal – wer zu spät bestellt, wartet.',
  },
  {
    id: 'ins', name: 'Haustechnik (Elektro, Sanitär, Wärmepumpe)', kurz: 'Haustechnik', kosten: 78000, mat: 0.55,
    dauer: 4, std: 2, liefer: 4, draussen: false, kran: false, nach: ['dach', 'fen'],
    icon: 'M13 2L5 14h6l-1 8 8-12h-6z',
    tipp: 'Elektro, Sanitär und Heizung arbeiten gleichzeitig: Alle Leitungen müssen liegen, bevor Putz und Estrich kommen.',
  },
  {
    id: 'inn', name: 'Innenausbau & Putz (Estrich, Fliesen, Böden, Maler)', kurz: 'Innenausbau', kosten: 84000, mat: 0.4,
    dauer: 7, std: 2, liefer: 2, draussen: false, kran: false, nach: ['ins'],
    icon: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
    tipp: 'Estrich braucht Zeit: Als grobe Faustregel gilt bei Zementestrich bis etwa 4 cm rund eine Woche Trocknung je Zentimeter, bei dickerem Estrich deutlich mehr. Belegt wird erst, wenn eine Messung die Belegreife bestätigt; bei Fußbodenheizung kommt das Belegreifheizen hinzu.',
  },
  {
    id: 'aus', name: 'Außenanlagen (Zufahrt, Terrasse, Garten)', kurz: 'Außenanlagen', kosten: 21000, mat: 0.45,
    dauer: 2, std: 1, liefer: 2, draussen: true, kran: false, nach: ['dach', 'fen'],
    icon: 'M12 3v18M7 8c0-3 10-3 10 0-1 3-9 3-10 0zM4 21h16',
    tipp: 'Außenanlagen werden gern vergessen: Zufahrt, Terrasse und Garten kosten schnell einen fünfstelligen Betrag.',
  },
];

// Firmenwahl je Gewerk – Zielkonflikt Preis vs. Risiko
export const FIRMEN = {
  guenstig: { name: 'Günstiger Subunternehmer', preis: 0.8, tempo: 0.95, mangel: 0.45, info: 'Lohn −20 %, aber hohes Pfusch-Risiko' },
  meister: { name: 'Meisterbetrieb', preis: 1.0, tempo: 1.0, mangel: 0.12, info: 'Planpreis, solide Arbeit' },
  premium: { name: 'Premium-Fachbetrieb', preis: 1.12, tempo: 1.1, mangel: 0.03, info: 'Lohn +12 %, schneller, kaum Mängel' },
};

export const ZEIT_STERNE = [23, 26, 30]; // ≤ → 3/2/1 Sterne
export const QUALI_STERNE = [90, 75, 55];

export const KONTAKT_URL = '/?anfrage=spiel#kontakt'; // öffnet das vorbelegte Kontaktformular der Startseite
