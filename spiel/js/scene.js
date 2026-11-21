// Baustellen-Chef – 3D-Baustelle (Three.js r160, lokal eingebunden)
// Stilisiertes Architekturmodell: Haus wächst Gewerk für Gewerk. Eigenes, frei erfundenes Haus.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const C = {
  terracotta: 0xbb4a2c, creme: 0xf2ebdd, putz: 0xeee5d3, ziegel: 0xa9472f, mauer: 0xc77a55,
  beton: 0xb8b2a8, anthrazit: 0x34312d, holz: 0x9a6a45, rasen: 0x8da36a, rasen2: 0x7d9660,
  matsch: 0x9c8466, grube: 0x6f5642, schotter: 0x9d9384, stahl: 0x9aa0a3,
};
const LX = 10, LZ = 8.5, T = 0.36, H0 = 0.3, ST = 2.6, DE = 0.25, NL = 10, LH = ST / NL;
const OG_TOP = H0 + 2 * ST + DE; // 5.75
const PITCH = (38 * Math.PI) / 180, HALF = LZ / 2, RISE = HALF * Math.tan(PITCH), OVER = 0.65;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));

function gradientTex(top, mid, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.6, mid); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ziegelTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#a9472f'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 16; r++) {
    for (let k = 0; k < 9; k++) {
      const x = k * 32 - (r % 2) * 16, y = r * 16;
      const l = 40 + Math.random() * 14; g.fillStyle = `hsl(12, 52%, ${l}%)`;
      g.beginPath(); g.ellipse(x + 16, y + 9, 15, 8, 0, 0, Math.PI); g.fill();
    }
    g.fillStyle = 'rgba(40,15,8,0.35)'; g.fillRect(0, r * 16 + 14, 256, 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function schildTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f7f4ef'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#bb4a2c'; g.fillRect(0, 0, 512, 18); g.fillRect(0, 238, 512, 18);
  g.fillStyle = '#1b1a18'; g.font = '600 34px Georgia, serif'; g.textAlign = 'center';
  g.fillText('Hier entsteht', 256, 80);
  g.font = '700 64px Georgia, serif'; g.fillText('DIENER', 196, 160);
  g.font = '300 64px Georgia, serif'; g.fillStyle = '#1b1a18'; g.fillText('HAUS', 380, 160);
  g.fillStyle = '#bb4a2c'; g.fillRect(56, 182, 400, 4);
  g.fillStyle = '#5a554d'; g.font = '24px Arial, sans-serif'; g.fillText('Ihr Einfamilienhaus · Baustellen-Chef', 256, 220);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Öffnungen (u = Position entlang Wand, y relativ zur Geschossunterkante)
const OEFF = {
  vorne: [
    { s: 0, u: -2.6, w: 1.1, y0: 0, y1: 2.2, typ: 'tuer' }, { s: 0, u: 0.4, w: 1.4, y0: 0.9, y1: 2.2 }, { s: 0, u: 3, w: 1.4, y0: 0.9, y1: 2.2 },
    { s: 1, u: -2.6, w: 1.2, y0: 0.95, y1: 2.15 }, { s: 1, u: 0.4, w: 1.2, y0: 0.95, y1: 2.15 }, { s: 1, u: 3, w: 1.2, y0: 0.95, y1: 2.15 },
  ],
  hinten: [
    { s: 0, u: 1.6, w: 2.6, y0: 0, y1: 2.25, typ: 'glas' }, { s: 0, u: -2.6, w: 1.4, y0: 0.9, y1: 2.2 },
    { s: 1, u: -2.6, w: 1.2, y0: 0.95, y1: 2.15 }, { s: 1, u: 1.6, w: 1.2, y0: 0.95, y1: 2.15 },
  ],
  links: [{ s: 0, u: 0.5, w: 1.2, y0: 0.9, y1: 2.2 }, { s: 1, u: -1.2, w: 1.0, y0: 0.95, y1: 2.15 }],
  rechts: [{ s: 0, u: -0.5, w: 1.2, y0: 0.9, y1: 2.2 }, { s: 1, u: 1.2, w: 1.0, y0: 0.95, y1: 2.15 }],
};
const WAENDE = [
  { id: 'vorne', achse: 'x', fix: LZ / 2 - T / 2, L: LX, aussen: 1 },
  { id: 'hinten', achse: 'x', fix: -(LZ / 2 - T / 2), L: LX, aussen: -1 },
  { id: 'links', achse: 'z', fix: -(LX / 2 - T / 2), L: LZ - 2 * T, aussen: -1 },
  { id: 'rechts', achse: 'z', fix: LX / 2 - T / 2, L: LZ - 2 * T, aussen: 1 },
];

export function erstelleSzene(canvas, opts = {}) {
  let qualitaet = opts.qualitaet || 'hoch';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: qualitaet === 'hoch', powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const himmelSonne = gradientTex('#9fc1d9', '#e9e2d3', '#f3ece0');
  const himmelRegen = gradientTex('#6f7a82', '#a6a9a8', '#bdbcb6');
  const himmelAbend = gradientTex('#46557a', '#e8a978', '#f6d2a6');
  scene.background = himmelSonne;
  scene.fog = new THREE.Fog(0xece5d8, 45, 120);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 300);
  camera.position.set(24, 15, 29);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 3, 0);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.minDistance = 13; controls.maxDistance = 60;
  controls.maxPolarAngle = 1.42; controls.minPolarAngle = 0.25;
  controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.8;

  const hemi = new THREE.HemisphereLight(0xfff4e2, 0xb7a789, 1.1); scene.add(hemi);
  const sonne = new THREE.DirectionalLight(0xfff0da, 2.4);
  sonne.position.set(14, 22, 12);
  sonne.shadow.camera.left = -20; sonne.shadow.camera.right = 20; sonne.shadow.camera.top = 20; sonne.shadow.camera.bottom = -20;
  sonne.shadow.camera.far = 70; sonne.shadow.bias = -0.0004; sonne.shadow.normalBias = 0.03;
  scene.add(sonne);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  const box = new THREE.BoxGeometry(1, 1, 1);
  function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, parent = scene) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }

  // ---------- Umgebung ----------
  const boden = mesh(new THREE.CircleGeometry(140, 48), M(C.rasen, { roughness: 1 }), 0, 0, 0); boden.rotation.x = -Math.PI / 2; boden.castShadow = false;
  const strasse = mesh(new THREE.PlaneGeometry(260, 6), M(0x6d6a66, { roughness: 0.95 }), 0, 0.01, 16.5); strasse.rotation.x = -Math.PI / 2; strasse.castShadow = false;
  const gehweg = mesh(new THREE.PlaneGeometry(260, 1.8), M(0xc9c1b3), 0, 0.02, 12.6); gehweg.rotation.x = -Math.PI / 2; gehweg.castShadow = false;
  for (let i = -12; i <= 12; i++) { const s = mesh(box, M(0xe9e3d6), i * 10, 0.015, 16.5, 3, 0.01, 0.18); s.castShadow = false; }

  const matschMat = M(C.matsch, { transparent: true, opacity: 0, roughness: 1, depthWrite: false });
  const matsch = mesh(new THREE.PlaneGeometry(22, 20), matschMat, 0, 0.025, 0); matsch.rotation.x = -Math.PI / 2; matsch.castShadow = false;
  const grube = mesh(new THREE.PlaneGeometry(LX + 2.4, LZ + 2.4), M(C.grube, { roughness: 1 }), 0, 0.035, 0); grube.rotation.x = -Math.PI / 2; grube.castShadow = false;
  const schotter = mesh(new THREE.PlaneGeometry(LX + 0.8, LZ + 0.8), M(C.schotter, { roughness: 1 }), 0, 0.045, 0); schotter.rotation.x = -Math.PI / 2; schotter.castShadow = false;
  const platte = mesh(box, M(C.beton), 0, H0 / 2, 0, LX + 0.2, H0, LZ + 0.2);
  const haufen = mesh(new THREE.ConeGeometry(2.8, 2.2, 9), M(0x7e6249, { flatShading: true, roughness: 1 }), -8.5, 1.1, 4.5);

  // Bäume / Hecken außerhalb des Grundstücks
  const laub = M(0x6f8d55, { flatShading: true }), laub2 = M(0x86a065, { flatShading: true }), stamm = M(0x6b4f3a);
  const ico = new THREE.IcosahedronGeometry(1, 0), zyl = new THREE.CylinderGeometry(0.12, 0.18, 1, 6);
  function baum(x, z, s, parent = scene) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
    mesh(zyl, stamm, 0, 0.9, 0, 1, 1.8, 1, g); mesh(ico, Math.random() > 0.5 ? laub : laub2, 0, 2.6, 0, 1.4, 1.6, 1.4, g); return g;
  }
  [[-17, -14, 1.5], [-21, -4, 1.2], [18, -15, 1.7], [22, -6, 1.1], [-24, 8, 1.3], [26, 6, 1.4], [-10, -19, 1.2], [9, -21, 1.6], [3, -26, 1.3]].forEach(([x, z, s]) => baum(x, z, s));
  const hecke = M(0x5f7d4a, { flatShading: true });
  mesh(box, hecke, -30, 0.7, 0, 1.2, 1.4, 26); mesh(box, hecke, 30, 0.7, 0, 1.2, 1.4, 26);

  // ---------- Bodenplatte & Mauerwerk (Instanced: eine Draw-Call pro Material) ----------
  function baueLagen(splitten) {
    const mats = [], grenzen = [];
    const add = (achse, fix, c, y, len, h, dicke) => {
      const m = new THREE.Matrix4();
      const pos = achse === 'x' ? new THREE.Vector3(c, y, fix) : new THREE.Vector3(fix, y, c);
      const sc = achse === 'x' ? new THREE.Vector3(len, h, dicke) : new THREE.Vector3(dicke, h, len);
      m.compose(pos, new THREE.Quaternion(), sc); mats.push(m);
    };
    for (let s = 0; s < 2; s++) {
      const yb = H0 + s * (ST + DE);
      for (let i = 0; i < NL; i++) {
        const r0 = i * LH, r1 = r0 + LH;
        for (const w of WAENDE) {
          let iv = [[-w.L / 2, w.L / 2]];
          for (const o of OEFF[w.id]) {
            if (o.s !== s || !(o.y0 < r1 - 1e-6 && o.y1 > r0 + 1e-6)) continue;
            const a = o.u - o.w / 2, b = o.u + o.w / 2; const neu = [];
            for (const [p, q] of iv) { if (b <= p || a >= q) neu.push([p, q]); else { if (a > p) neu.push([p, a]); if (b < q) neu.push([b, q]); } }
            iv = neu;
          }
          for (const [p, q] of iv) {
            if (q - p < 0.05) continue;
            if (!splitten) { add(w.achse, w.fix + w.aussen * 0.03, (p + q) / 2, yb + r0 + LH / 2, q - p, LH + 0.002, T + 0.06); continue; }
            const stein = 0.5, off = i % 2 ? 0.25 : 0;
            let x = p;
            let erster = true;
            while (x < q - 0.02) {
              let e = Math.min(q, x + (erster && off ? off : stein));
              if (e - x < 0.06) e = q;
              add(w.achse, w.fix, (x + e) / 2 , yb + r0 + LH / 2 - 0.006, e - x - 0.018, LH - 0.018, T);
              x = e; erster = false;
            }
          }
        }
        grenzen.push(mats.length);
      }
      // Putz auch über die Deckenstirn ziehen (sonst sichtbarer Betonstreifen)
      if (!splitten && s === 0) for (const w of WAENDE) add(w.achse, w.fix + w.aussen * 0.03, 0, H0 + ST + DE / 2, w.achse === 'x' ? w.L + 0.06 : w.L, DE + 0.01, T + 0.06);
    }
    return { mats, grenzen };
  }
  const steinMat = M(C.mauer, { roughness: 0.92 });
  const lagen = baueLagen(true);
  const steine = new THREE.InstancedMesh(box, steinMat, lagen.mats.length);
  lagen.mats.forEach((m, i) => steine.setMatrixAt(i, m)); steine.count = 0; steine.castShadow = steine.receiveShadow = true; scene.add(steine);
  const putzMat = M(C.putz, { roughness: 0.95 });
  const putzL = baueLagen(false);
  const putz = new THREE.InstancedMesh(box, putzMat, putzL.mats.length);
  putzL.mats.forEach((m, i) => putz.setMatrixAt(i, m)); putz.count = 0; putz.castShadow = putz.receiveShadow = true; scene.add(putz);

  const decke = mesh(box, M(C.beton), 0, H0 + ST + DE / 2, 0, LX, DE, LZ);
  // Giebel (Dreiecke), Aufbau per Clipping-Ebene
  const giebelForm = new THREE.Shape(); giebelForm.moveTo(-HALF, 0); giebelForm.lineTo(HALF, 0); giebelForm.lineTo(0, RISE); giebelForm.closePath();
  const giebelGeo = new THREE.ExtrudeGeometry(giebelForm, { depth: T, bevelEnabled: false }); giebelGeo.translate(0, 0, -T / 2);
  const putzGiebelGeo = new THREE.ExtrudeGeometry(giebelForm, { depth: T + 0.06, bevelEnabled: false }); putzGiebelGeo.translate(0, 0, -(T + 0.06) / 2);
  const clipStein = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), clipPutz = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const giebelStein = M(C.mauer, { clippingPlanes: [clipStein], clipShadows: true });
  const giebelPutz = M(C.putz, { clippingPlanes: [clipPutz], clipShadows: true });
  const giebel = [];
  for (const sx of [-1, 1]) {
    const a = mesh(giebelGeo, giebelStein, sx * (LX / 2 - T / 2), OG_TOP, 0); a.rotation.y = Math.PI / 2;
    const b = mesh(putzGiebelGeo, giebelPutz, sx * (LX / 2 - T / 2), OG_TOP, 0); b.rotation.y = Math.PI / 2; b.visible = false;
    giebel.push(a, b);
  }

  // ---------- Dach ----------
  const dachL = HALF / Math.cos(PITCH) + OVER, dachB = LX + 2 * OVER;
  const ziegel = ziegelTex(); ziegel.repeat.set(dachB / 2.2, dachL / 2.2);
  const dachMat = M(0xffffff, { map: ziegel, roughness: 0.8 });
  const holzMat = M(C.holz);
  const dachSeiten = [];
  for (const side of [1, -1]) {
    const piv = new THREE.Group();
    piv.position.set(0, OG_TOP - OVER * Math.sin(PITCH) + 0.05, side * (HALF + OVER * Math.cos(PITCH)));
    piv.rotation.order = 'YXZ'; piv.rotation.set(PITCH - Math.PI / 2, side > 0 ? 0 : Math.PI, 0);
    scene.add(piv);
    const sparren = new THREE.InstancedMesh(box, holzMat, 15);
    for (let i = 0; i < 15; i++) {
      const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(-LX / 2 - 0.3 + i * ((LX + 0.6) / 14), (dachL - 0.3) / 2, -0.12), new THREE.Quaternion(), new THREE.Vector3(0.1, dachL - 0.3, 0.2)); sparren.setMatrixAt(i, m);
    }
    sparren.count = 0; sparren.castShadow = true; piv.add(sparren);
    const latten = new THREE.InstancedMesh(box, holzMat, 10);
    for (let i = 0; i < 10; i++) { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(0, 0.3 + i * (dachL - 0.4) / 9, 0.0), new THREE.Quaternion(), new THREE.Vector3(dachB, 0.05, 0.05)); latten.setMatrixAt(i, m); }
    latten.count = 0; piv.add(latten);
    const deckGeo = new THREE.BoxGeometry(dachB, 1, 0.12); deckGeo.translate(0, 0.5, 0.06);
    const deck = mesh(deckGeo, dachMat, 0, 0, 0.02, 1, 0.001, 1, piv); deck.visible = false;
    const pvGruppe = new THREE.Group(); piv.add(pvGruppe);
    dachSeiten.push({ piv, sparren, latten, deck, pvGruppe, side });
  }
  const first = mesh(box, M(0x7d3322), 0, OG_TOP + RISE + 0.08, 0, dachB, 0.18, 0.32); first.visible = false;
  const pfette = mesh(box, holzMat, 0, OG_TOP + RISE - 0.15, 0, LX + 0.6, 0.24, 0.16); pfette.visible = false;
  // PV-Module auf der Straßenseite
  const pvMat = M(0x1f2a3d, { roughness: 0.35, metalness: 0.4 }); const pvRahmen = M(0xbfc4c8, { metalness: 0.6, roughness: 0.4 });
  const pvTeile = [];
  for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
    const g = new THREE.Group(); g.position.set(-3.6 + k * 1.15, 1.6 + r * 1.85, 0.2); dachSeiten[0].pvGruppe.add(g);
    mesh(box, pvRahmen, 0, 0, 0, 1.1, 1.78, 0.05, g); mesh(box, pvMat, 0, 0, 0.02, 1.04, 1.72, 0.05, g); g.visible = false; pvTeile.push(g);
  }

  // ---------- Fenster & Türen ----------
  const rahmenMat = M(C.anthrazit, { roughness: 0.5 });
  const glasMat = new THREE.MeshStandardMaterial({ color: 0x8aa3b3, roughness: 0.08, metalness: 0.5, emissive: 0xffc178, emissiveIntensity: 0 });
  const tuerMat = M(C.terracotta, { roughness: 0.6 });
  const bankMat = M(0xd9d2c4);
  const fenster = [];
  for (const w of WAENDE) for (const o of OEFF[w.id]) {
    const g = new THREE.Group();
    const yb = H0 + o.s * (ST + DE);
    const h = o.y1 - o.y0, cy = yb + (o.y0 + o.y1) / 2;
    const fixOut = w.fix + w.aussen * (T / 2 - 0.12);
    if (w.achse === 'x') g.position.set(o.u, cy, fixOut); else { g.position.set(fixOut, cy, o.u); g.rotation.y = Math.PI / 2; }
    mesh(box, rahmenMat, 0, 0, 0, o.w, h, 0.08, g);
    if (o.typ === 'tuer') { mesh(box, tuerMat, 0, 0, 0.005, o.w - 0.12, h - 0.08, 0.1, g); mesh(box, M(0xd8d2c8, { metalness: 0.8, roughness: 0.3 }), (o.w / 2 - 0.22), -0.05, 0.07, 0.04, 0.4, 0.04, g); }
    else {
      mesh(box, glasMat, 0, 0, 0.005, o.w - 0.12, h - 0.12, 0.09, g);
      if (o.w > 1.3) mesh(box, rahmenMat, 0, 0, 0.01, 0.07, h - 0.1, 0.1, g);
      if (o.y0 > 0.1) mesh(box, bankMat, 0, -h / 2 - 0.03, 0.1, o.w + 0.1, 0.05, 0.26, g);
    }
    g.scale.set(1, 1, w.aussen);
    g.visible = false; scene.add(g); fenster.push(g);
  }
  // Fenster in sinnvoller Reihenfolge (EG zuerst)
  fenster.sort((a, b) => a.position.y - b.position.y);

  // ---------- Haustechnik: Wärmepumpe ----------
  const wp = new THREE.Group(); wp.position.set(LX / 2 + 1.1, 0, -1.6); scene.add(wp);
  mesh(box, M(0xe8e6e1, { roughness: 0.5 }), 0, 0.55, 0, 0.5, 0.9, 1.1, wp);
  const luefter = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), M(0x4a4a48), 0.26, 0.58, 0, 1, 1, 1, wp); luefter.rotation.z = Math.PI / 2;
  mesh(box, M(0x9a948a), 0, 0.05, 0, 0.7, 0.1, 1.3, wp);
  wp.visible = false;

  // ---------- Außenanlagen ----------
  const pflasterMat = M(0xb7ad9e, { roughness: 0.95 });
  const zufahrt = mesh(box, pflasterMat, -2.6, 0.04, 8.2, 2.2, 0.06, 7.6); zufahrt.castShadow = false;
  const stellplatz = mesh(box, pflasterMat, 6.5, 0.04, 8.5, 4.5, 0.06, 7); stellplatz.castShadow = false;
  const terrasse = mesh(box, M(0xc7b8a2, { roughness: 0.9 }), 1.6, 0.06, -LZ / 2 - 2, 6, 0.1, 3.6); terrasse.castShadow = false;
  const gartenBaeume = [baum(-7.5, -7, 0.9), baum(7.8, -7.5, 0.75), baum(-8, 7.5, 0.7)];
  const heckenNeu = [mesh(box, hecke, -10.3, 0.5, 0, 0.8, 1, 18), mesh(box, hecke, 10.3, 0.5, -2, 0.8, 1, 14), mesh(box, hecke, 0, 0.5, -9.6, 21, 1, 0.8)];
  const aussenTeile = [zufahrt, stellplatz, terrasse, ...gartenBaeume, ...heckenNeu];
  aussenTeile.forEach((t) => (t.visible = false));
  const briefkasten = mesh(box, M(C.terracotta), -4.3, 0.6, 11.6, 0.4, 0.5, 0.3); briefkasten.visible = false;

  // ---------- Baustelleneinrichtung ----------
  const zaunMat = M(0xc9ccce, { metalness: 0.5, roughness: 0.5, transparent: true, opacity: 0.55 });
  const zaun = new THREE.Group(); scene.add(zaun);
  const zaunPos = [];
  for (let k = 0; k < 6; k++) { const x = -10.5 + k * 3.5; zaunPos.push([x, -9.8, 0]); if (k !== 2) zaunPos.push([x, 11.2, 0]); }
  for (let k = 0; k < 6; k++) { const z = -9.8 + 1.75 + k * 3.5; zaunPos.push([-10.5, z, 1]); zaunPos.push([10.5, z, 1]); }
  for (const [x, z, r] of zaunPos) {
    const f = mesh(box, zaunMat, x + (r ? 0 : 1.75), 1, z, r ? 0.05 : 3.45, 2, r ? 3.45 : 0.05, zaun); f.castShadow = false;
    mesh(box, M(0x8e9294), x, 0.07, z, 0.5, 0.14, 0.25, zaun);
  }
  const schild = mesh(new THREE.PlaneGeometry(3.2, 1.6), M(0xffffff, { map: schildTex(), roughness: 0.7 }), 3.2, 2.1, 11.28); schild.castShadow = false;
  const schildPfosten = [mesh(box, M(C.anthrazit), 1.7, 1.2, 11.25, 0.08, 2.4, 0.08), mesh(box, M(C.anthrazit), 4.7, 1.2, 11.25, 0.08, 2.4, 0.08)];
  const container = new THREE.Group(); container.position.set(7.6, 0, -6.8); scene.add(container);
  mesh(box, M(C.creme), 0, 1.35, 0, 6, 2.6, 2.4, container); mesh(box, M(C.terracotta), 0, 2.72, 0, 6.05, 0.16, 2.45, container);
  mesh(box, glasMat, -1.2, 1.6, 1.21, 1.2, 0.8, 0.02, container); mesh(box, M(C.anthrazit), 1.6, 1.1, 1.21, 0.9, 2, 0.02, container);
  const wc = mesh(box, M(0x4f7a8c), 3.7, 1.15, -6.5, 1.1, 2.3, 1.1);
  const gruppeBaustelle = [zaun, schild, ...schildPfosten, container, wc];

  // Gerüst
  const geruest = new THREE.Group(); scene.add(geruest);
  const rohr = M(C.stahl, { metalness: 0.6, roughness: 0.4 }), diele = M(0xa98a60);
  const GX = LX / 2 + 0.9, GZ = LZ / 2 + 0.9;
  const pfosten = [];
  for (let x = -GX; x <= GX + 0.01; x += (2 * GX) / 5) { pfosten.push([x, GZ], [x, -GZ]); }
  for (let z = -GZ + (2 * GZ) / 4; z < GZ - 0.01; z += (2 * GZ) / 4) { pfosten.push([GX, z], [-GX, z]); }
  const pf = new THREE.InstancedMesh(box, rohr, pfosten.length);
  pfosten.forEach(([x, z], i) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, 3.3, z), new THREE.Quaternion(), new THREE.Vector3(0.06, 6.6, 0.06)); pf.setMatrixAt(i, m); });
  pf.castShadow = true; geruest.add(pf);
  for (const y of [2.1, 4.2, 6.3]) {
    mesh(box, diele, 0, y, GZ - 0.3, 2 * GX, 0.05, 0.6, geruest); mesh(box, diele, 0, y, -GZ + 0.3, 2 * GX, 0.05, 0.6, geruest);
    mesh(box, diele, GX - 0.3, y, 0, 0.6, 0.05, 2 * GZ, geruest); mesh(box, diele, -GX + 0.3, y, 0, 0.6, 0.05, 2 * GZ, geruest);
    mesh(box, rohr, 0, y + 1, GZ + 0.02, 2 * GX, 0.04, 0.04, geruest); mesh(box, rohr, 0, y + 1, -GZ - 0.02, 2 * GX, 0.04, 0.04, geruest);
    mesh(box, rohr, GX + 0.02, y + 1, 0, 0.04, 0.04, 2 * GZ, geruest); mesh(box, rohr, -GX - 0.02, y + 1, 0, 0.04, 0.04, 2 * GZ, geruest);
  }
  geruest.visible = false;

  // Turmdrehkran (DienerHaus-Terracotta)
  const kran = new THREE.Group(); kran.position.set(-8.6, 0, -6.6); scene.add(kran);
  const kranMat = M(C.terracotta, { roughness: 0.6 }), kranHell = M(C.creme);
  mesh(box, M(0x77726a), 0, 0.3, 0, 2.4, 0.6, 2.4, kran);
  const mast = mesh(box, kranMat, 0, 8, 0, 0.7, 15.4, 0.7, kran);
  for (let y = 1.2; y < 15.5; y += 1.4) mesh(box, kranHell, 0, y, 0, 0.74, 0.08, 0.74, kran);
  const dreh = new THREE.Group(); dreh.position.y = 15.7; kran.add(dreh);
  mesh(box, kranHell, 0.6, 0.6, 0, 1.4, 1.2, 1.2, dreh);
  mesh(box, kranMat, 6.5, 1.35, 0, 16, 0.45, 0.6, dreh);
  mesh(box, kranMat, -3.2, 1.35, 0, 5, 0.45, 0.6, dreh);
  mesh(box, M(0x8f8a82), -5.2, 0.8, 0, 1.4, 1.2, 1, dreh);
  mesh(box, kranMat, 0, 2.6, 0, 0.35, 2.6, 0.35, dreh);
  const warnLicht = mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0x441111 }), 0, 4, 0, 1, 1, 1, dreh);
  const katze = new THREE.Group(); katze.position.set(9, 1.1, 0); dreh.add(katze);
  const seil = mesh(box, M(0x222222), 0, -4, 0, 0.03, 8, 0.03, katze); seil.castShadow = false;
  const last = mesh(box, M(C.mauer), 0, -8.2, 0, 1.1, 0.55, 0.9, katze);
  kran.visible = false;

  // Bagger
  const bagger = new THREE.Group(); bagger.position.set(-6.5, 0, 3.4); bagger.rotation.y = 0.6; scene.add(bagger);
  mesh(box, M(0x3a3734), 0, 0.35, 0, 2.6, 0.6, 2, bagger);
  const oberwagen = new THREE.Group(); oberwagen.position.y = 0.7; bagger.add(oberwagen);
  mesh(box, M(C.terracotta), -0.2, 0.55, 0, 2.2, 1.1, 1.8, oberwagen); mesh(box, glasMat, 0.45, 1.25, 0.35, 0.9, 0.9, 0.85, oberwagen);
  const ausleger = new THREE.Group(); ausleger.position.set(0.9, 0.9, -0.4); oberwagen.add(ausleger);
  mesh(box, M(C.terracotta), 1.2, 0.6, 0, 2.6, 0.3, 0.3, ausleger).rotation.z = 0.45;
  const stiel = new THREE.Group(); stiel.position.set(2.4, 1.2, 0); ausleger.add(stiel);
  mesh(box, M(C.terracotta), 0.4, -0.9, 0, 0.25, 1.9, 0.25, stiel); mesh(box, M(0x3a3734), 0.55, -1.9, 0, 0.6, 0.45, 0.6, stiel);
  bagger.visible = false;

  // LKW
  const lkw = new THREE.Group(); lkw.position.set(-60, 0, 15.3); scene.add(lkw);
  mesh(box, M(C.creme), 2.6, 1.55, 0, 1.8, 2.2, 2.3, lkw); mesh(box, glasMat, 3.52, 1.95, 0, 0.04, 0.9, 2.0, lkw);
  mesh(box, M(C.terracotta), 2.6, 0.55, 0, 1.85, 0.25, 2.35, lkw);
  mesh(box, M(0x55504a), -1.2, 0.85, 0, 5.4, 0.3, 2.3, lkw);
  const ladung = mesh(box, M(C.mauer), -1.2, 1.55, 0, 4, 1.1, 1.9, lkw);
  const raeder = [];
  for (const x of [-2.8, -1.2, 2.6]) for (const z of [-1.05, 1.05]) { const r = mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 14), M(0x222020), x, 0.48, z, 1, 1, 1, lkw); r.rotation.x = Math.PI / 2; raeder.push(r); }
  let lkwT = -1, lkwQueue = 0;

  // Arbeiter
  const vest = M(0xe0702f), helm = M(0xf4f0e6), hose = M(0x3b4250);
  const arbeiter = [];
  for (let i = 0; i < 6; i++) {
    const a = new THREE.Group(); scene.add(a);
    mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.8, 8), hose, 0, 0.4, 0, 1, 1, 1, a);
    mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.65, 8), vest, 0, 1.12, 0, 1, 1, 1, a);
    mesh(new THREE.SphereGeometry(0.15, 10, 8), M(0xd9a582), 0, 1.6, 0, 1, 1, 1, a);
    mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), helm, 0, 1.66, 0, 1, 0.8, 1, a);
    a.visible = false;
    const winkel = (i / 6) * Math.PI * 2;
    a.userData = { winkel, speed: 0.08 + Math.random() * 0.06, phase: Math.random() * 10, r: 7 + Math.random() * 1.5 };
    arbeiter.push(a);
  }

  // Regen
  const REGEN_N = qualitaet === 'hoch' ? 1400 : 500;
  const regenGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(REGEN_N * 6);
  for (let i = 0; i < REGEN_N; i++) { const x = (Math.random() - 0.5) * 50, y = Math.random() * 25, z = (Math.random() - 0.5) * 50; rp.set([x, y, z, x + 0.05, y - 0.7, z + 0.03], i * 6); }
  regenGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const regen = new THREE.LineSegments(regenGeo, new THREE.LineBasicMaterial({ color: 0xc9d4dc, transparent: true, opacity: 0.55 }));
  regen.visible = false; regen.frustumCulled = false; scene.add(regen);

  // ---------- Zustand & Update ----------
  const ziel = { erd: 0, roh: 0, dach: 0, fen: 0, ins: 0, inn: 0, aus: 0 };
  const anz = { ...ziel };
  let aktiv = {}, wetter = 'sonne', kranKaputt = false, finale = false, finaleT = 0;
  let wetterMix = 0;

  function anwenden() {
    const { erd, roh, dach, fen, ins, inn, aus } = anz;
    // Erdarbeiten
    matschMat.opacity = Math.min(1, erd * 5) * (1 - seg(aus, 0, 0.5)) * 0.95;
    matsch.visible = matschMat.opacity > 0.01;
    const g1 = seg(erd, 0.02, 0.35); grube.visible = g1 > 0 && aus < 0.4; grube.scale.set(Math.max(0.01, g1), Math.max(0.01, g1), 1);
    haufen.visible = erd > 0.02; haufen.scale.setScalar(Math.max(0.01, seg(erd, 0.02, 0.4) * (1 - seg(aus, 0.1, 0.6) * 0.9)));
    const s1 = seg(erd, 0.35, 0.6); schotter.visible = s1 > 0; schotter.scale.set(Math.max(0.01, s1), 1, 1);
    const p1 = seg(erd, 0.6, 1); platte.visible = p1 > 0; platte.scale.y = Math.max(0.001, p1) * H0; platte.position.y = (p1 * H0) / 2;
    // Rohbau
    const eg = seg(roh, 0, 0.45), dk = seg(roh, 0.45, 0.52), og = seg(roh, 0.52, 0.88), gb = seg(roh, 0.88, 1);
    const egN = lagen.grenzen[NL - 1], ogN = lagen.grenzen[2 * NL - 1];
    steine.count = Math.floor(eg * egN + og * (ogN - egN));
    decke.visible = dk > 0; decke.scale.set(LX * Math.max(0.01, dk), DE, LZ);
    giebel[0].visible = giebel[2].visible = gb > 0; clipStein.constant = OG_TOP + RISE * gb + 0.001;
    // Dach
    const stuhl = seg(dach, 0, 0.4), deck = seg(dach, 0.4, 1);
    pfette.visible = stuhl > 0.3;
    for (const d of dachSeiten) {
      d.sparren.count = Math.floor(stuhl * 15); d.latten.count = Math.floor(seg(dach, 0.25, 0.45) * 10);
      d.deck.visible = deck > 0; d.deck.scale.y = Math.max(0.001, deck * dachL);
    }
    first.visible = deck > 0.97;
    // Fenster
    const nF = Math.round(fen * fenster.length); fenster.forEach((f, i) => (f.visible = i < nF));
    // Haustechnik
    wp.visible = ins > 0.3; const pvN = Math.floor(seg(ins, 0.45, 0.9) * pvTeile.length); pvTeile.forEach((p, i) => (p.visible = i < pvN));
    // Innenausbau / Putz (außen sichtbar)
    const pz = seg(inn, 0, 0.4);
    putz.count = Math.floor(seg(pz, 0, 0.85) * putzL.mats.length);
    giebel[1].visible = giebel[3].visible = pz > 0.85; clipPutz.constant = OG_TOP + RISE * seg(pz, 0.85, 1) + 0.002;
    // Außenanlagen
    zufahrt.visible = stellplatz.visible = aus > 0.2; zufahrt.scale.z = 7.6 * seg(aus, 0.2, 0.5) + 0.01; stellplatz.scale.z = 7 * seg(aus, 0.25, 0.55) + 0.01;
    terrasse.visible = aus > 0.45; terrasse.scale.x = 6 * seg(aus, 0.45, 0.7) + 0.01;
    gartenBaeume.forEach((b, i) => { const v = seg(aus, 0.6 + i * 0.1, 0.85 + i * 0.05); b.visible = v > 0; b.scale.setScalar(Math.max(0.01, v) * [0.9, 0.75, 0.7][i]); });
    heckenNeu.forEach((h) => { const v = seg(aus, 0.7, 1); h.visible = v > 0; h.scale.y = Math.max(0.01, v); h.position.y = v / 2; });
    briefkasten.visible = aus > 0.9;
    // Baustelleneinrichtung
    kran.visible = !!((roh > 0.001 || aktiv.roh) && dach < 0.999);
    geruest.visible = roh > 0.48 && pz < 0.98;
    bagger.visible = !!aktiv.erd || (erd > 0.02 && erd < 0.98);
    gruppeBaustelle.forEach((g) => (g.visible = !finale));
  }

  // ---------- Qualität & Größe ----------
  function setzeQualitaet(q) {
    qualitaet = q;
    const hoch = q === 'hoch';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hoch ? 2 : 1));
    renderer.shadowMap.enabled = hoch;
    sonne.castShadow = hoch;
    sonne.shadow.mapSize.set(2048, 2048);
    if (sonne.shadow.map) { sonne.shadow.map.dispose(); sonne.shadow.map = null; }
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    groesse();
  }
  function groesse() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 52 : 38;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', groesse);
  setzeQualitaet(qualitaet);

  // ---------- Loop ----------
  const uhr = new THREE.Clock();
  let rest = 0, t = 0, fpsSumme = 0, fpsFrames = 0, autoGeprueft = false, frameSkip = false;
  function frame() {
    requestAnimationFrame(frame);
    rest += uhr.getDelta();
    if (qualitaet !== 'hoch') { frameSkip = !frameSkip; if (frameSkip) return; }
    const roh = rest; const dt = Math.min(0.1, rest); rest = 0; t += dt;
    if (!autoGeprueft && t > 1.5 && roh < 0.5 && !document.hidden) { fpsSumme += roh; fpsFrames++; if (fpsFrames >= 90) { autoGeprueft = true; if (fpsSumme / fpsFrames > 1 / 28 && qualitaet === 'hoch') { setzeQualitaet('sparsam'); opts.onQualitaet && opts.onQualitaet('sparsam'); } } }
    let bewegt = false;
    for (const k in ziel) { const d = ziel[k] - anz[k]; if (Math.abs(d) > 0.0005) { { const dl = Math.min(0.3, roh); anz[k] += Math.sign(d) * Math.min(Math.abs(d), Math.max(Math.abs(d) * dl * 2.2, dl * 0.25)); } bewegt = true; } else if (anz[k] !== ziel[k]) { anz[k] = ziel[k]; bewegt = true; } }
    if (bewegt) anwenden();
    // Wetter
    wetterMix += ((wetter === 'regen' ? 1 : 0) - wetterMix) * Math.min(1, dt * 1.5);
    regen.visible = wetterMix > 0.05;
    if (regen.visible) {
      const a = regenGeo.attributes.position.array;
      for (let i = 0; i < REGEN_N; i++) { const j = i * 6; let y = a[j + 1] - dt * 22; if (y < 0) y += 25; a[j + 1] = y; a[j + 4] = y - 0.7; }
      regenGeo.attributes.position.needsUpdate = true; regen.material.opacity = 0.55 * wetterMix;
    }
    const abend = finale ? Math.min(1, finaleT / 3) : 0; if (finale) finaleT += dt;
    scene.background = abend > 0.5 ? himmelAbend : wetterMix > 0.5 ? himmelRegen : himmelSonne;
    sonne.intensity = 2.4 * (1 - 0.65 * wetterMix) * (1 - 0.35 * abend);
    sonne.color.setHex(abend > 0 ? 0xffc98f : 0xfff0da);
    hemi.intensity = 1.1 * (1 - 0.25 * wetterMix) * (1 - 0.25 * abend);
    scene.fog.color.setHex(wetterMix > 0.5 ? 0xaeb0ad : abend > 0.5 ? 0xeab890 : 0xece5d8);
    scene.fog.near = 45 - 25 * wetterMix;
    glasMat.emissiveIntensity = 0.9 * abend;
    // Kran
    if (kran.visible) {
      if (!kranKaputt) { dreh.rotation.y = Math.sin(t * 0.25) * 1.1 + 0.6; katze.position.x = 7 + Math.sin(t * 0.4) * 3; last.position.y = -8.2 + Math.sin(t * 0.6) * 1.5; seil.scale.y = 8 - Math.sin(t * 0.6) * 1.5; seil.position.y = -seil.scale.y / 2; }
      warnLicht.material.color.setHex(kranKaputt ? (Math.sin(t * 8) > 0 ? 0xff2a1a : 0x441111) : 0x441111);
    }
    // Bagger
    if (bagger.visible) { oberwagen.rotation.y = Math.sin(t * 0.7) * 0.8; ausleger.rotation.z = -0.15 + Math.sin(t * 1.4) * 0.2; stiel.rotation.z = -0.3 + Math.sin(t * 1.4 + 1) * 0.35; }
    if (wp.visible) luefter.rotation.x += dt * 6;
    // LKW
    if (lkwT < 0 && lkwQueue > 0) { lkwQueue--; lkwT = 0; ladung.visible = true; }
    if (lkwT >= 0) {
      lkwT += dt; let x;
      if (lkwT < 4) { x = -60 + (52 * (1 - Math.pow(1 - lkwT / 4, 2))); lkw.rotation.y = 0; }
      else if (lkwT < 6.5) { x = -8; if (lkwT > 5) ladung.visible = false; }
      else if (lkwT < 11) { const u = (lkwT - 6.5) / 4.5; x = -8 + 70 * u * u; }
      else { x = -60; lkwT = -1; }
      const vx = x - lkw.position.x; lkw.position.x = x; raeder.forEach((r) => (r.rotation.y -= vx / 0.48));
    }
    // Arbeiter
    const anzahlA = finale ? 0 : Math.min(6, Object.values(aktiv).reduce((a, n) => a + n, 0));
    arbeiter.forEach((a, i) => {
      a.visible = i < anzahlA;
      if (!a.visible) return;
      const u = a.userData; u.winkel += u.speed * dt * (wetterMix > 0.5 ? 0.5 : 1);
      const x = Math.cos(u.winkel) * u.r, z = Math.sin(u.winkel) * (u.r * 0.85);
      a.position.set(x, Math.abs(Math.sin((t + u.phase) * 6)) * 0.04, z); a.rotation.y = -u.winkel;
    });
    controls.update();
    renderer.render(scene, camera);
  }
  anwenden(); frame();

  return {
    setze(fortschritt, aktiveTrupps) { Object.assign(ziel, fortschritt); aktiv = aktiveTrupps || {}; anwenden(); },
    springe(fortschritt) { Object.assign(ziel, fortschritt); Object.assign(anz, fortschritt); anwenden(); },
    wetter(w) { wetter = w; },
    kranDefekt(b) { kranKaputt = b; },
    lieferung() { lkwQueue = Math.min(2, lkwQueue + 1); },
    finale(b = true) { finale = b; finaleT = 0; anwenden(); },
    setzeQualitaet,
    get qualitaet() { return qualitaet; },
    groesse,
  };
}
