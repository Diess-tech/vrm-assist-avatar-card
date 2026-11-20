/* Lingue della card: italiano e inglese. Segue la lingua di Home Assistant; se non è l'italiano, inglese.
 * t(chiave, valori) → testo, con {nome} sostituito dai valori.
 */
const STRINGS = {
  en: {
    loading: "Loading {name}…",
    notFound: "Model not found at {file}. Copy it into the www folder of Home Assistant and reload the page.",
    loadError: "The model did not load: {err}",
    modelError: "Model {name} did not load: {err}",
    animErrors: "Animations not loaded: {list}",
    overlayDemo: "{name} in overlay",
    overlayEditor: "{name}: overlay ({pos}). The preview is not shown here: it appears over the dashboard after saving.",
    overlayOff: "off",
    model: "Model: {name}",
    st_auto: "Auto", st_riposo: "Idle", st_ascolta: "Listening", st_pensa: "Thinking", st_parla: "Talking",
    p_serio: "Serious", p_spiritoso: "Playful", p_composto: "Composed",
    cardName: "VRM Assist Avatar",
    cardDesc: "A 3D VRM character that listens, thinks and talks along with your voice satellite",
  },
  it: {
    loading: "Caricamento di {name}…",
    notFound: "Non trovo il modello in {file}. Copialo nella cartella www di Home Assistant e ricarica la pagina.",
    loadError: "Il modello non si è caricato: {err}",
    modelError: "Il modello {name} non si è caricato: {err}",
    animErrors: "Animazioni non caricate: {list}",
    overlayDemo: "{name} in sovrimpressione",
    overlayEditor: "{name}: in sovrimpressione ({pos}). L'anteprima qui non si vede: comparirà sopra la dashboard dopo aver salvato.",
    overlayOff: "spenta",
    model: "Modello: {name}",
    st_auto: "Auto", st_riposo: "Riposo", st_ascolta: "Ascolto", st_pensa: "Pensiero", st_parla: "Parla",
    p_serio: "Serio", p_spiritoso: "Spiritoso", p_composto: "Composto",
    cardName: "Avatar VRM per Assist",
    cardDesc: "Personaggio 3D VRM che ascolta, pensa e parla insieme al satellite vocale",
  },
};

let current = null;

/** Lingua da un oggetto hass (o da quello di <home-assistant>, o dal browser) */
export function langOf(hass) {
  const h = hass || (document.querySelector("home-assistant") || {}).hass;
  const l = (h && ((h.locale && h.locale.language) || h.language)) || current || document.documentElement.lang || navigator.language || "en";
  return String(l).toLowerCase().startsWith("it") ? "it" : "en";
}
export function setLang(hass) { current = langOf(hass); return current; }
export function lang() { return current || (current = langOf()); }

export function t(key, vals = {}, l = lang()) {
  const s = (STRINGS[l] && STRINGS[l][key]) ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m));
}

/** Più tabelle di testi (per l'editor): register({ en: {...}, it: {...} }) */
export function register(table) {
  for (const [l, s] of Object.entries(table)) Object.assign(STRINGS[l] || (STRINGS[l] = {}), s);
}
