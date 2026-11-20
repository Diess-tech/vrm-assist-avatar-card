/* Caricamento delle animazioni vere (VRMA e Mixamo FBX) e conversione per il modello VRM */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy, createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import { mixamoVRMRigMap } from "./mixamoVRMRigMap.js";

// Nomi accettati nella configurazione: quelli della card e quelli del satellite di Home Assistant
const STATE_ALIASES = { riposo: "riposo", idle: "riposo", ascolta: "ascolta", listening: "ascolta",
  pensa: "pensa", processing: "pensa", parla: "parla", responding: "parla" };

// Gruppi con dentro le stesse chiavi: gli atteggiamenti e (v1.6) gli umori, es. animations.triste.gesti
const PERSONALITY_KEYS = ["serio", "spiritoso", "composto"];
const MOOD_KEYS = ["felice", "triste", "sorpreso", "arrabbiato", "stanco", "pensieroso", "impaurito"];
// Clip per le azioni chieste da Home Assistant (action_entity), più (v1.6) "balla" e "tifo" (gesti quando si gioca al PC:
// fino alla v1.5 "tifo" non era tra le chiavi e veniva scartato con un avviso)
const ACTION_KEYS = { saluto: "saluto", greeting: "saluto", wave: "saluto", inchino: "inchino", bow: "inchino", occhiolino: "occhiolino", wink: "occhiolino",
  balla: "balla", dance: "balla", tifo: "tifo", cheer: "tifo" };
const toList = v => (Array.isArray(v) ? v : [v]).filter(u => typeof u === "string" && u);

/**
 * Trasforma la configurazione `animations` in gruppi di indirizzi:
 *   { tutti: { riposo: [url…], gesti: [url…], … }, serio: { … }, spiritoso: { … }, composto: { … }, triste: { … }, … }
 * Chiavi accettate: gli stati (riposo/ascolta/pensa/parla o idle/listening/processing/responding), "gesti"
 * (clip che partono ogni tanto a riposo) e i nomi degli atteggiamenti, con dentro le stesse chiavi.
 */
export function parseAnimationConfig(cfg) {
  const out = { tutti: {} };
  if (!cfg || typeof cfg !== "object") return out;
  const fill = (group, obj, where) => {
    for (const [k, v] of Object.entries(obj)) {
      if ((PERSONALITY_KEYS.includes(k) || MOOD_KEYS.includes(k)) && where === "tutti") {
        if (v && typeof v === "object" && !Array.isArray(v)) fill((out[k] = out[k] || {}), v, k);
        continue;
      }
      const key = k === "gesti" || k === "gestures" ? "gesti" : ACTION_KEYS[k] || STATE_ALIASES[k];
      if (!key) { console.warn(`vrm-assist-avatar-card: chiave sconosciuta in animations${where === "tutti" ? "" : "." + where}: "${k}"`); continue; }
      const urls = toList(v);
      if (urls.length) group[key] = (group[key] || []).concat(urls);
    }
  };
  fill(out.tutti, cfg, "tutti");
  return out;
}

// Ossa che si decidono insieme: o tutte dalla clip o tutte dalla card (decidere osso per osso mescola due pose).
// Soglia 25°: nelle clip Mixamo di prova l'ondeggiamento a riposo arriva a ~21°, i gesti veri partono da ~31°.
const fingers = side => ["Thumb", "Index", "Middle", "Ring", "Little"].flatMap(f => ["Metacarpal", "Proximal", "Intermediate", "Distal"].map(j => `${side}${f}${j}`));
const CHAINS = [
  // le due braccia insieme: pose come braccia conserte o mani giunte non vanno spezzate a metà
  { name: "braccia", bones: ["leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand", "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand"],
    extra: fingers("left").concat(fingers("right")) },
  { name: "gambe", bones: ["leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes", "rightUpperLeg", "rightLowerLeg", "rightFoot", "rightToes"], extra: [] },
];

/**
 * Prepara la clip:
 * - braccia e gambe restano sempre nella clip; si annota solo se si muovono poco (calm), così la card può far vincere
 *   la posa dell'atteggiamento (braccia conserte, mani giunte, mano sul fianco) quando ne ha una
 * - le altre ossa (schiena, testa) si tolgono se si muovono meno di boneDeg gradi
 */
export function pruneStaticTracks(clip, vrm, { chainDeg = 25, boneDeg = 4 } = {}) {
  const q0 = new THREE.Quaternion(), q = new THREE.Quaternion();
  const motion = t => { // massimo scostamento dal primo fotogramma (gradi per le rotazioni, cm per le posizioni)
    let m = 0;
    if (t instanceof THREE.QuaternionKeyframeTrack) {
      q0.fromArray(t.values, 0);
      for (let i = 4; i < t.values.length; i += 4) m = Math.max(m, q0.angleTo(q.fromArray(t.values, i)) * 180 / Math.PI);
    } else for (let i = 3; i < t.values.length; i++) m = Math.max(m, Math.abs(t.values[i] - t.values[i % 3]) * 100);
    return m;
  };
  const boneOf = {};
  for (const name of Object.keys(vrm.humanoid.humanBones)) { const n = vrm.humanoid.getNormalizedBoneNode(name); if (n) boneOf[n.name] = name; }
  const tracksOf = bones => clip.tracks.filter(t => bones.includes(boneOf[t.name.split(".")[0]]));
  const drop = new Set();
  clip.userData = clip.userData || {};
  clip.userData.motion = {}; // gradi di movimento per gruppo (utile per scegliere le clip nel banco di prova)
  clip.userData.calm = {};   // gruppi che si muovono poco: lì può vincere la posa dell'atteggiamento (vedi _applyClips)
  for (const c of CHAINS) {
    const deg = Math.max(0, ...tracksOf(c.bones).map(motion));
    clip.userData.motion[c.name] = Math.round(deg);
    clip.userData.calm[c.name] = deg <= chainDeg;
  }
  const inChain = new Set(CHAINS.flatMap(c => c.bones.concat(c.extra)));
  for (const t of clip.tracks) if (!inChain.has(boneOf[t.name.split(".")[0]]) && motion(t) <= boneDeg) drop.add(t);
  clip.tracks = clip.tracks.filter(t => !drop.has(t));
  return clip;
}

// Mappa ossa Rigify (Quaternius Universal Animation Library, scheletri "DEF-…" di Blender) -> ossa VRM
const rigifyVRMRigMap = (() => {
  const m = { "DEF-hips": "hips", "DEF-spine.001": "spine", "DEF-spine.002": "chest", "DEF-spine.003": "upperChest", "DEF-neck": "neck", "DEF-head": "head" };
  for (const [S, side] of [["L", "left"], ["R", "right"]]) {
    Object.assign(m, { [`DEF-shoulder.${S}`]: `${side}Shoulder`, [`DEF-upper_arm.${S}`]: `${side}UpperArm`, [`DEF-forearm.${S}`]: `${side}LowerArm`,
      [`DEF-hand.${S}`]: `${side}Hand`, [`DEF-thigh.${S}`]: `${side}UpperLeg`, [`DEF-shin.${S}`]: `${side}LowerLeg`,
      [`DEF-foot.${S}`]: `${side}Foot`, [`DEF-toe.${S}`]: `${side}Toes` });
    ["Metacarpal", "Proximal", "Distal"].forEach((j, i) => { m[`DEF-thumb.0${i + 1}.${S}`] = `${side}Thumb${j}`; });
    for (const [f, F] of [["index", "Index"], ["middle", "Middle"], ["ring", "Ring"], ["pinky", "Little"]])
      ["Proximal", "Intermediate", "Distal"].forEach((j, i) => { m[`DEF-f_${f}.0${i + 1}.${S}`] = `${side}${F}${j}`; });
  }
  return m;
})();

// Scheletri riconosciuti: osso dei fianchi -> mappa dei nomi
const RIGS = [{ hips: "mixamorigHips", map: mixamoVRMRigMap }, { hips: "DEF-hips", map: rigifyVRMRigMap }];

const sanitize = n => THREE.PropertyBinding.sanitizeNodeName(n);
const cache = new Map(); // un file con più clip si scarica una volta sola

/**
 * Carica un file di animazione e restituisce una AnimationClip adatta al modello.
 * Formati: .vrma; .fbx Mixamo; .glb/.gltf con scheletro Mixamo o Rigify (Quaternius).
 * Per scegliere una clip dentro un file che ne contiene tante: "file.glb#NomeClip".
 */
export async function loadAnimationClip(url, vrm) {
  const [file, clipName] = url.split("#");
  const ext = file.split("?")[0].split(".").pop().toLowerCase();
  if (!["vrma", "glb", "gltf", "fbx"].includes(ext)) throw new Error(`formato non supportato: ${url} (usa .vrma, .glb, .gltf o .fbx)`);
  if (!cache.has(file)) cache.set(file, ext === "fbx"
    ? new FBXLoader().loadAsync(file).then(asset => ({ scene: asset, animations: asset.animations }))
    : (() => { const l = new GLTFLoader(); l.register(p => new VRMAnimationLoaderPlugin(p)); return l.loadAsync(file); })());
  let asset;
  try { asset = await cache.get(file); } catch (e) { cache.delete(file); throw e; }

  const vrmAnims = asset.userData && asset.userData.vrmAnimations;
  if (vrmAnims && vrmAnims.length) return fromVRMA(vrmAnims[0], vrm, url);

  const src = clipName ? THREE.AnimationClip.findByName(asset.animations, clipName)
    : THREE.AnimationClip.findByName(asset.animations, "mixamo.com") || asset.animations[0];
  if (!src) throw new Error(clipName ? `${file} non contiene la clip "${clipName}" (ci sono: ${asset.animations.map(a => a.name).join(", ")})` : `${file} non contiene animazioni`);
  const rig = RIGS.find(r => asset.scene.getObjectByName(sanitize(r.hips)));
  if (!rig) throw new Error(`${file}: scheletro non riconosciuto (servono ossa Mixamo o Rigify)`);
  return retarget(asset.scene, src, rig, vrm, url);
}

function fromVRMA(anim, vrm, url) {
  // Oggetto richiesto da three-vrm-animation per lo sguardo; crearlo qui evita un avviso in console
  if (vrm.lookAt && !vrm.scene.children.some(o => o instanceof VRMLookAtQuaternionProxy)) {
    const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = "VRMLookAtQuaternionProxy";
    vrm.scene.add(proxy);
  }
  const clip = createVRMAnimationClip(anim, vrm);
  // Sguardo ed espressioni li gestisce la card (lo sguardo segue la camera, il viso segue lo stato)
  clip.tracks = clip.tracks.filter(t => !t.name.startsWith("VRMLookAtQuaternionProxy") && !t.name.startsWith("VRMExpression"));
  clip.name = url;
  return keepInPlace(clip, vrm);
}

// Adattata da loadMixamoAnimation dell'esempio ufficiale di three-vrm (MIT, (c) pixiv Inc.).
// Funziona con ogni scheletro che parte in T-pose rivolto in avanti (Mixamo, Rigify/Quaternius).
function retarget(root, src, rig, vrm, url) {
  const byNode = {};
  for (const [k, v] of Object.entries(rig.map)) byNode[sanitize(k)] = v;
  const tracks = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const isVRM0 = vrm.meta && vrm.meta.metaVersion === "0";
  root.updateMatrixWorld(true);

  // Fianchi: le posizioni si portano in coordinate del mondo (i file di Blender hanno l'asse Z in alto)
  // e si adattano alla statura del modello
  const hipsNode = root.getObjectByName(sanitize(rig.hips));
  const hipsParentWorld = hipsNode.parent.matrixWorld;
  const hipsScale = vrm.humanoid.normalizedRestPose.hips.position[1] / hipsNode.getWorldPosition(new THREE.Vector3()).y;
  const v = new THREE.Vector3();

  for (const track of src.tracks) {
    const [rigName, prop] = track.name.split(".");
    const vrmBone = byNode[rigName];
    const vrmNode = vrmBone && vrm.humanoid.getNormalizedBoneNode(vrmBone);
    const rigNode = root.getObjectByName(rigName);
    if (!vrmNode || !rigNode) continue;

    rigNode.getWorldQuaternion(restRotationInverse).invert();
    rigNode.parent.getWorldQuaternion(parentRestWorldRotation);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i).premultiply(parentRestWorldRotation).multiply(restRotationInverse);
        q.toArray(values, i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${vrmNode.name}.${prop}`, track.times,
        values.map((v, i) => (isVRM0 && i % 2 === 0 ? -v : v))));
    } else if (track instanceof THREE.VectorKeyframeTrack && prop === "position" && vrmBone === "hips") {
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 3) {
        v.fromArray(values, i).applyMatrix4(hipsParentWorld).multiplyScalar(hipsScale);
        if (isVRM0) { v.x = -v.x; v.z = -v.z; }
        v.toArray(values, i);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${vrmNode.name}.${prop}`, track.times, values));
    }
  }
  return keepInPlace(new THREE.AnimationClip(url, src.duration, tracks), vrm);
}

// Il personaggio resta fermo al centro: dei fianchi si tiene solo il movimento in su e in giù
function keepInPlace(clip, vrm) {
  const hips = vrm.humanoid.getNormalizedBoneNode("hips");
  const rest = vrm.humanoid.normalizedRestPose.hips.position;
  for (const t of clip.tracks) {
    if (t.name !== `${hips.name}.position`) continue;
    for (let i = 0; i < t.values.length; i += 3) { t.values[i] = rest[0]; t.values[i + 2] = rest[2]; }
  }
  return clip;
}
