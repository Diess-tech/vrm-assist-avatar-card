/* Taratura delle pose delle braccia sul modello caricato.
 * Le pose sono state trovate sul modello di riferimento (posizioni delle mani in metri). Per un altro modello le stesse posizioni si
 * proporzionano su spalle e busto, e si cercano di nuovo gli angoli (ricerca numerica, come solvePose nel banco di prova).
 * Così la mano al mento arriva al mento anche su un personaggio più piccolo o con le spalle più strette.
 */

// Misure di riferimento del modello di riferimento (metri)
const REF = { neckY: 1.452, hipsY: 1.008, shoulderX: 0.148 };

// Obiettivi: osso → posizione sul modello di riferimento; w = peso. "L" usa le ossa sinistre, "R" le destre.
// rel: posizione relativa a un altro osso già messo in posa (es. sotto il gomito destro); relY: solo l'altezza è relativa
const T = (bone, pos, w = 1, rel = null, relY = null) => ({ bone, pos, w, rel, relY });
const mirror = list => list.map(t => T(t.bone.replace("right", "left"), [-t.pos[0], t.pos[1], t.pos[2]], t.w));
const HIPS_R = [T("rightHand", [-0.165, 1.04, 0.03]), T("rightLowerArm", [-0.3, 1.17, -0.03], 0.7)];
const STRETCH_R = [T("rightHand", [-0.1, 1.86, 0.03]), T("rightLowerArm", [-0.22, 1.63, 0.01], 0.7)];
export const TARGETS = {
  // pose: [ { side, write: dove scrivere i valori, targets } ]
  pensa: [
    { side: "R", targets: [T("rightMiddleProximal", [-0.02, 1.482, 0.115], 1), T("rightHand", [-0.05, 1.415, 0.13], 1), T("rightLowerArm", [-0.12, 1.24, 0.15], 0.4)] },
    // braccio sinistro: la mano sotto il gomito destro, il gomito sinistro al fianco alla stessa altezza
    { side: "L", targets: [T("leftHand", [0.04, -0.04, 0.06], 1, "rightLowerArm"), T("leftMiddleProximal", [-0.03, -0.04, 0.06], 0.6, "rightLowerArm"),
                           T("leftLowerArm", [0.16, -0.03, 0.1], 0.8, null, "rightLowerArm")] },
  ],
  crossed: [
    { side: "L", targets: [T("leftHand", [-0.08, 1.25, 0.17]), T("leftLowerArm", [0.165, 1.21, 0.11], 0.8)] },
    { side: "R", targets: [T("rightHand", [0.08, 1.205, 0.13]), T("rightLowerArm", [-0.165, 1.185, 0.08], 0.8)] },
  ],
  clasped: [
    { side: "L", targets: [T("leftHand", [0.045, 1.0, 0.15]), T("leftMiddleProximal", [-0.01, 0.985, 0.18]), T("leftLowerArm", [0.17, 1.17, 0.03], 0.4)] },
    { side: "R", targets: [T("rightHand", [-0.045, 1.005, 0.165]), T("rightMiddleProximal", [0.01, 0.99, 0.195]), T("rightLowerArm", [-0.17, 1.17, 0.03], 0.4)] },
  ],
  hips: [{ side: "R", targets: HIPS_R }, { side: "L", targets: mirror(HIPS_R) }],
  tie: [{ side: "R", targets: [T("rightIndexDistal", [0.0, 1.405, 0.115]), T("rightHand", [-0.06, 1.33, 0.15]), T("rightLowerArm", [-0.18, 1.2, 0.1], 0.4)] }],
  stretch: [{ side: "R", targets: STRETCH_R }, { side: "L", targets: mirror(STRETCH_R) }],
  wave: [{ side: "R", targets: [T("rightHand", [-0.27, 1.6, 0.1]), T("rightMiddleProximal", [-0.28, 1.68, 0.12], 0.6), T("rightLowerArm", [-0.33, 1.33, 0.05], 0.6)] }],
  // pugno del tifo (v1.4): gomito giù accanto al fianco, pugno davanti alla spalla all'altezza del mento
  pump: [{ side: "R", targets: [T("rightHand", [-0.19, 1.43, 0.14]), T("rightMiddleProximal", [-0.18, 1.5, 0.16], 0.6), T("rightLowerArm", [-0.23, 1.18, 0.04], 0.8)] }],
};

/**
 * Ricalcola le pose: `poses` è { nome: oggetto con armL/fwdL/… da aggiornare } (stessi nomi di TARGETS).
 * `orig` contiene i valori del modello di riferimento da cui partire. Restituisce il numero di pose tarate.
 */
export function calibrateArms(card, vrm, poses, orig) {
  const sg = card._sign, THREE = card._THREE || card._L.THREE, h = vrm.humanoid;
  const raw = n => h.getRawBoneNode(n), nb = n => h.getNormalizedBoneNode(n);
  const P = n => raw(n).getWorldPosition(new THREE.Vector3());
  vrm.scene.updateMatrixWorld(true);
  // Proporzioni del modello rispetto a il modello di riferimento
  const neckY = P("neck").y, hipsY = P("hips").y, sh = Math.abs(P("rightUpperArm").x - P("leftUpperArm").x) / 2;
  const ky = (neckY - hipsY) / (REF.neckY - REF.hipsY), kx = sh / REF.shoulderX;
  const map = p => new THREE.Vector3(p[0] * kx, neckY + (p[1] - REF.neckY) * ky, p[2] * ky);
  const keys = X => ["arm", "fwd", "tw", "elb", "wr"].map(k => k + X);
  // Sagoma del busto: per ogni fascia di 2 cm di altezza, quanto sporge in avanti il corpo (vestiti compresi, capelli
  // esclusi) nella zona centrale. Le braccia nelle pose devono restare davanti a questa sagoma.
  const front = bodyFront(vrm, THREE);
  const R = 0.045; // spessore del braccio (con la manica)
  const inside = p => {
    // solo la zona del petto e della pancia (sopra c'è il collo, dove la mano di "pensa" deve arrivare)
    if (Math.abs(p.x) > 0.17 || p.y > neckY - 0.1 || p.y < hipsY) return 0;
    const f = front(p.y);
    return f === null ? 0 : Math.max(0, f + R - p.z);
  };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
  let done = 0;
  for (const [name, list] of Object.entries(TARGETS)) {
    const pose = poses[name];
    if (!pose) continue;
    for (const { side, targets } of list) {
      const s = sg[side === "L" ? "left" : "right"], sideName = side === "L" ? "left" : "right";
      const up = nb(sideName + "UpperArm"), lo = nb(sideName + "LowerArm"), hand = nb(sideName + "Hand");
      if (!s || !up || !lo || !hand) continue;
      const tg = targets.filter(t => raw(t.bone)).map(t => {
        if (t.rel) return { ...t, v: P(t.rel).add(new THREE.Vector3(t.pos[0] * kx, t.pos[1] * ky, t.pos[2] * ky)) };
        if (t.relY) { const v = map(t.pos); v.y = P(t.relY).y + t.pos[1] * ky; return { ...t, v }; }
        return { ...t, v: map(t.pos) };
      });
      const K = keys(side);
      const apply = x => {
        up.rotation.set(s.fwd * x[1], s.tw * x[2], s.arm * x[0]);
        lo.rotation.set(0, s.elb * x[3], 0);
        hand.rotation.set(0, 0, s.arm * x[4]);
        h.update(); up.updateWorldMatrix(true, true);
      };
      const cost = x => {
        apply(x);
        let c = tg.reduce((c, t) => c + t.w * P(t.bone).distanceToSquared(t.v), 0);
        // penalità se l'avambraccio entra nel corpo (4 punti tra gomito e polso; il gomito di natura sta al fianco)
        raw(sideName + "LowerArm").getWorldPosition(tmpA); raw(sideName + "Hand").getWorldPosition(tmpB); raw(sideName + "UpperArm").getWorldPosition(tmpC);
        for (let i = 1; i <= 4; i++) { const d = inside(new THREE.Vector3().lerpVectors(tmpA, tmpB, i / 4)); c += 30 * d * d; }
        return c;
      };
      let best = K.map(k => orig[name][k] ?? 0), bc = cost(best), step = 0.3;
      for (let it = 0; it < 600 && step > 0.003; it++) {
        let improved = false;
        for (let i = 0; i < K.length; i++) for (const d of [step, -step]) {
          const x = best.slice(); x[i] += d; const c = cost(x);
          if (c < bc) { bc = c; best = x; improved = true; }
        }
        if (!improved) step *= 0.6;
      }
      apply(best); // il braccio resta in posa: le pose dell'altro braccio possono riferirsi a questo
      K.forEach((k, i) => { pose[k] = best[i]; });
      done++;
    }
  }
  // braccia di nuovo a riposo (la posa vera la scrive _tick al fotogramma successivo)
  for (const sd of ["left", "right"]) { const u = nb(sd + "UpperArm"), l = nb(sd + "LowerArm"), ha = nb(sd + "Hand"); if (u) u.rotation.set(0, 0, 0); if (l) l.rotation.set(0, 0, 0); if (ha) ha.rotation.set(0, 0, 0); }
  h.update();
  return done;
}

// Sagoma anteriore del corpo a riposo: funzione altezza → z massima (null se non c'è corpo a quell'altezza)
function bodyFront(vrm, THREE) {
  const bins = new Map(), v = new THREE.Vector3();
  vrm.scene.updateMatrixWorld(true);
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || /hair|face|eye/i.test(o.name + " " + (o.material && o.material.name || ""))) return;
    const pos = o.geometry.attributes.position;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 40000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (Math.abs(v.x) > 0.13) continue;
      const k = Math.round(v.y / 0.02);
      if (!bins.has(k) || bins.get(k) < v.z) bins.set(k, v.z);
    }
  });
  return y => { const k = Math.round(y / 0.02); return bins.has(k) ? bins.get(k) : null; };
}
