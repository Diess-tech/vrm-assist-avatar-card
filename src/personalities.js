/* Atteggiamenti (opzione personality): come si muove e si comporta il personaggio in ogni stato.
 *
 * Ogni atteggiamento ha:
 * - pose:     valori che cambiano rispetto alle pose di base (POSES), stato per stato
 * - every:    ogni quanti secondi (min, max) fa un gesto a riposo
 * - gestures: gesti casuali a riposo; weight = quanto spesso, dur = durata in secondi (min, max),
 *             apply(T, u, dir) modifica la posa obiettivo T mentre il gesto è in corso
 *             (u va da 0 a 1 durante il gesto, dir vale -1 o 1 a caso: lato o verso)
 *
 * Campi delle pose usati qui oltre a quelli di base: energy (ampiezza dei micro-movimenti), shift (peso spostato su una
 * gamba, in metri), focus (sopracciglia aggrottate), wink (occhiolino), gest e nod (ampiezza di gesti e cenni mentre parla).
 */

// Curva che sale, resta e scende durante il gesto (0 → 1 → 0), con bordi morbidi
const hold = (u, edge = 0.2) => { const x = Math.min(1, u / edge, (1 - u) / edge); return x * x * (3 - 2 * x); };
const pulse = u => Math.sin(Math.PI * Math.min(1, Math.max(0, u)));

// Pose delle braccia (valori trovati misurando le posizioni delle mani sul modello, vedi CLAUDE.md)
export const ARMS = {
  // braccia conserte (il sinistro sopra)
  crossed: { armL: 1.3, fwdL: 0.286, twL: 1.286, elbL: 1.6, wrL: 0, armR: 1.3, fwdR: 0.2, twR: 1.2, elbR: 1.6, wrR: 0 },
  // mani giunte davanti
  clasped: { armL: 1.438, fwdL: -0.01, twL: 0.799, elbL: 0.781, wrL: 0.522, armR: 1.478, fwdR: 0.031, twR: 0.72, elbR: 0.777, wrR: 0.576 },
  // mani sui fianchi
  hips:    { armL: 0.564, fwdL: -1.026, twL: 0.777, elbL: 1.177, wrL: -0.302, armR: 0.564, fwdR: -1.026, twR: 0.777, elbR: 1.177, wrR: -0.302 },
  // mano destra al nodo della cravatta
  tie:     { armR: 1.245, fwdR: 0.024, twR: 0.511, elbR: 2.338, wrR: 0.643, fistR: 0.55 },
  // mano destra alzata accanto alla testa (saluto)
  wave:    { armR: 0.246, fwdR: 1.344, twR: -0.173, elbR: 1.956, wrR: 0.118, fistR: 0.1 },
  // braccia in alto (stiracchiarsi)
  // pugno alzato davanti alla spalla (tifo); valori di partenza, la taratura li adatta a ogni modello
  pump:    { armR: 1.35, fwdR: 0.35, twR: 0.6, elbR: 2.3, wrR: 0, fistR: 0.8 },
  stretch: { armL: -1.058, fwdL: 0.601, twL: 1.136, elbL: 0.536, wrL: 0, armR: -1.058, fwdR: 0.601, twR: 1.136, elbR: 0.536, wrR: 0 },
};

// Solo la parte destra (o sinistra) di una posa di braccia
const right = arms => Object.fromEntries(Object.entries(arms).filter(([k]) => k.endsWith("R")));

// Mescola una posa di braccia nella posa obiettivo con intensità k (0 = niente, 1 = posa piena)
const blendArms = (T, arms, k) => { for (const key in arms) T[key] = T[key] + (arms[key] - T[key]) * k; };

// Gesti comuni
const look = { name: "guarda", weight: 2, dur: [2.5, 4], apply: (T, u, d) => { const k = hold(u); T.gx += 0.5 * d * k; T.headY += 0.22 * d * k; } };
const tilt = { name: "inclina", weight: 1, dur: [2.5, 4], apply: (T, u, d) => { const k = hold(u); T.headZ += 0.14 * d * k; T.smile = Math.max(T.smile, 0.45 * k); T.brow += 0.25 * k; } };
const smile = { name: "sorride", weight: 1, dur: [2.5, 4], apply: (T, u) => { const k = hold(u); T.smile = Math.max(T.smile, 0.8 * k); T.brow += 0.35 * k; T.headX += 0.06 * k; } };

// Facce buffe (v1.2, disegni in funny.js): T.funny = nome della faccia, T.funnyK = intensità (sopra 0,5 si vede)
const funny = (name, dur, head) => ({ name: "buffa-" + name, face: name, funny: true, weight: 1.1, dur, apply: (T, u, d) => {
  const k = hold(u, 0.12); T.funny = name; T.funnyK = k; if (head) head(T, u, d, k);
} });
export const FUNNY = [
  funny("strizza", [1.4, 1.8], (T, u, d, k) => { T.headY += 0.06 * Math.sin(u * 30) * k; T.headX -= 0.03 * k; }),
  funny("stordito", [2.2, 2.8], (T, u, d, k) => { T.headZ += 0.1 * Math.sin(u * 14) * k; T.headY += 0.07 * Math.cos(u * 14) * k; }),
  funny("uffa", [2, 2.6], (T, u, d, k) => { T.headZ += 0.07 * d * k; T.headX += 0.03 * k; }),
  funny("puntini", [1.6, 2.2], (T, u, d, k) => { T.headZ += 0.14 * d * k; }),
  funny("stelle", [1.6, 2.2], (T, u, d, k) => { T.headX -= 0.06 * k; T.lean -= 0.02 * k; }),
  funny("cuori", [2, 2.6], (T, u, d, k) => { T.headZ += 0.09 * Math.sin(u * 9) * k; }),
  funny("lacrime", [2, 2.6], (T, u, d, k) => { T.headX += 0.05 * k; T.headY += 0.04 * Math.sin(u * 26) * k; }),
  funny("felice", [1.4, 1.8], (T, u, d, k) => { T.headZ += 0.1 * d * k; }),
  funny("vampiro", [1.8, 2.4], (T, u, d, k) => { T.headX += 0.05 * k; T.headZ -= 0.05 * d * k; }),
  funny("occhiolino", [1.2, 1.6], (T, u, d, k) => { T.headZ += 0.1 * k; }),
  funny("sbalordito", [1.4, 1.8], (T, u, d, k) => { T.headX -= 0.05 * k; T.lean -= 0.03 * k; }),
];

export const PERSONALITIES = {
  // Comportamento delle versioni precedenti (nessun atteggiamento scelto)
  neutro: {
    every: [8, 14],
    pose: {},
    gestures: [look, tilt, smile],
  },

  serio: {
    every: [10, 18],
    pose: {
      riposo: { energy: 0.5, sway: 0.4, smile: 0, focus: 0.45, headX: 0.0, ...ARMS.crossed, _arms: "crossed", fistL: 0.35, fistR: 0.35 },
      ascolta: { energy: 0.5, sway: 0.3, smile: 0.1, brow: 0.1, focus: 0.3, headZ: 0.03, lean: 0.06 },
      pensa: { energy: 0.4, focus: 0.55, brow: 0 },
      parla: { energy: 0.6, sway: 0.5, smile: 0.05, brow: 0, focus: 0.25, gest: 0.6, nod: 0.7 },
    },
    gestures: [
      { ...look, weight: 3, dur: [3, 5], apply: (T, u, d) => { const k = hold(u, 0.3); T.gx += 0.4 * d * k; T.headY += 0.15 * d * k; } },
      { name: "annuisce", weight: 1, dur: [1.6, 2.2], apply: (T, u) => { T.headX += 0.1 * pulse(u * 2) * (u < 0.5 ? 1 : 0); } },
      { name: "cravatta", weight: 1, dur: [3, 4], apply: (T, u) => { blendArms(T, ARMS.tie, hold(u, 0.3)); T.headX += 0.05 * hold(u, 0.3); } },
      { name: "postura", weight: 1, dur: [2, 3], apply: (T, u) => { const k = pulse(u); T.lean -= 0.06 * k; T.headX -= 0.04 * k; } },
    ],
  },

  spiritoso: {
    every: [5, 9],
    pose: {
      // peso su una gamba e mano destra sul fianco
      riposo: { energy: 1.4, sway: 1.5, smile: 0.4, brow: 0.15, headZ: 0.05, shift: 0.04, ...right(ARMS.hips), _armsR: "hips", fistR: 0.5 },
      ascolta: { energy: 1.3, sway: 0.9, smile: 0.45, brow: 0.4, headZ: 0.1, lean: 0.08 },
      pensa: { energy: 1.2, smile: 0.1, brow: -0.2, gy: 0.14 },
      parla: { energy: 1.4, sway: 1.2, smile: 0.45, brow: 0.25, gest: 1.4, nod: 1.4 },
    },
    gestures: [
      { name: "occhiolino", weight: 2, dur: [1.4, 1.8], apply: (T, u) => { const k = hold(u, 0.25); T.smile = Math.max(T.smile, 0.75 * k); T.headZ += 0.1 * k; T.wink = pulse((u - 0.3) / 0.35); } },
      { name: "peso", weight: 2, dur: [4, 6], apply: (T, u) => { T.shift = T.shift * (1 - 2 * hold(u, 0.25)); } }, // passa il peso sull'altra gamba
      { name: "stiracchia", weight: 1, dur: [3.5, 4.5], apply: (T, u) => { const k = hold(u, 0.3); blendArms(T, ARMS.stretch, k); T.headX -= 0.12 * k; T.smile = Math.max(T.smile, 0.6 * k); T.lean -= 0.04 * k; } },
      { name: "fianchi", weight: 1, dur: [4, 6], apply: (T, u) => { const k = hold(u, 0.2); blendArms(T, ARMS.hips, k); T.fistL += (0.5 - T.fistL) * k; T.fistR += (0.5 - T.fistR) * k; } },
      { name: "fischietta", weight: 1, dur: [2.5, 3.5], apply: (T, u, d) => { const k = hold(u, 0.25); T.gx += 0.35 * d * k; T.gy += 0.35 * k; T.headY += 0.12 * d * k; T.whistle = k; } },
      { ...tilt, weight: 1 },
      ...FUNNY,
    ],
  },

  composto: {
    every: [9, 14],
    pose: {
      riposo: { energy: 0.7, sway: 0.6, smile: 0.2, brow: 0.05, ...ARMS.clasped, _arms: "clasped", fistL: 0.35, fistR: 0.35 },
      ascolta: { energy: 0.7, sway: 0.4, smile: 0.3, brow: 0.2, headX: 0.07, headZ: 0.06, lean: 0.07, ...ARMS.clasped, _arms: "clasped", fistL: 0.35, fistR: 0.35 },
      pensa: { energy: 0.6 },
      parla: { energy: 0.8, sway: 0.6, smile: 0.3, brow: 0.15, gest: 0.8, nod: 0.9 },
    },
    gestures: [
      { name: "inchino", weight: 1, dur: [2.4, 3], apply: (T, u) => { const k = hold(u, 0.35); T.lean += 0.14 * k; T.headX += 0.12 * k; T.smile = Math.max(T.smile, 0.4 * k); } },
      { ...smile, weight: 2, apply: (T, u) => { const k = hold(u); T.smile = Math.max(T.smile, 0.55 * k); T.brow += 0.2 * k; T.headZ += 0.05 * k; } },
      { ...look, weight: 2, dur: [3, 4.5], apply: (T, u, d) => { const k = hold(u, 0.3); T.gx += 0.35 * d * k; T.headY += 0.12 * d * k; } },
    ],
  },
};

// ── Espressioni del viso ──────────────────────────────────────────────────────────────────────────
// Campi del viso: surprise (occhi sgranati + sopracciglia su), eyeSmile (occhi che sorridono), lips (labbra strette),
// frown (angoli della bocca in giù, il "mmh" pensieroso). Le forme che aprono la bocca non si usano (lezione n.1).

// Micro-espressioni a riposo: brevi, ogni pochi secondi, indipendenti dai gesti del corpo
const MICRO = {
  labbra: { name: "labbra strette", weight: 1, dur: [0.8, 1.4], apply: (T, u) => { T.lips += 0.5 * hold(u, 0.3); } },
  giu: { name: "sguardo giù", weight: 1, dur: [0.7, 1.2], apply: (T, u) => { const k = hold(u, 0.3); T.gy -= 0.12 * k; T.headX += 0.03 * k; } },
  sopracciglia: { name: "sopracciglia", weight: 1, dur: [0.45, 0.6], apply: (T, u) => { T.brow += 0.6 * pulse(u); } },
  occhi: { name: "occhi sorridenti", weight: 1, dur: [1.2, 2], apply: (T, u) => { const k = hold(u, 0.3); T.eyeSmile += 0.45 * k; T.smile += 0.2 * k; } },
  mmh: { name: "mmh", weight: 1, dur: [1, 1.6], apply: (T, u) => { const k = hold(u, 0.3); T.frown += 0.45 * k; T.lips += 0.2 * k; } },
};

// Reazioni: listen = quando inizia ad ascoltare (sorpresa breve), done = alla fine della risposta (sorriso).
// I valori si sommano alla posa per la durata della reazione; doneWink = probabilità di un occhiolino finale.
const FACE = {
  neutro:    { microEvery: [4, 9], micro: [MICRO.labbra, MICRO.giu, MICRO.sopracciglia, MICRO.occhi],
               listen: { brow: 0.35, eyeSmile: 0.2, lean: 0.03 }, done: { smile: 0.6, eyeSmile: 0.45 } },
  serio:     { microEvery: [6, 12], micro: [MICRO.labbra, MICRO.giu, MICRO.mmh],
               listen: { brow: 0.2, lean: 0.02 }, done: { smile: 0.3, eyeSmile: 0.15, headX: 0.06 } },
  spiritoso: { microEvery: [3, 7], micro: [MICRO.sopracciglia, MICRO.occhi, MICRO.giu, MICRO.labbra],
               listen: { brow: 0.45, eyeSmile: 0.35, headZ: 0.06 }, done: { smile: 0.8, eyeSmile: 0.7 }, doneWink: 0.35 },
  composto:  { microEvery: [5, 10], micro: [MICRO.labbra, MICRO.occhi, MICRO.giu],
               listen: { brow: 0.3, eyeSmile: 0.25, lean: 0.03 }, done: { smile: 0.6, eyeSmile: 0.5, headX: 0.08 } },
};
for (const [k, f] of Object.entries(FACE)) Object.assign(PERSONALITIES[k], f);

export { hold, pulse };

// ── Umore (opzione mood_entity) ───────────────────────────────────────────────────────────────────
// Si applica sopra l'atteggiamento, in tutti gli stati: mul moltiplica, add somma; enter = breve reazione quando arriva.
// Campo in più: sleepy (occhi socchiusi, Fcl_EYE_Close). Tutto a bocca chiusa.
// face: espressioni complete disegnate da VRoid, per parti [occhi, sopracciglia, bocca] (0–1), come in VRoid Studio.
// Close = palpebre basse. Valori scelti guardando le foto alla distanza di un telefono (bocca compresa: senza, non si capiva).
// Viso durante le clip "gesti" (v1.2.2): le clip Mixamo muovono solo il corpo, e durante sbadiglio o stiracchiata restava
// il sorriso dell'atteggiamento (foto di Davide). u = 0→1 lungo la clip; tempi presi dalle pellicole delle clip.
// Campi: gape (bocca spalancata), sleepy (palpebre giù), gazeHead (gli occhi seguono la testa invece della camera)
const ss = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ramp = (u, a, b, c, d) => ss((u - a) / (b - a)) * (1 - ss((u - c) / (d - c)));   // 0 → 1 tra a e b, 1 → 0 tra c e d
const noSmile = (T, k) => { T.smile *= 1 - k; T.eyeSmile *= 1 - k; };
export const CLIP_FACES = {
  // sbadiglio: mano sinistra davanti alla bocca tra 0,46 e 0,71, poi braccio destro in alto fino a 0,88 (misurato)
  yawn: (T, u) => {
    const k = ramp(u, 0.36, 0.46, 0.7, 0.8), eyes = ramp(u, 0.38, 0.48, 0.82, 0.9), after = ramp(u, 0.82, 0.9, 0.95, 1);
    noSmile(T, Math.max(eyes, after * 0.6));
    T.gape = Math.max(T.gape, k); T.sleepy = Math.max(T.sleepy, 0.95 * eyes, 0.45 * after); T.brow = Math.min(T.brow, -0.9 * k);
  },
  // stiracchiata: braccia in alto tra 0,08 e 0,63, poi un sorriso soddisfatto
  "arm-stretching": (T, u) => {
    const k = ramp(u, 0.04, 0.12, 0.58, 0.68), relief = ramp(u, 0.62, 0.72, 0.88, 1);
    noSmile(T, k);
    T.sleepy = Math.max(T.sleepy, 0.9 * k); T.lips = Math.max(T.lips, 0.6 * k); T.focus = Math.max(T.focus, 0.35 * k);
    T.gape = Math.max(T.gape, 0.2 * k);
    T.eyeSmile = Math.max(T.eyeSmile, 0.7 * relief);
  },
  // annoiata: palpebre a metà, bocca all'ingiù, e uno sbuffo a ogni dondolio delle braccia (0,17, 0,33, 0,5, 0,83)
  bored: (T, u) => {
    const k = ramp(u, 0, 0.08, 0.92, 1);
    const sigh = Math.max(...[0.17, 0.33, 0.5, 0.83].map(c => ramp(u, c - 0.05, c - 0.02, c + 0.02, c + 0.06)));
    noSmile(T, k);
    T.sleepy = Math.max(T.sleepy, 0.42 * k); T.frown = Math.max(T.frown, 0.55 * k); T.brow = Math.min(T.brow, -0.35 * k);
    T.whistle = Math.max(T.whistle, 0.7 * sigh);
    T.gy -= 0.08 * k; T.gx += 0.12 * Math.sin(u * 9) * k;
  },
  // si guarda intorno: gli occhi vanno dove va la testa, sopracciglia un po' su (curiosa)
  "looking-around": (T, u) => {
    const k = ramp(u, 0, 0.06, 0.94, 1);
    T.gazeHead = Math.max(T.gazeHead, k); T.brow = Math.max(T.brow, 0.3 * k); T.smile *= 1 - 0.5 * k;
  },
};
// Viso per le clip di Clawatar (v1.6, Mixamo convertite in .vrma): anche queste muovono solo il corpo
const W = (u, a = 0.08, b = 0.92) => ramp(u, 0, a, b, 1);   // tutta la clip, con entrata e uscita morbide
const happy = (T, k, j = 0) => { T.smile = Math.max(T.smile, 0.6 * k); T.eyeSmile = Math.max(T.eyeSmile, (0.55 + j) * k); };
const CLIP_FACES_RE = [
  // pianto: lacrimoni disegnati da anime (stessi occhi della faccia buffa "lacrime") e bocca triste
  [/crying/, (T, u) => { const k = W(u, 0.12, 0.85); T.funny = "lacrime"; T.funnyK = k; T.sad = Math.max(T.sad, 0.5 * k); noSmile(T, k); }],
  [/defeat/, (T, u) => { const k = W(u); noSmile(T, k); T.sleepy = Math.max(T.sleepy, 0.85 * k); T.frown = Math.max(T.frown, 0.6 * k); T.brow = Math.min(T.brow, -0.7 * k); }],
  [/sad-idle/, (T, u) => { const k = W(u); noSmile(T, k); T.sad = Math.max(T.sad, 0.55 * k); T.gy -= 0.08 * k; }],
  [/angry|annoyed/, (T, u) => { const k = W(u); noSmile(T, k); T.focus = Math.max(T.focus, 0.65 * k); T.frown = Math.max(T.frown, 0.5 * k); }],
  [/clapping|happy-hand/, (T, u) => happy(T, W(u))],
  [/joyful-jump/, (T, u) => { const k = W(u); happy(T, k, 0.2); T.gape = Math.max(T.gape, 0.3 * pulse(u)); }],
  // sospiro di sollievo: occhi chiusi e sbuffo, poi sorriso
  [/relieved-sigh/, (T, u) => { const a = ramp(u, 0, 0.1, 0.45, 0.55), b = ramp(u, 0.5, 0.6, 0.92, 1);
    T.sleepy = Math.max(T.sleepy, 0.7 * a); T.whistle = Math.max(T.whistle, 0.5 * a); happy(T, b); }],
  [/shrugging|whatever/, (T, u) => { const k = W(u); T.brow = Math.max(T.brow, 0.55 * k); T.lips = Math.max(T.lips, 0.5 * k); T.frown = Math.max(T.frown, 0.25 * k); }],
  [/thankful/, (T, u) => { const k = W(u); happy(T, k); T.sleepy = Math.max(T.sleepy, 0.2 * k); }],
  [/bow/, (T, u) => { const k = W(u); T.smile = Math.max(T.smile, 0.5 * k); T.sleepy = Math.max(T.sleepy, 0.35 * k); }],
  [/neck-stretching|drunk/, (T, u) => { const k = W(u); noSmile(T, 0.6 * k); T.sleepy = Math.max(T.sleepy, 0.5 * k); T.lips = Math.max(T.lips, 0.3 * k); }],
  [/thinking/, (T, u) => { const k = W(u); T.lips = Math.max(T.lips, 0.4 * k); T.focus = Math.max(T.focus, 0.3 * k); T.gx += 0.3 * k; T.gy += 0.12 * k; }],
  [/shaking-head-no/, (T, u) => { const k = W(u); noSmile(T, k); T.frown = Math.max(T.frown, 0.4 * k); T.lips = Math.max(T.lips, 0.3 * k); }],
  [/singing/, (T, u) => { const k = W(u); happy(T, k * 0.6); T.gape = Math.max(T.gape, 0.45 * k * (0.5 + 0.5 * Math.sin(u * 60))); }],
  [/talking-on-phone/, (T, u) => { const k = W(u); T.brow = Math.max(T.brow, 0.3 * k); T.gx += 0.25 * k; T.part = Math.max(T.part, 2 * k); }],
  [/danc|hip-hop|bboy|macarena|rumba|jazz|swing/, (T, u) => happy(T, W(u))],
];

/** Funzione del viso per una clip (dal nome del file), oppure null */
export const clipFace = name => {
  const n = String(name).toLowerCase();
  const k = Object.keys(CLIP_FACES).find(x => n.includes(x));
  if (k) return CLIP_FACES[k];
  const r = CLIP_FACES_RE.find(([re]) => re.test(n));
  return r ? r[1] : null;
};

// Tifo (v1.4): quando al PC si gioca (attività "gioco", da app desktop o da activity_entity) a riposo fa il tifo.
// _ownArms: con body: clip le braccia di questi gesti vincono sulle clip (come la mano al mento in "pensa")
const cheer = (T, k) => { T._ownArms = 1; T.smile = Math.max(T.smile, 0.5 * k); T.eyeSmile = Math.max(T.eyeSmile, 0.55 * k); T.brow = Math.max(T.brow, 0.45 * k); };
export const CHEER = [
  // pugno alzato accanto alla testa che va su e giù ("sì!")
  { name: "tifo-pugno", weight: 2, dur: [1.8, 2.4], apply: (T, u) => {
    const k = hold(u, 0.18); cheer(T, k);
    blendArms(T, ARMS.pump, k); T.fistR = T.fistR + (0.8 - T.fistR) * k;   // oltre ~0,8 le dita entrano nel palmo
    T.fwdR += 0.25 * Math.sin(u * Math.PI * 7) * k; T.elbR += 0.2 * Math.sin(u * Math.PI * 7) * k; T.gape = Math.max(T.gape, 0.35 * pulse(u * 3.5 % 1) * k); T.headX -= 0.04 * k;
  } },
  // braccia in alto ("evviva!")
  { name: "tifo-evviva", weight: 1.5, dur: [1.6, 2.2], apply: (T, u) => {
    const k = hold(u, 0.2); cheer(T, k);
    blendArms(T, ARMS.stretch, k); T.fistL += (0.75 - T.fistL) * k; T.fistR += (0.75 - T.fistR) * k;
    T.gape = Math.max(T.gape, 0.5 * k); T.headX -= 0.08 * k; T.lean -= 0.03 * k;
  } },
  // si sporge un po' a guardare, tesa (mani giunte), poi sorride
  { name: "tifo-teso", weight: 1, dur: [2.4, 3.2], apply: (T, u) => {
    const k = hold(u, 0.2); T._ownArms = 1;
    blendArms(T, ARMS.clasped, k); T.lean += 0.05 * k; T.lips = Math.max(T.lips, 0.6 * k * (u < 0.7)); T.focus = Math.max(T.focus, 0.3 * k * (u < 0.7));
    T.eyeSmile = Math.max(T.eyeSmile, 0.6 * k * (u > 0.7));
  } },
];

export const MOODS = {
  neutro: {},
  felice: { face: { Joy: [0.5, 0.85, 0], Fun: [0.25, 0, 1] },
            add: { headX: -0.03 }, mul: { energy: 1.25, sway: 1.2, focus: 0 }, enter: { eyeSmile: 0.5, dur: 1.5 } },
  triste: { face: { Sorrow: [0.9, 1, 0.9] }, add: { headX: 0.12, lean: 0.04, gy: -0.1 },
            mul: { energy: 0.6, sway: 0.6, gest: 0.6, nod: 0.7 } },
  sorpreso: { face: { Surprised: [0.9, 1, 0.65] }, add: { headX: -0.05, lean: -0.02 }, enter: { surprise: 0.4, dur: 1 } },
  arrabbiato: { face: { Angry: [0.85, 1, 0], Sorrow: [0, 0, 0.5] }, add: { lean: 0.04, headX: 0.03 }, mul: { energy: 1.1 } },
  stanco: { face: { Close: 0.45, Sorrow: [0.3, 0.7, 0.45] }, add: { headX: 0.08, headZ: 0.05, gy: -0.06 }, mul: { energy: 0.45, sway: 0.7 } },
  pensieroso: { face: { Sorrow: [0.2, 0.75, 0.35], Angry: [0.4, 0.35, 0] }, add: { frown: 0.35, lips: 0.35, gx: 0.25, gy: 0.06, headY: 0.08, headZ: -0.06 } },
  // impaurito (v1.5, per i giochi horror): occhi sgranati, sopracciglia alzate al centro, bocca appena aperta e tirata;
  // si ritrae un po' col busto e col mento, trema leggermente (tremble) e lo sguardo salta di qua e di là (dart)
  impaurito: { face: { Surprised: [0.75, 0, 0.12], Sorrow: [0, 1, 0.5] }, add: { lean: -0.04, headX: 0.05, tremble: 1, dart: 1 },
               mul: { energy: 0.6, sway: 0.4, smile: 0, eyeSmile: 0 }, enter: { surprise: 0.7, dur: 0.8 } },
};
// Nomi accettati (italiano e inglese), così l'umore può arrivare anche da un sensore o da un'intelligenza artificiale
const MOOD_ALIASES = {
  felice: ["felice", "contento", "allegro", "happy", "joy", "glad"],
  triste: ["triste", "sad", "sorrow", "giù"],
  sorpreso: ["sorpreso", "stupito", "surprised", "surprise"],
  arrabbiato: ["arrabbiato", "infastidito", "angry", "annoyed", "mad"],
  stanco: ["stanco", "assonnato", "tired", "sleepy"],
  pensieroso: ["pensieroso", "thoughtful", "thinking"],
  impaurito: ["impaurito", "spaventato", "paura", "terrorizzato", "scared", "afraid", "fear", "frightened"],
};
export function moodName(state) {
  const s = String(state || "").trim().toLowerCase();
  for (const [name, list] of Object.entries(MOOD_ALIASES)) if (list.includes(s)) return name;
  return "neutro";
}

// ── Azioni (opzione action_entity) ────────────────────────────────────────────────────────────────
// Gesti che Home Assistant può chiedere: se esiste una clip in animations (saluto/inchino/occhiolino) si usa quella.
export const ACTIONS = {
  saluto: { name: "saluto", dur: [2.6, 2.6], apply: (T, u) => {
    const k = hold(u, 0.18); blendArms(T, ARMS.wave, k);
    T.twR += Math.sin(u * Math.PI * 6) * 0.35 * k; // la mano va avanti e indietro
    T.smile = Math.max(T.smile, 0.6 * k); T.eyeSmile += 0.25 * k; T.headZ += 0.06 * k; } },
  inchino: { name: "inchino", dur: [2.4, 2.4], apply: (T, u) => { const k = hold(u, 0.35); T.lean += 0.16 * k; T.headX += 0.14 * k; T.smile = Math.max(T.smile, 0.45 * k); } },
  // balla (v1.6): senza clip "balla" dondola a tempo con le braccia su e giù, sorridendo
  balla: { name: "balla", dur: [6, 6], apply: (T, u) => {
    const k = hold(u, 0.08), b = Math.sin(u * Math.PI * 24);
    T._ownArms = 1; blendArms(T, ARMS.pump, k * (0.5 + 0.5 * b)); T.armL = T.armL + (1.1 - T.armL) * k * (0.5 - 0.5 * b); T.elbL += 1.2 * k * (0.5 - 0.5 * b);
    T.shift = 0.03 * b * k; T.headZ += 0.08 * b * k; T.smile = Math.max(T.smile, 0.6 * k); T.eyeSmile = Math.max(T.eyeSmile, 0.5 * k); } },
  occhiolino: { name: "occhiolino", dur: [1.5, 1.5], apply: (T, u) => { const k = hold(u, 0.25); T.smile = Math.max(T.smile, 0.7 * k); T.headZ += 0.1 * k; T.wink = pulse((u - 0.3) / 0.35); } },
};
const ACTION_ALIASES = { saluto: ["saluto", "saluta", "ciao", "hello", "hi", "wave", "greeting"], inchino: ["inchino", "bow"], occhiolino: ["occhiolino", "wink"],
  balla: ["balla", "ballo", "danza", "dance", "balletto"] };
export function actionName(state) {
  const s = String(state || "").trim().toLowerCase();
  for (const [name, list] of Object.entries(ACTION_ALIASES)) if (list.includes(s)) return name;
  return null;
}
