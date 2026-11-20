/* Facce buffe in stile anime (v1.2): occhi disegnati (><, spirali, stelle, cuori…) al posto di quelli veri.
 *
 * I modelli VRoid hanno già un "posto" per gli occhi speciali: la mesh EyeExtra, due riquadri davanti agli occhi
 * (forma EyeExtra_On) con una texture vuota di 8×8 pixel, e la forma del viso Fcl_EYE_Extra che nasconde occhi,
 * ciglia e iridi. Qui la texture viene sostituita da un disegno su <canvas>: metà sinistra = occhio a sinistra di
 * chi guarda, metà destra = l'altro. Misurato sul modello di riferimento (stessa disposizione VRoid): centro dell'occhio a
 * (128, 118) di ogni metà; un pixel in verticale sullo schermo vale 1,25 pixel in orizzontale.
 */
const W = 512, H = 256, CY = 118, SY = 1.25;
const INK = "#4a1a1a";

/** Prepara la mesh degli occhi speciali del modello; null se il modello non la ha (modelli non VRoid) */
export function setupFunny(vrm, THREE) {
  const meshes = [], mats = [];
  vrm.scene.traverse(o => {
    if (!o.isMesh) return;
    const ms = [].concat(o.material).filter(m => m && /EyeExtra/i.test(m.name || ""));
    if (ms.length) { mats.push(...ms); if (o.morphTargetInfluences && o.morphTargetInfluences.length) meshes.push(o); }
  });
  if (!mats.length || !meshes.length) return null;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
  for (const m of mats) {
    m.map = tex;
    if ("shadeMultiplyTexture" in m) m.shadeMultiplyTexture = tex;
    // i riquadri stanno quasi sulla pelle: senza spostamento in profondità la pelle "buca" il disegno (visto su un altro modello)
    m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -16;
    m.needsUpdate = true;
  }
  let drawn = null;
  return {
    /** Disegna la faccia (nome in FACES), solo se è cambiata */
    draw(face) {
      if (drawn === face) return;
      drawn = face;
      const g = canvas.getContext("2d"), F = FACES[face];
      g.clearRect(0, 0, W, H);
      if (F && F.eyes) for (const side of [0, 1]) {
        g.save();
        g.translate(128 + 256 * side, CY); g.scale(1, SY);
        g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 13; g.lineCap = "round"; g.lineJoin = "round";
        if (F.blush) blush(g);
        F.eyes(g, side ? -1 : 1);   // s = 1 per l'occhio a sinistra di chi guarda, -1 per l'altro (simboli speculari)
        if (F.sweat && side === 1) sweat(g);
        if (F.tears) tears(g);
        g.restore();
      }
      tex.needsUpdate = true;
    },
    /** Mostra (1) o nasconde (0) i riquadri disegnati */
    show(v) { for (const o of meshes) o.morphTargetInfluences[0] = v; },
    dispose() { tex.dispose(); },
  };
}

// ---- Disegni: coordinate centrate sull'occhio, in "pixel dello schermo" (l'occhio vero è largo ~170 e alto ~95) ----
const line = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };

function chevron(g, s) { g.lineWidth = 15; line(g, [[-46 * s, -36], [46 * s, 0], [-46 * s, 36]]); }   // > per l'occhio di sinistra, < per l'altro

function spiral(g) {
  g.lineWidth = 9; g.beginPath();
  for (let a = 0; a < Math.PI * 7; a += 0.15) { const r = 3 + a * 2.1; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9); }
  g.stroke();
}

function arc(g, up, w = 44, h = 22) {   // ^ (up) oppure ∪
  g.beginPath(); g.moveTo(-w, up ? 10 : -10); g.quadraticCurveTo(0, up ? -h - 18 : h + 18, w, up ? 10 : -10); g.stroke();
}

function star(g, r = 58) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
  g.closePath(); g.fillStyle = "#ffd84a"; g.fill(); g.lineWidth = 7; g.stroke();
}

function heart(g, r = 44) {
  g.beginPath(); g.moveTo(0, r * 0.9);
  g.bezierCurveTo(-r * 1.6, -r * 0.1, -r * 0.7, -r * 1.25, 0, -r * 0.45);
  g.bezierCurveTo(r * 0.7, -r * 1.25, r * 1.6, -r * 0.1, 0, r * 0.9);
  g.closePath(); g.fillStyle = "#f0507a"; g.fill(); g.lineWidth = 6; g.strokeStyle = "#9a1838"; g.stroke();
}

function blush(g) {
  g.save(); g.strokeStyle = "rgba(240, 90, 110, 0.75)"; g.lineWidth = 7;
  for (let i = -2; i <= 2; i++) line(g, [[i * 17 - 8, 62], [i * 17 + 6, 44]]);
  g.restore();
}

function sweat(g) {   // goccia di sudore sopra l'occhio, verso l'esterno
  g.save(); g.translate(80, -56); g.fillStyle = "#8fd3ff"; g.strokeStyle = "#3d8fc4"; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, -20); g.bezierCurveTo(12, -4, 14, 8, 0, 12); g.bezierCurveTo(-14, 8, -12, -4, 0, -20);
  g.fill(); g.stroke(); g.restore();
}

function tears(g) {   // due rivoli di lacrime che scendono dagli occhi
  g.save(); g.strokeStyle = "rgba(120, 200, 255, 0.85)"; g.lineWidth = 12;
  line(g, [[-26, 8], [-28, 95]]); line(g, [[26, 8], [28, 95]]);
  g.restore();
}

/** Facce: occhi disegnati (eyes; senza = occhi veri) e forme VRoid del resto del viso (face, valori 0–1) */
export const FACES = {
  strizza: { eyes: (g, s) => chevron(g, s), blush: true, face: { Fcl_MTH_Joy: 0.7, Fcl_BRW_Joy: 1 } },            // > <
  stordito: { eyes: g => spiral(g), sweat: true, face: { Fcl_MTH_Sorrow: 0.6, Fcl_MTH_Small: 0.3, Fcl_BRW_Sorrow: 0.7 } }, // @ @
  uffa: { eyes: g => line(g, [[-46, 4], [46, 4]]), sweat: true, face: { Fcl_MTH_Down: 0.5, Fcl_MTH_Small: 0.4 } },         // - -
  puntini: { eyes: g => { g.beginPath(); g.arc(0, 2, 12, 0, Math.PI * 2); g.fill(); }, blush: true, face: { Fcl_MTH_Fun: 1, Fcl_MTH_U: 0.25 } }, // • •
  stelle: { eyes: g => star(g), face: { Fcl_MTH_Joy: 0.9, Fcl_BRW_Surprised: 1 } },                                // ★ ★
  cuori: { eyes: g => heart(g), blush: true, face: { Fcl_MTH_Fun: 1, Fcl_BRW_Joy: 0.8 } },                          // ♥ ♥
  lacrime: { eyes: g => arc(g, true), tears: true, face: { Fcl_MTH_Sorrow: 1, Fcl_BRW_Sorrow: 1 } }, // ∩ ∩ con i lacrimoni
  felice: { eyes: g => arc(g, true), blush: true, face: { Fcl_MTH_Joy: 0.6, Fcl_BRW_Joy: 1 } },                      // ^ ^
  vampiro: { face: { Fcl_HA_Fung1: 1, Fcl_MTH_Joy: 0.45, Fcl_MTH_Fun: 0.6, Fcl_EYE_Angry: 0.5, Fcl_BRW_Angry: 0.7 } },  // ghigno con i canini
  occhiolino: { eyes: (g, s) => { if (s > 0) chevron(g, 1); else { g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill(); } }, blush: true, face: { Fcl_MTH_Joy: 0.55, Fcl_BRW_Fun: 1 } }, // > •
  sbalordito: { eyes: g => { g.lineWidth = 10; g.beginPath(); g.ellipse(0, 0, 34, 30, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill(); }, face: { Fcl_MTH_Surprised: 0.7, Fcl_BRW_Surprised: 1 } }, // O O
};
