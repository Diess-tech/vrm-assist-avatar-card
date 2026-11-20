/* Temi delle feste (v1.8): oggetti 3D e piccoli effetti aggiunti dalla card, uguali per tutti i modelli.
 *   theme: nessuno | automatico (in base alla data) | halloween | natale     theme_entity: es. input_select.avatar_tema
 * Il cappello è agganciato all'osso della testa (segue ogni movimento); pipistrelli e neve stanno nella scena.
 */

// periodi per "automatico" (mese-giorno, estremi compresi; natale passa da un anno all'altro)
export const THEME_DATES = { halloween: ["10-24", "11-02"], natale: ["12-08", "01-06"] };
const ALIASES = {
  automatico: "auto", auto: "auto", automatic: "auto", data: "auto",
  nessuno: null, nessuna: null, none: null, off: null, no: null, "": null,
  halloween: "halloween", strega: "halloween",
  natale: "natale", christmas: "natale", xmas: "natale", "babbo natale": "natale",
};
/** "Halloween", "automatico", "none"… → "halloween" | "natale" | "auto" | null (undefined = sconosciuto) */
export function themeName(s) {
  const k = String(s ?? "").trim().toLowerCase();
  return k in ALIASES ? ALIASES[k] : undefined;
}
export function themeForDate(d = new Date()) {
  const md = String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  for (const [name, [a, b]] of Object.entries(THEME_DATES))
    if (a <= b ? md >= a && md <= b : md >= a || md <= b) return name;
  return null;
}

// ---------------------------------------------------------------- misure della testa
/** Vertici del modello a riposo (mondo): cima dei capelli e ingombro dei capelli all'altezza della tesa */
function hairPoints(vrm, THREE) {
  vrm.scene.updateMatrixWorld(true);
  const v = new THREE.Vector3(), pts = [];
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 8000));
    for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); pts.push(v.x, v.y, v.z); }
  });
  return pts;
}

/** Da chiamare al caricamento, con il modello a riposo. v1.8.1: il cappello non poggia più sopra i capelli ma calza
 *  la testa: la tesa sta poco sopra gli occhi e i capelli dentro il cappello si nascondono (hatMask). Il punto di
 *  appoggio è salvato in coordinate dell'osso della testa, così si può accendere il tema anche a testa in movimento. */
export function measureHead(vrm, THREE) {
  const head = vrm.humanoid.getRawBoneNode("head");
  if (!head) return null;
  const W = o => o.getWorldPosition(new THREE.Vector3());
  const hp = W(head), eyeB = vrm.humanoid.getRawBoneNode("leftEye") || vrm.humanoid.getRawBoneNode("rightEye");
  const pts = hairPoints(vrm, THREE);
  let top = -Infinity;
  for (let i = 1; i < pts.length; i += 3) top = Math.max(top, pts[i]);
  // altezza della tesa: 5,5 cm sopra gli occhi (fronte), ma almeno 4 cm sotto la cima dei capelli
  const eyeY = eyeB ? W(eyeB).y : hp.y + 0.07;
  const brimY = Math.min(eyeY + 0.055, top - 0.04);
  // ingombro dei capelli tra la tesa e 3 cm sopra: centro in profondità e mezze larghezze
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const y = pts[i + 1]; if (y < brimY - 0.005 || y > brimY + 0.03) continue;
    minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); minZ = Math.min(minZ, pts[i + 2]); maxZ = Math.max(maxZ, pts[i + 2]);
  }
  const ok = isFinite(minX);
  const cz = ok ? (minZ + maxZ) / 2 : hp.z;
  const half = ok ? Math.max(maxX - hp.x, hp.x - minX, (maxZ - minZ) / 2) : 0.1;
  // (l'oggetto di misura sta fuori dalla scena del modello: i VRM0 sono girati di 180° e il cappello veniva al contrario)
  const dummy = new THREE.Object3D();
  dummy.position.set(hp.x, brimY, cz);
  dummy.updateMatrixWorld(true);
  head.attach(dummy);
  const anchor = { pos: dummy.position.clone(), quat: dummy.quaternion.clone(), top, brimY, half, headY: hp.y };
  head.remove(dummy);
  return anchor;
}

/** I capelli (e la cima della testa) dentro il cappello non si disegnano, e sotto la tesa c'è un po' d'ombra:
 *  così il cappello sembra calzato, non appoggiato. Si aggiunge una volta ai materiali del modello (MToon compresi). */
const MAIN = /void\s+main\s*\(\s*(void)?\s*\)\s*\{/;
export function hatMask(vrm, THREE) {
  if (vrm.scene.userData.hatMask) return vrm.scene.userData.hatMask;
  const U = { hatInv: { value: new THREE.Matrix4() }, hatOn: { value: 0 }, hatR: { value: 0.15 }, hatDroop: { value: 0.025 } };
  const patch = m => {
    if (!m || m.userData.hatPatched) return;
    m.userData.hatPatched = true;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      Object.assign(sh.uniforms, U);
      if (!sh.vertexShader.includes("#include <skinning_vertex>")) return;
      sh.vertexShader = sh.vertexShader
        .replace(MAIN, "varying vec3 vHatW;\nvoid main() {")
        .replace("#include <skinning_vertex>", "#include <skinning_vertex>\n  vHatW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      // dichiarazioni in cima: hatK è globale perché MToon fa la correzione finale del colore in una funzione
      // scritta prima del main
      sh.fragmentShader = "uniform mat4 hatInv; uniform float hatOn; uniform float hatR; uniform float hatDroop;\nvarying vec3 vHatW;\nfloat hatK = 1.0;\n" + sh.fragmentShader
        .replace(MAIN, `void main() {
  vec3 hatP = (hatInv * vec4(vHatW, 1.0)).xyz; float hatQ = length(hatP.xz) / hatR;
  // dentro il cappello (sopra la tesa, che scende un poco verso il bordo): non si disegna
  if (hatOn > 0.5 && hatQ < 1.0 && hatP.y > -0.004 - hatDroop * hatQ * hatQ) discard;
  // ombra della tesa sui capelli e sulla fronte, più forte vicino al cappello
  hatK = 1.0;
  if (hatOn > 0.5 && hatQ < 1.15) hatK = 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.07, -hatP.y)) * (1.0 - smoothstep(0.9, 1.15, hatQ));`)
;
      // (l'ombra va applicata nel main: in MToon lo stesso include compare anche prima, in un'altra funzione)
      const TM = "#include <tonemapping_fragment>", at = sh.fragmentShader.lastIndexOf(TM);
      if (at >= 0) sh.fragmentShader = sh.fragmentShader.slice(0, at) + "gl_FragColor.rgb *= hatK;\n  " + sh.fragmentShader.slice(at);
    };
    m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : "") + "|hatmask"; };
    m.needsUpdate = true;
  };
  vrm.scene.traverse(o => { if (o.isMesh && !o.userData.isHat) [].concat(o.material).forEach(patch); });
  return (vrm.scene.userData.hatMask = U);
}

// ---------------------------------------------------------------- oggetti
function toon(THREE, color, extra = {}) {
  // un po' di luce propria (emissive): con l'unica luce frontale della card il lato in ombra diventava nero
  const c = new THREE.Color(color);
  return new THREE.MeshToonMaterial({ color: c, emissive: c.clone().multiplyScalar(0.35), ...extra });
}
/** Cono morbido con la punta piegata all'indietro e di lato (cappello da strega e da Babbo Natale) */
function bentCone(THREE, r0, h, bend, side, seg = 28, crown = 0) {
  // crown: parte bassa quasi dritta (frazione dell'altezza) che contiene i capelli, poi la punta
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16;
    const r = f < crown ? r0 * (1 - 0.18 * f / crown) : r0 * 0.82 * Math.pow(1 - (f - crown) / (1 - crown), 1.2);
    prof.push(new THREE.Vector2(Math.max(0.001, crown ? r : r0 * Math.pow(1 - f, 1.15)), h * f));
  }
  const g = new THREE.LatheGeometry(prof, seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = p.getY(i) / h, k = f * f * f;
    // la punta si piega: indietro (−z) e un po' di lato, e si abbassa
    p.setXYZ(i, p.getX(i) + side * bend * 0.45 * k, p.getY(i) - bend * 0.35 * k, p.getZ(i) - bend * k);
  }
  g.computeVertexNormals();
  return g;
}
function outline(THREE, mesh, w = 0.004) {
  // contorno scuro come quello dei modelli VRoid (guscio rovesciato appena più grande)
  const g = mesh.geometry.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x120a18, side: THREE.BackSide }));
  mesh.add(o);
  return o;
}

function witchHat(THREE, R) {
  const hat = new THREE.Group();
  const felt = toon(THREE, 0x2b1d3d, { side: THREE.DoubleSide });
  // tesa: disco largo con il bordo che scende un poco
  const prof = [];
  for (let i = 0; i <= 10; i++) { const r = R * i / 10; prof.push(new THREE.Vector2(r, -0.022 * Math.pow(i / 10, 2.2))); }
  const brimG = new THREE.LatheGeometry(prof, 40);
  // tesa un po' ondulata, da cappello di stoffa
  const bp = brimG.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), z = bp.getZ(i), r = Math.hypot(x, z) / R;
    bp.setY(i, bp.getY(i) + 0.008 * r * r * Math.sin(Math.atan2(z, x) * 3));
  }
  brimG.computeVertexNormals();
  const brim = new THREE.Mesh(brimG, felt); hat.add(brim); outline(THREE, brim, 0.003);
  // cupola a punta
  const r0 = R * 0.76, H = R * 1.85;
  const cone = new THREE.Mesh(bentCone(THREE, r0, H, R * 0.55, 1, 28, 0.3), felt); hat.add(cone); outline(THREE, cone);
  // nastro arancione con fibbia dorata
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.945 + 0.004, r0 + 0.004, R * 0.2, 32, 1, true), toon(THREE, 0xff7a1a, { side: THREE.DoubleSide }));
  band.position.y = R * 0.1 + 0.002; hat.add(band);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(R * 0.2, R * 0.17, 0.008), toon(THREE, 0xffd34d));
  buckle.position.set(0, R * 0.1, r0 * 0.975 + 0.007); hat.add(buckle);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(R * 0.11, R * 0.08, 0.01), toon(THREE, 0x2b1d3d));
  hole.position.copy(buckle.position).add(new THREE.Vector3(0, 0, 0.001)); hat.add(hole);
  return hat;
}

function santaHat(THREE, R) {
  const hat = new THREE.Group();
  const red = toon(THREE, 0xc81d25, { side: THREE.DoubleSide }), fur = toon(THREE, 0xf6f3ee);
  const r0 = R * 0.84, H = R * 2.1;
  const cone = new THREE.Mesh(bentCone(THREE, r0, H, R * 0.9, -1, 28, 0.25), red); hat.add(cone); outline(THREE, cone);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r0 * 1.03, R * 0.13, 14, 40), fur);
  rim.rotation.x = Math.PI / 2; rim.position.y = R * 0.06; hat.add(rim);
  // pompon sulla punta piegata (stessa piega di bentCone con f = 1)
  const b = R * 0.9, pom = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 16, 12), fur);
  pom.position.set(-b * 0.45, H - b * 0.35, -b); hat.add(pom);
  return hat;
}

function batShape(THREE) {
  // sagoma di pipistrello (metà destra, specchiata) in metri: apertura alare ~9 cm
  const s = new THREE.Shape();
  s.moveTo(0, 0.012); s.lineTo(0.006, 0.016); s.lineTo(0.008, 0.008);
  s.quadraticCurveTo(0.025, 0.02, 0.045, 0.014);
  s.quadraticCurveTo(0.038, 0.004, 0.036, -0.004); s.quadraticCurveTo(0.028, 0.002, 0.024, -0.006);
  s.quadraticCurveTo(0.017, -0.001, 0.012, -0.01); s.quadraticCurveTo(0.007, -0.006, 0, -0.012);
  return new THREE.ShapeGeometry(s);
}
function makeBat(THREE, mat, eyeMat) {
  const bat = new THREE.Group(), g = batShape(THREE);
  const R = new THREE.Mesh(g, mat), L = new THREE.Mesh(g, mat); L.scale.x = -1;
  const wR = new THREE.Group(), wL = new THREE.Group(); wR.add(R); wL.add(L);
  bat.add(wR, wL);
  // occhietti gialli: si vedono anche sul tema scuro di Home Assistant
  for (const x of [-0.0035, 0.0035]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.0018, 8), eyeMat); e.position.set(x, 0.008, 0.001); bat.add(e);
  }
  bat.userData.wings = [wR, wL];
  return bat;
}

function snowTexture(THREE) {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const x = c.getContext("2d"), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,0.8)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); return t;
}

// ---------------------------------------------------------------- tema completo
/**
 * Crea il tema per il modello: { name, update(dt, t, cam), dispose(), light, vampire }
 * scene = scena della card; il cappello va sull'osso della testa del modello (che deve essere a riposo).
 */
export function buildTheme(name, vrm, THREE, scene, H) {
  const head = vrm.humanoid.getRawBoneNode("head");
  if (!head || !H) return null;
  const headPos = { y: H.headY };
  const parts = [], sceneParts = [];
  const T = { name, light: 0xffffff, vampire: false, update() {} };

  // --- cappello: calza la testa con la tesa sopra la fronte; tesa poco più larga dei capelli a quell'altezza
  const santa = name === "natale";
  const R = Math.min(0.21, Math.max(0.12, H.half * (santa ? 1.28 : 1.42)));
  const hat = santa ? santaHat(THREE, R) : witchHat(THREE, R);
  // holder = punto d'appoggio misurato a riposo, orientato come il mondo (viso verso +z), agganciato alla testa
  const holder = new THREE.Group();
  holder.position.copy(H.pos); holder.quaternion.copy(H.quat);
  hat.position.set(0, santa ? -0.005 : 0, santa ? 0.0 : -0.01);
  // inclinato un po' all'indietro e di lato, per dargli carattere
  hat.rotation.set(santa ? -0.18 : -0.16, 0, santa ? 0.12 : -0.1);
  hat.traverse(o => { o.userData.isHat = true; });   // il cappello non va nascosto dalla sua stessa maschera
  holder.add(hat); head.add(holder);
  parts.push(holder);
  T.hat = hat;
  // maschera dei capelli: tutto ciò che sta sopra la tesa entro questo raggio non si disegna
  const mask = hatMask(vrm, THREE);
  mask.hatR.value = santa ? R * 1.1 : R * 0.97;   // Natale: fino al bordo di pelliccia (il cono è più stretto)
  mask.hatDroop.value = santa ? 0.0 : 0.028;
  mask.hatOn.value = 1;
  T.sync = () => { hat.updateWorldMatrix(true, false); mask.hatInv.value.copy(hat.matrixWorld).invert(); };
  T.sync();
  // punta del cappello (mondo, a riposo): l'inquadratura deve arrivare fin lassù
  T.hatTop = H.brimY + (santa ? R * 1.75 : R * 1.75) + 0.03;

  if (name === "halloween") {
    T.light = 0xfff1e2;   // luce appena più calda, da candela
    T.vampire = true;     // ogni tanto la faccia da vampiro (canini), per tutti gli atteggiamenti
    // pipistrelli che attraversano lo sfondo dietro il personaggio, uno o due alla volta
    // viola medio: si vede sia sul tema scuro sia su quello chiaro di Home Assistant
    const mat = new THREE.MeshBasicMaterial({ color: 0x6a4a92, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    const bats = [0, 1, 2].map(i => {
      const b = makeBat(THREE, mat, eyeMat); b.visible = false; scene.add(b); sceneParts.push(b);
      return { b, next: 1.5 + i * 3.5 + Math.random() * 3, t0: 0, dur: 0, from: 0, y: 0, z: 0, flap: 9 + Math.random() * 4, s: 1 };
    });
    T.update = (dt, t, cam) => {
      // larghezza visibile alla profondità dei pipistrelli (per entrare e uscire dai bordi)
      for (const B of bats) {
        if (!B.b.visible) {
          if (t < B.next) continue;
          B.z = -0.25 - Math.random() * 0.35; B.y = headPos.y - 0.05 + Math.random() * 0.3;
          const dist = cam.position.z - B.z, half = Math.tan(cam.fov * Math.PI / 360) * dist * cam.aspect + 0.08;
          B.from = Math.random() < 0.5 ? -1 : 1; B.half = half; B.t0 = t; B.dur = 3.2 + Math.random() * 2.5;
          B.s = 1.6 + Math.random() * 0.8; B.b.scale.setScalar(B.s); B.b.visible = true;
        }
        const u = (t - B.t0) / B.dur;
        if (u >= 1) { B.b.visible = false; B.next = t + 2 + Math.random() * 9; continue; }
        const x = B.from * B.half * (1 - 2 * u);
        B.b.position.set(x, B.y + 0.05 * Math.sin(u * 9) + 0.04 * Math.sin(u * 3.1), B.z);
        B.b.rotation.set(0.25, 0, -B.from * 0.25 + 0.15 * Math.sin(u * 9));
        const a = 0.9 * Math.sin(t * B.flap);
        B.b.userData.wings[0].rotation.y = a; B.b.userData.wings[1].rotation.y = -a;
      }
    };
  } else if (name === "natale") {
    T.light = 0xfff6ea;
    // neve: fiocchi che cadono intorno e davanti al personaggio
    const N = 140, pos = new Float32Array(N * 3), sp = new Float32Array(N);
    const top = H.top + 0.4, bottom = headPos.y - 0.75;
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1.6; pos[i * 3 + 1] = bottom + Math.random() * (top - bottom);
      pos[i * 3 + 2] = -0.5 + Math.random() * 0.9; sp[i] = 0.06 + Math.random() * 0.08;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ size: 0.024, map: snowTexture(THREE), transparent: true, depthWrite: false, opacity: 0.95 });
    const snow = new THREE.Points(g, m); scene.add(snow); sceneParts.push(snow);
    T.update = (dt, t) => {
      for (let i = 0; i < N; i++) {
        let y = pos[i * 3 + 1] - sp[i] * dt;
        if (y < bottom) y = top;
        pos[i * 3 + 1] = y; pos[i * 3] += Math.sin(t * 0.8 + i) * 0.01 * dt;
      }
      g.attributes.position.needsUpdate = true;
    };
  }

  T.dispose = () => {
    mask.hatOn.value = 0;
    for (const o of [...parts, ...sceneParts]) {
      o.parent && o.parent.remove(o);
      o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) { if (x.material.map) x.material.map.dispose(); x.material.dispose(); } });
    }
  };
  return T;
}
