/* Configurazioni pronte, usate dall'editor grafico e scrivibili anche a mano.
 *   model: esempio                → modello di esempio ufficiale di three-vrm (VRM 1.0, pixiv, ridistribuibile)
 *   animations: consigliate       → 16 clip Mixamo scaricate da sé (guida nel README), in <anim_base>
 *   anim_base (facoltativo)       → cartella delle clip, di base /local/avatar/anim/
 * Con un pacchetto il corpo lo muovono le clip (body: clip), se non è indicato diversamente.
 * Le clip che mancano vengono saltate: al loro posto restano i movimenti calcolati.
 */

// Il file non è nel repository: si scarica dal repository di three-vrm (versione fissa), che lo permette (CORS aperto)
export const SAMPLE_MODEL = "https://raw.githubusercontent.com/pixiv/three-vrm/v3.5.2/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";
const SAMPLE_NAMES = ["esempio", "example", "sample", "demo"];
export const isSample = m => typeof m === "string" && SAMPLE_NAMES.includes(m.trim().toLowerCase());
export const resolveModel = m => (isSample(m) ? SAMPLE_MODEL : m);

export const ANIM_PRESETS = ["consigliate", "recommended"];
export const DEFAULT_ANIM_BASE = "/local/avatar/anim/";

/** Clip Mixamo del pacchetto "consigliate": nome del file senza .fbx → a cosa serve */
export const MIXAMO_CLIPS = {
  riposo: ["breathing-idle", "weight-shift", "briefcase-idle", "happy-idle"],
  gesti: ["looking-around", "yawn", "arm-stretching", "bored"],
  ascolta: ["head-nod-yes", "acknowledging", "lengthy-head-nod"],
  pensa: ["thoughtful-head-shake"],
  parla: ["talking-1", "talking-2", "talking-3"],
  saluto: ["waving"],
};
export const MIXAMO_FILES = Object.values(MIXAMO_CLIPS).flat().map(n => n + ".fbx");

export function animBase(base) {
  const b = String(base || DEFAULT_ANIM_BASE).trim();
  return b.endsWith("/") ? b : b + "/";
}

export function expandAnimations(name, base) {
  const b = animBase(base), M = n => `${b}${n}.fbx`;
  const out = {};
  for (const [k, list] of Object.entries(MIXAMO_CLIPS)) out[k] = list.length > 1 ? list.map(M) : M(list[0]);
  out.composto = { riposo: [M("breathing-idle"), M("briefcase-idle")] };
  return out;
}

/** Aiutanti che l'editor sa creare: id fisso, opzioni nella lingua di chi li crea (la card capisce entrambe) */
export const HELPER_IDS = {
  model: "input_select.avatar_modello",
  mood: "input_select.avatar_umore",
  personality: "input_select.avatar_atteggiamento",
  action: "input_select.avatar_azione",
  theme: "input_select.avatar_tema",
};
export const HELPER_OPTIONS = {
  it: {
    mood: ["neutro", "felice", "triste", "sorpreso", "arrabbiato", "stanco", "pensieroso", "impaurito"],
    personality: ["automatico", "nessuno", "serio", "spiritoso", "composto"],
    action: ["nessuna", "saluto", "inchino", "occhiolino", "balla"],
    theme: ["automatico", "nessuno", "halloween", "natale"],
  },
  en: {
    mood: ["neutral", "happy", "sad", "surprised", "angry", "tired", "thoughtful", "scared"],
    personality: ["automatic", "none", "serious", "playful", "composed"],
    action: ["none", "wave", "bow", "wink", "dance"],
    theme: ["automatic", "none", "halloween", "christmas"],
  },
};
export const HELPER_ICONS = { model: "mdi:account-box", mood: "mdi:emoticon-outline", personality: "mdi:account-cog",
  action: "mdi:hand-wave", theme: "mdi:party-popper" };

/** Atteggiamento in italiano o in inglese → nome interno (undefined = sconosciuto) */
const PERS_ALIASES = {
  serio: "serio", serious: "serio", spiritoso: "spiritoso", playful: "spiritoso", funny: "spiritoso",
  composto: "composto", composed: "composto", polite: "composto",
  nessuno: "neutro", nessuna: "neutro", neutro: "neutro", none: "neutro", neutral: "neutro",
  automatico: null, automatic: null, auto: null,
};
export function personalityName(s) {
  const k = String(s ?? "").trim().toLowerCase();
  return k in PERS_ALIASES ? PERS_ALIASES[k] : undefined;
}
