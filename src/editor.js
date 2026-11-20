/* Editor grafico della card: quello che si apre in Home Assistant con "Aggiungi card" o "Modifica".
 * Disposizione decisa con la pagina di prova (docs/prova-editor.html del progetto privato):
 *   sempre in vista: satellite vocale + personaggio (esempio / mio file / più modelli);
 *   sezioni chiuse: Carattere, Animazioni, Dove si vede, Avanzate.
 * È fatto con elementi HTML normali e i colori del tema di HA (niente <ha-form>, che non sa fare l'elenco dei modelli,
 * i pulsanti «Crea l'aiutante» e «Controlla i file»). Le chiavi della configurazione che l'editor non conosce restano
 * com'erano (toForm / fromForm).
 */
import { HELPER_IDS, HELPER_OPTIONS, HELPER_ICONS, MIXAMO_FILES, DEFAULT_ANIM_BASE, ANIM_PRESETS, animBase, isSample,
  SAMPLE_MODEL, personalityName } from "./presets.js";
import { themeName } from "./themes.js";
import { t, register, setLang, lang } from "./i18n.js";

register({
  en: {
    e_sat: "Voice satellite", e_satHelp: "The avatar listens, thinks and talks along with this assistant.", e_satNone: "None (idle only)",
    e_char: "Character", e_example: "Example model (included)", e_myfile: "My .vrm file", e_multi: "Several models",
    e_exampleInfo: "To try it right away. When you have your own character made with VRoid Studio, choose “My .vrm file”.",
    e_file: "File address", e_fileHelp: "Copy the file into <code>config/www/avatar/</code> (with File editor or Samba) and write <code>/local/avatar/name.vrm</code> here.",
    e_name: "Name", e_mfile: "File", e_remove: "Remove {name}", e_addModel: "+ Add model", e_modelN: "Model {n}",
    e_modelEntity: "Change model from a helper", e_modelEntityHelp: "So you can change it from an automation or by voice",
    e_helperMissing: "The helper <code>{id}</code> does not exist yet. Without it, {what}.",
    e_helperUses: "Uses <code>{id}</code>", e_create: "Create the helper", e_creating: "Creating…",
    e_createdOk: "Created {id}.", e_createErr: "Could not create the helper: {err}", e_needAdmin: "Only an administrator can create it.",
    e_optionsOld: "The helper <code>{id}</code> does not list: {list}.", e_updateOptions: "Update the options", e_updatedOk: "Options updated.",
    w_model: "the model stays the first in the list", w_pers: "it stays neutral", w_mood: "the mood stays neutral", w_action: "it does no actions", w_theme: "no holiday theme",
    s_char: "Character", s_charSub: "Attitude, mood, actions, holidays",
    e_pers: "Attitude", pers_nessuno: "None (neutral)", pers_serio: "Serious: arms crossed", pers_spiritoso: "Playful: funny faces and winks",
    pers_composto: "Composed: hands together, polite", pers_segui: "Follow a helper",
    e_mood: "Mood from a helper", e_moodHelp: "Happy, sad, surprised… chosen by automations or by voice",
    e_action: "Actions from a helper", e_actionHelp: "Wave, bow, wink, dance",
    e_theme: "Holiday themes", th_nessuno: "None", th_automatico: "Automatic (Halloween, Christmas)", th_halloween: "Always Halloween",
    th_natale: "Always Christmas", th_segui: "Follow a helper",
    s_anim: "Animations", an_nessuna: "Computed movements only (no files)", an_incluse: "Included pack (coming soon)",
    an_mixamo: "My Mixamo clips", an_personalizzate: "Custom (from the code editor)",
    an_nessunaHelp: "Breathing, gaze, gestures and mouth computed by the card. Works right away.",
    e_animBase: "Clips folder", an_mixamoInfo: "Which clips to download from mixamo.com and how to name them: see the guide in the README on GitHub. Missing clips are skipped.",
    e_check: "Check the files", e_checking: "Checking…", e_checkOk: "All {n} clips are there.",
    e_checkMissing: "Found {found} clips out of {n}. Missing: {list}. Computed movements will be used instead.",
    an_customInfo: "Write the list in the code editor. The form does not touch it.",
    s_where: "Where it shows", w_dash: "In the dashboard", w_dashSub: "A box like the other cards",
    w_over: "As an overlay", w_overSub: "In a corner, over the dashboard; taps go through",
    e_framing: "Framing", fr_busto: "Half body", fr_intera: "Full body (coming soon)",
    e_height: "Height", h_auto: "Automatic", h_schermo: "Full screen", h_custom: "{v} (from the code)",
    e_demo: "Test buttons", e_demoHelp: "To try the states without speaking",
    e_corner: "Corner", c_br: "Bottom right", c_bl: "Bottom left", c_tr: "Top right", c_tl: "Top left",
    e_size: "Size", sz_piccola: "Small", sz_media: "Medium", sz_grande: "Large", sz_custom: "Custom (from the code)",
    e_everywhere: "In the other dashboards too", e_everywhereHelp: "Usually it stays only in this one",
    s_adv: "Advanced", s_advSub: "Name, zoom, smoothness, shadow, PC",
    e_cardName: "Name (optional)", e_cardNameHelp: "Shown while loading and on the model button",
    e_zoom: "Zoom", e_fps: "Smoothness", fps_15: "15 frames per second (saver)", fps_30: "30 (recommended)", fps_60: "60",
    fps_custom: "{v} (from the code)",
    e_shadow: "Shadow below", e_pc: "React to what you do on the PC", e_pcHelp: "Cheering while you play, with the Windows app",
    soon: "coming soon",
  },
  it: {
    e_sat: "Satellite vocale", e_satHelp: "L'avatar ascolta, pensa e parla insieme a questo assistente.", e_satNone: "Nessuno (solo riposo)",
    e_char: "Personaggio", e_example: "Modello di esempio (incluso)", e_myfile: "Il mio file .vrm", e_multi: "Più modelli",
    e_exampleInfo: "Per provare subito. Quando hai il tuo personaggio fatto con VRoid Studio, scegli «Il mio file .vrm».",
    e_file: "Indirizzo del file", e_fileHelp: "Copia il file in <code>config/www/avatar/</code> (con File editor o Samba) e scrivi qui <code>/local/avatar/nome.vrm</code>.",
    e_name: "Nome", e_mfile: "File", e_remove: "Togli {name}", e_addModel: "+ Aggiungi modello", e_modelN: "Modello {n}",
    e_modelEntity: "Cambia modello da un aiutante", e_modelEntityHelp: "Così lo cambi da un'automazione o dalla voce",
    e_helperMissing: "L'aiutante <code>{id}</code> non esiste ancora. Senza, {what}.",
    e_helperUses: "Usa <code>{id}</code>", e_create: "Crea l'aiutante", e_creating: "Creazione…",
    e_createdOk: "Creato {id}.", e_createErr: "Non sono riuscito a creare l'aiutante: {err}", e_needAdmin: "Solo un amministratore può crearlo.",
    e_optionsOld: "Nell'aiutante <code>{id}</code> mancano: {list}.", e_updateOptions: "Aggiorna le opzioni", e_updatedOk: "Opzioni aggiornate.",
    w_model: "il modello resta il primo dell'elenco", w_pers: "resta neutro", w_mood: "l'umore resta neutro", w_action: "non fa azioni", w_theme: "niente tema delle feste",
    s_char: "Carattere", s_charSub: "Atteggiamento, umore, azioni, feste",
    e_pers: "Atteggiamento", pers_nessuno: "Nessuno (neutro)", pers_serio: "Serio: braccia conserte", pers_spiritoso: "Spiritoso: smorfie e occhiolini",
    pers_composto: "Composto: mani giunte, cortese", pers_segui: "Segui un aiutante",
    e_mood: "Umore da un aiutante", e_moodHelp: "Felice, triste, sorpreso… scelto da automazioni o a voce",
    e_action: "Azioni da un aiutante", e_actionHelp: "Saluto, inchino, occhiolino, balla",
    e_theme: "Temi delle feste", th_nessuno: "Nessuno", th_automatico: "Automatico (Halloween, Natale)", th_halloween: "Sempre Halloween",
    th_natale: "Sempre Natale", th_segui: "Segui un aiutante",
    s_anim: "Animazioni", an_nessuna: "Solo movimenti calcolati (nessun file)", an_incluse: "Pacchetto incluso (in arrivo)",
    an_mixamo: "Le mie clip Mixamo", an_personalizzate: "Personalizzate (dal codice)",
    an_nessunaHelp: "Respiro, sguardo, gesti e bocca calcolati dalla card. Funziona subito.",
    e_animBase: "Cartella delle clip", an_mixamoInfo: "Quali clip scaricare da mixamo.com e come chiamarle: guida nel README su GitHub. Quelle che mancano vengono saltate.",
    e_check: "Controlla i file", e_checking: "Controllo in corso…", e_checkOk: "Tutte le {n} clip ci sono.",
    e_checkMissing: "Trovate {found} clip su {n}. Mancano: {list}. Al loro posto si useranno i movimenti calcolati.",
    an_customInfo: "Scrivi l'elenco nell'editor di codice. Il modulo non lo tocca.",
    s_where: "Dove si vede", w_dash: "Nella dashboard", w_dashSub: "Un riquadro come le altre card",
    w_over: "In sovrimpressione", w_overSub: "In un angolo, sopra la dashboard; i tocchi passano sotto",
    e_framing: "Inquadratura", fr_busto: "Mezzo busto", fr_intera: "Figura intera (in arrivo)",
    e_height: "Altezza", h_auto: "Automatica", h_schermo: "Tutto lo schermo", h_custom: "{v} (dal codice)",
    e_demo: "Pulsanti di prova", e_demoHelp: "Per provare gli stati senza parlare",
    e_corner: "Angolo", c_br: "In basso a destra", c_bl: "In basso a sinistra", c_tr: "In alto a destra", c_tl: "In alto a sinistra",
    e_size: "Grandezza", sz_piccola: "Piccola", sz_media: "Media", sz_grande: "Grande", sz_custom: "Personalizzata (dal codice)",
    e_everywhere: "Anche nelle altre dashboard", e_everywhereHelp: "Di solito resta solo in questa",
    s_adv: "Avanzate", s_advSub: "Nome, zoom, fluidità, ombra, PC",
    e_cardName: "Nome (facoltativo)", e_cardNameHelp: "Compare durante il caricamento e sul pulsante del modello",
    e_zoom: "Zoom", e_fps: "Fluidità", fps_15: "15 fotogrammi al secondo (risparmio)", fps_30: "30 (consigliata)", fps_60: "60",
    fps_custom: "{v} (dal codice)",
    e_shadow: "Ombra sotto", e_pc: "Reagisci a cosa fai al PC", e_pcHelp: "Tifo durante i giochi, con l'app per Windows",
    soon: "in arrivo",
  },
});

const TYPE = "custom:vrm-assist-avatar-card";
// chiave della configurazione che contiene l'aiutante di ciascuna funzione
const HELPER_KEYS = { model: "model_entity", mood: "mood_entity", personality: "personality_entity", action: "action_entity", theme: "theme_entity" };
const FULL = "calc(100vh - 56px)";
const CORNERS = { br: "bottom-right", bl: "bottom-left", tr: "top-right", tl: "top-left" };
const SIZES = ["piccola", "media", "grande"];
const SIZE_ALIAS = { small: "piccola", medium: "media", large: "grande" };

/** Dalla configurazione della card ai valori del modulo */
export function toForm(c) {
  const models = Array.isArray(c.models) ? c.models.map(m => typeof m === "string" ? { name: m.split("/").pop().replace(/\.vrm$/i, ""), file: m } : { ...m }) : [];
  const ov = c.overlay && c.overlay !== false && !(typeof c.overlay === "object" && c.overlay.enabled === false) ? (c.overlay === true ? {} : c.overlay) : null;
  const pos = ov && (ov.position || "bottom-right");
  const pers = c.personality_entity ? "segui" : personalityName(c.personality) || "nessuno";
  const th = c.theme_entity ? "segui" : themeName(c.theme);
  const size = ov && (ov.width || ov.height ? "custom" : SIZE_ALIAS[String(ov.size || "").toLowerCase()] || (SIZES.includes(ov.size) ? ov.size : "media"));
  return {
    entity: c.entity || "",
    modelMode: models.length ? "multi" : (!c.model || isSample(c.model) || c.model === SAMPLE_MODEL) ? "esempio" : "file",
    file: c.model && !isSample(c.model) && c.model !== SAMPLE_MODEL ? c.model : "",
    models, modelEntity: !!c.model_entity,
    pers: pers === "neutro" ? "nessuno" : pers,
    mood: !!c.mood_entity, action: !!c.action_entity,
    theme: th === "auto" ? "automatico" : th === "segui" ? "segui" : th || "nessuno",
    anim: c.animations === undefined ? "nessuna" : typeof c.animations === "string" && ANIM_PRESETS.includes(c.animations.trim()) ? "mixamo" : "personalizzate",
    animBase: c.anim_base || DEFAULT_ANIM_BASE,
    where: ov ? "overlay" : "dashboard",
    height: !c.height ? "auto" : c.height === FULL ? "schermo" : c.height,
    demo: !!c.demo,
    corner: (Object.keys(CORNERS).find(k => CORNERS[k] === pos)) || "br",
    size, everywhere: !!(ov && ov.everywhere),
    name: c.name || "", zoom: c.zoom ?? 1, fps: c.fps ?? 30, shadow: c.shadow !== false,
  };
}

/** Dai valori del modulo alla configurazione, partendo da quella di prima (le chiavi sconosciute restano) */
export function fromForm(f, old = {}) {
  const c = { ...old, type: old.type || TYPE };
  const set = (k, v) => { if (v === undefined || v === "" || v === false || v === null) delete c[k]; else c[k] = v; };
  set("entity", f.entity);
  // personaggio
  if (f.modelMode === "multi") {
    const list = f.models.filter(m => m.file || m.name);
    c.models = list.map(m => ({ ...m }));
    c.model = list.some(m => m.file === old.model) ? old.model : (list[0] && list[0].file) || "esempio";
    set("model_entity", f.modelEntity && (old.model_entity || HELPER_IDS.model));
  } else {
    delete c.models; delete c.model_entity;
    c.model = f.modelMode === "file" ? (f.file || "") : "esempio";
    if (!c.model) c.model = "/local/avatar/";
  }
  // carattere
  if (f.pers === "segui") { c.personality_entity = old.personality_entity || HELPER_IDS.personality; }
  else { delete c.personality_entity; set("personality", f.pers === "nessuno" ? "" : f.pers); }
  set("mood_entity", f.mood && (old.mood_entity || HELPER_IDS.mood));
  set("action_entity", f.action && (old.action_entity || HELPER_IDS.action));
  if (f.theme === "segui") { if (!c.theme_entity) c.theme_entity = HELPER_IDS.theme; }
  else { delete c.theme_entity; set("theme", f.theme === "nessuno" ? "" : f.theme); }
  // animazioni
  if (f.anim === "nessuna") { delete c.animations; delete c.anim_base; if (typeof old.animations === "string" || old.body === "clip") delete c.body; }
  else if (f.anim === "mixamo") {
    c.animations = "consigliate"; c.body = "clip";
    set("anim_base", animBase(f.animBase) === DEFAULT_ANIM_BASE ? "" : animBase(f.animBase));
  } else if (f.anim === "personalizzate" && (c.animations === undefined || typeof c.animations === "string")) {
    c.animations = {}; delete c.anim_base;
  }
  // dove si vede
  if (f.where === "dashboard") {
    delete c.overlay;
    set("height", f.height === "auto" ? "" : f.height === "schermo" ? FULL : f.height);
    set("demo", f.demo);
  } else {
    const prev = old.overlay && typeof old.overlay === "object" ? { ...old.overlay } : {};
    delete prev.enabled;
    const o = { ...prev, position: CORNERS[f.corner] || "bottom-right" };
    if (f.size !== "custom") { delete o.width; delete o.height; if (f.size === "media") delete o.size; else o.size = f.size; }
    if (f.everywhere) o.everywhere = true; else delete o.everywhere;
    c.overlay = o;
    delete c.height; delete c.demo;
  }
  // avanzate
  set("name", f.name);
  if (+f.zoom && +f.zoom !== 1) c.zoom = +f.zoom; else delete c.zoom;
  if (+f.fps && +f.fps !== 30) c.fps = +f.fps; else delete c.fps;
  if (f.shadow) delete c.shadow; else c.shadow = false;
  return c;
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const ICON = {
  person: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 10c4.4 0 8 1.8 8 4v2H4v-2c0-2.2 3.6-4 8-4",
  face: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3M12 17.5c-2.3 0-4.3-1.4-5.1-3.5h10.2c-.8 2.1-2.8 3.5-5.1 3.5",
  run: "M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5 5 0 0 1-4.3-2.4l-1-1.6a2 2 0 0 0-2.5-.8L6 8.3V13h2V9.6z",
  layout: "M3 3h18v18H3zm2 2v14h8V5zm10 0v6h4V5zm0 8v6h4v-6z",
  tune: "M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z",
  chev: "M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z",
};
const svg = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${ICON[n]}"/></svg>`;

const CSS = `
:host { display: block; }
.ed { display: grid; gap: 14px; font: 14px/1.45 var(--paper-font-body1_-_font-family, Roboto, sans-serif); color: var(--primary-text-color); }
.field { position: relative; display: grid; gap: 4px; }
.field > label { font-size: 12px; color: var(--secondary-text-color); }
select, input[type=text], input[type=number] { width: 100%; box-sizing: border-box; font: inherit; color: var(--primary-text-color);
  background: var(--input-fill-color, var(--secondary-background-color, transparent)); border: 1px solid var(--divider-color);
  border-radius: 6px; padding: 10px 12px; min-height: 44px; }
select:focus-visible, input:focus-visible, button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
.help { font-size: 12.5px; color: var(--secondary-text-color); margin: 0 2px; }
.help code, .alert code { font-family: var(--code-font-family, monospace); font-size: 12px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 2px; }
.row .t { min-width: 0; } .row .t small { display: block; color: var(--secondary-text-color); font-size: 12.5px; }
.row.off { opacity: .55; }
.sw { position: relative; width: 36px; height: 14px; border-radius: 7px; background: var(--divider-color); border: 0; cursor: pointer; flex: none; padding: 0; }
.sw::after { content: ""; position: absolute; top: -3px; left: -2px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--card-background-color, #fff); box-shadow: 0 1px 3px rgba(0,0,0,.4); transition: left .15s; }
.sw[aria-checked="true"] { background: color-mix(in srgb, var(--primary-color) 45%, transparent); }
.sw[aria-checked="true"]::after { left: 18px; background: var(--primary-color); }
.sw:disabled { cursor: default; }
.exp { border: 1px solid var(--divider-color); border-radius: 8px; }
.exp > button { width: 100%; display: flex; align-items: center; gap: 12px; font: inherit; background: none; border: 0;
  color: inherit; padding: 12px 14px; cursor: pointer; text-align: left; }
.exp .ic { width: 22px; height: 22px; color: var(--secondary-text-color); flex: none; }
.exp .ti { flex: 1; min-width: 0; } .exp .ti small { display: block; color: var(--secondary-text-color); font-size: 12.5px; }
.exp .ch { width: 20px; height: 20px; color: var(--secondary-text-color); transition: transform .15s; }
.exp.open .ch { transform: rotate(180deg); }
.exp .in { padding: 4px 14px 14px; display: grid; gap: 14px; }
.radio { display: grid; gap: 4px; }
.radio label { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; padding: 4px 2px; }
.radio input { accent-color: var(--primary-color); margin-top: 3px; }
.radio small { display: block; color: var(--secondary-text-color); font-size: 12.5px; }
.alert { border-radius: 6px; padding: 10px 12px; font-size: 13.5px; display: grid; gap: 8px;
  background: color-mix(in srgb, var(--info-color, #039be5) 12%, transparent); border-left: 4px solid var(--info-color, #039be5); }
.alert.warn { background: color-mix(in srgb, var(--warning-color, #ffa600) 14%, transparent); border-left-color: var(--warning-color, #ffa600); }
.alert.ok { background: color-mix(in srgb, var(--success-color, #43a047) 14%, transparent); border-left-color: var(--success-color, #43a047); }
.alert.err { background: color-mix(in srgb, var(--error-color, #db4437) 14%, transparent); border-left-color: var(--error-color, #db4437); }
.btn { justify-self: start; font: inherit; font-weight: 500; font-size: 14px; border: 0; background: none; color: var(--primary-color);
  padding: 8px 12px; border-radius: 6px; cursor: pointer; }
.btn.outline { border: 1px solid var(--divider-color); }
.btn:disabled { opacity: .5; cursor: default; }
.mlist { display: grid; gap: 8px; }
.mrow { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.4fr) auto; gap: 8px; align-items: end; }
.del { border: 0; background: none; color: var(--secondary-text-color); cursor: pointer; width: 40px; height: 44px; border-radius: 50%; font-size: 16px; }
.soon { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; background: var(--divider-color);
  color: var(--secondary-text-color); border-radius: 4px; padding: 1px 6px; margin-left: 6px; }
`;

export class VrmAssistAvatarCardEditor extends HTMLElement {
  constructor() {
    super();
    this._open = { carattere: false, animazioni: false, dove: false, avanzate: false };
    this._msg = {};          // messaggi dei pulsanti (aiutanti, controllo file)
    this._root = this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    // HA rimanda la configurazione appena cambiata: se è la stessa non si ridisegna (si perderebbe il campo in scrittura)
    if (this._config && JSON.stringify(config) === JSON.stringify(this._config)) return;
    this._config = { ...config };
    this._f = toForm(this._config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const l = lang(); setLang(hass);
    // si ridisegna solo se cambia qualcosa che l'editor mostra: satelliti, aiutanti, lingua
    const sig = this._sig();
    if (sig !== this._lastSig || l !== lang()) this._render();
  }

  _sig() {
    const st = (this._hass && this._hass.states) || {};
    const sats = Object.keys(st).filter(e => e.startsWith("assist_satellite.")).join();
    const helpers = Object.keys(HELPER_IDS).map(k => this._helperId(k)).map(id => st[id] ? id + ":" + (st[id].attributes.options || []).join("|") : "").join();
    return sats + "#" + helpers + "#" + lang();
  }

  _has(id) { return !!(this._hass && this._hass.states && this._hass.states[id]); }

  _change(patch, redraw = true) {
    Object.assign(this._f, patch);
    const config = fromForm(this._f, this._config);
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
    if (redraw) this._render();
  }

  // ── mattoni ──
  _select(key, label, value, options, help = "") {
    return `<div class="field"><label for="f-${key}">${label}</label><select id="f-${key}" data-k="${key}">${options.map(([v, txt, dis]) =>
      `<option value="${esc(v)}"${String(v) === String(value) ? " selected" : ""}${dis ? " disabled" : ""}>${esc(txt)}</option>`).join("")}</select>${help ? `<p class="help">${help}</p>` : ""}</div>`;
  }
  _text(key, label, value, help = "", type = "text") {
    return `<div class="field"><label for="f-${key}">${label}</label><input id="f-${key}" type="${type}" data-k="${key}" value="${esc(value)}"${type === "number" ? ' step="0.05" min="0.3" max="3"' : ""}>${help ? `<p class="help">${help}</p>` : ""}</div>`;
  }
  _switch(key, label, on, small = "", disabled = false) {
    return `<div class="row${disabled ? " off" : ""}"><div class="t">${label}${small ? `<small>${small}</small>` : ""}</div><button class="sw" role="switch" aria-checked="${!!on}" aria-label="${esc(label.replace(/<[^>]+>/g, ""))}"${disabled ? " disabled" : ` data-sw="${key}"`}></button></div>`;
  }
  _section(id, icon, title, sub, inner) {
    const open = this._open[id];
    return `<div class="exp${open ? " open" : ""}"><button data-exp="${id}" aria-expanded="${open}">${svg(icon)}<span class="ti">${title}<small>${esc(sub)}</small></span>${svg("chev", "ch")}</button>${open ? `<div class="in">${inner}</div>` : ""}</div>`;
  }
  _helperId(key) { return (this._config && this._config[HELPER_KEYS[key]]) || HELPER_IDS[key]; }
  _helper(key, what) {
    const id = this._helperId(key), m = this._msg[key];
    const note = m ? `<div class="alert ${m.cls}"><div>${m.text}</div></div>` : "";
    if (!this._hass) return note;
    if (this._has(id)) {
      // per il modello: le opzioni dell'aiutante devono contenere i nomi dei modelli
      if (key === "model") {
        const opts = this._hass.states[id].attributes.options || [];
        const miss = this._f.models.map(x => x.name).filter(n => n && !opts.includes(n));
        if (miss.length) return `<div class="alert warn"><div>${t("e_optionsOld", { id: esc(id), list: miss.map(esc).join(", ") })}</div>${this._adminBtn("update", key, t("e_updateOptions"))}</div>${note}`;
      }
      return `<p class="help">${t("e_helperUses", { id: esc(id) })}</p>${note}`;
    }
    // un aiutante scritto a mano con un altro nome non si crea da qui (avrebbe un id diverso)
    const btn = id === HELPER_IDS[key] ? this._adminBtn("create", key, t("e_create")) : "";
    return `<div class="alert warn"><div>${t("e_helperMissing", { id: esc(id), what })}</div>${btn}</div>${note}`;
  }
  _adminBtn(kind, key, label) {
    const admin = !this._hass.user || this._hass.user.is_admin;
    if (!admin) return `<p class="help">${t("e_needAdmin")}</p>`;
    const busy = this._busy === key;
    return `<button class="btn" data-${kind}="${key}"${busy ? " disabled" : ""}>${busy ? t("e_creating") : label}</button>`;
  }

  _render() {
    if (!this._config || !this._f) return;
    this._lastSig = this._sig();
    const f = this._f, st = (this._hass && this._hass.states) || {};
    let h = `<style>${CSS}</style><div class="ed">`;

    // satellite vocale
    const sats = Object.keys(st).filter(e => e.startsWith("assist_satellite.")).sort();
    if (f.entity && !sats.includes(f.entity)) sats.unshift(f.entity);
    h += this._select("entity", t("e_sat"), f.entity, [["", t("e_satNone")], ...sats.map(e => [e, (st[e] && st[e].attributes.friendly_name) || e])], t("e_satHelp"));

    // personaggio
    h += this._select("modelMode", t("e_char"), f.modelMode, [["esempio", t("e_example")], ["file", t("e_myfile")], ["multi", t("e_multi")]]);
    if (f.modelMode === "esempio") h += `<div class="alert"><div>${t("e_exampleInfo")}</div></div>`;
    if (f.modelMode === "file") h += this._text("file", t("e_file"), f.file, t("e_fileHelp"));
    if (f.modelMode === "multi") {
      h += `<div class="mlist">${f.models.map((m, i) => `<div class="mrow">
        <div class="field"><label for="mn${i}">${t("e_name")}</label><input type="text" id="mn${i}" data-m="${i}" data-f="name" value="${esc(m.name)}"></div>
        <div class="field"><label for="mf${i}">${t("e_mfile")}</label><input type="text" id="mf${i}" data-m="${i}" data-f="file" value="${esc(m.file)}"></div>
        <button class="del" data-delm="${i}" aria-label="${esc(t("e_remove", { name: m.name || m.file }))}">✕</button></div>`).join("")}
        <button class="btn" data-addm>${t("e_addModel")}</button></div>`;
      h += this._switch("modelEntity", t("e_modelEntity"), f.modelEntity, t("e_modelEntityHelp"));
      if (f.modelEntity) h += this._helper("model", t("w_model"));
    }

    // Carattere
    const persOpts = ["nessuno", "serio", "spiritoso", "composto", "segui"].map(k => [k, t("pers_" + k)]);
    const themeOpts = ["nessuno", "automatico", "halloween", "natale", ...(f.theme === "segui" ? ["segui"] : [])].map(k => [k, t("th_" + k)]);
    h += this._section("carattere", "face", t("s_char"), t("s_charSub"),
      this._select("pers", t("e_pers"), f.pers, persOpts)
      + (f.pers === "segui" ? this._helper("personality", t("w_pers")) : "")
      + this._switch("mood", t("e_mood"), f.mood, t("e_moodHelp"))
      + (f.mood ? this._helper("mood", t("w_mood")) : "")
      + this._switch("action", t("e_action"), f.action, t("e_actionHelp"))
      + (f.action ? this._helper("action", t("w_action")) : "")
      + this._select("theme", t("e_theme"), f.theme, themeOpts)
      + (f.theme === "segui" ? this._helper("theme", t("w_theme")) : ""));

    // Animazioni
    const animOpts = [["nessuna", t("an_nessuna")], ["incluse", t("an_incluse"), true], ["mixamo", t("an_mixamo")], ["personalizzate", t("an_personalizzate")]];
    let ai = this._select("anim", t("s_anim"), f.anim, animOpts);
    if (f.anim === "nessuna") ai += `<p class="help">${t("an_nessunaHelp")}</p>`;
    if (f.anim === "mixamo") {
      ai += this._text("animBase", t("e_animBase"), f.animBase) + `<div class="alert"><div>${t("an_mixamoInfo")}</div></div>`
        + `<button class="btn outline" data-check${this._checking ? " disabled" : ""}>${t("e_check")}</button>`;
      const c = this._check;
      if (this._checking) ai += `<p class="help">${t("e_checking")}</p>`;
      else if (c) ai += `<div class="alert ${c.missing.length ? "warn" : "ok"}"><div>${c.missing.length
        ? t("e_checkMissing", { found: MIXAMO_FILES.length - c.missing.length, n: MIXAMO_FILES.length, list: c.missing.map(n => `<code>${esc(n)}</code>`).join(", ") })
        : t("e_checkOk", { n: MIXAMO_FILES.length })}</div></div>`;
    }
    if (f.anim === "personalizzate") ai += `<div class="alert"><div>${t("an_customInfo")}</div></div>`;
    h += this._section("animazioni", "run", t("s_anim"), (animOpts.find(o => o[0] === f.anim) || animOpts[0])[1], ai);

    // Dove si vede
    let di = `<div class="radio" role="radiogroup" aria-label="${esc(t("s_where"))}">
      <label><input type="radio" name="where" value="dashboard"${f.where === "dashboard" ? " checked" : ""}><span>${t("w_dash")}<small>${t("w_dashSub")}</small></span></label>
      <label><input type="radio" name="where" value="overlay"${f.where === "overlay" ? " checked" : ""}><span>${t("w_over")}<small>${t("w_overSub")}</small></span></label></div>`;
    di += this._select("framing", t("e_framing"), "busto", [["busto", t("fr_busto")], ["intera", t("fr_intera"), true]]);
    if (f.where === "dashboard") {
      const hs = [["auto", t("h_auto")], ["schermo", t("h_schermo")], ["400px", "400 px"], ["300px", "300 px"]];
      if (!hs.some(o => o[0] === f.height)) hs.push([f.height, t("h_custom", { v: f.height })]);
      di += this._select("height", t("e_height"), f.height, hs) + this._switch("demo", t("e_demo"), f.demo, t("e_demoHelp"));
    } else {
      const sz = SIZES.map(k => [k, t("sz_" + k)]);
      if (f.size === "custom") sz.push(["custom", t("sz_custom")]);
      di += this._select("corner", t("e_corner"), f.corner, Object.keys(CORNERS).map(k => [k, t("c_" + k)]))
        + this._select("size", t("e_size"), f.size, sz)
        + this._switch("everywhere", t("e_everywhere"), f.everywhere, t("e_everywhereHelp"));
    }
    h += this._section("dove", "layout", t("s_where"), f.where === "dashboard" ? t("w_dash") : t("w_over"), di);

    // Avanzate
    const fps = [["15", t("fps_15")], ["30", t("fps_30")], ["60", t("fps_60")]];
    if (!fps.some(o => o[0] === String(f.fps))) fps.push([String(f.fps), t("fps_custom", { v: f.fps })]);
    h += this._section("avanzate", "tune", t("s_adv"), t("s_advSub"),
      this._text("name", t("e_cardName"), f.name, t("e_cardNameHelp"))
      + this._text("zoom", t("e_zoom"), f.zoom, "", "number")
      + this._select("fps", t("e_fps"), String(f.fps), fps)
      + this._switch("shadow", t("e_shadow"), f.shadow)
      + this._switch("pc", `${t("e_pc")}<span class="soon">${t("soon")}</span>`, false, t("e_pcHelp"), true));

    h += `</div>`;
    // si conserva il campo in cui si stava scrivendo
    const act = this._root.activeElement, focusId = act && act.id, sel = act && act.selectionStart;
    this._root.innerHTML = h;
    if (focusId) { const el = this._root.getElementById(focusId); if (el) { el.focus(); try { if (sel != null) el.setSelectionRange(sel, sel); } catch (e) { /* select */ } } }
    this._wire();
  }

  _wire() {
    const R = this._root;
    R.querySelectorAll("select[data-k]").forEach(el => el.addEventListener("change", () => {
      const k = el.dataset.k;
      if (k === "modelMode" && el.value === "multi" && !this._f.models.length) {
        const first = this._f.modelMode === "file" && this._f.file ? [{ name: this._f.file.split("/").pop().replace(/\.vrm$/i, ""), file: this._f.file }] : [];
        this._f.models = first.length ? first : [{ name: t("e_modelN", { n: 1 }), file: "/local/avatar/" }];
      }
      if (k === "anim") this._check = null;
      this._change({ [k]: el.value });
    }));
    // campi di testo: la configurazione cambia mentre si scrive, il modulo si ridisegna solo all'uscita dal campo
    R.querySelectorAll("input[data-k]").forEach(el => {
      el.addEventListener("input", () => this._change({ [el.dataset.k]: el.value }, false));
      el.addEventListener("change", () => { if (el.dataset.k === "animBase") this._check = null; this._render(); });
    });
    R.querySelectorAll("input[data-m]").forEach(el => {
      el.addEventListener("input", () => { this._f.models[+el.dataset.m][el.dataset.f] = el.value; this._change({}, false); });
      el.addEventListener("change", () => this._render());
    });
    R.querySelectorAll("input[name=where]").forEach(el => el.addEventListener("change", () => this._change({ where: el.value })));
    R.querySelectorAll("button[data-sw]").forEach(b => b.addEventListener("click", () => this._change({ [b.dataset.sw]: !this._f[b.dataset.sw] })));
    R.querySelectorAll("button[data-exp]").forEach(b => b.addEventListener("click", () => { this._open[b.dataset.exp] = !this._open[b.dataset.exp]; this._render(); }));
    R.querySelectorAll("button[data-delm]").forEach(b => b.addEventListener("click", () => { this._f.models.splice(+b.dataset.delm, 1); this._change({}); }));
    const add = R.querySelector("button[data-addm]");
    if (add) add.addEventListener("click", () => { this._f.models.push({ name: t("e_modelN", { n: this._f.models.length + 1 }), file: "/local/avatar/" }); this._change({}); });
    R.querySelectorAll("button[data-create]").forEach(b => b.addEventListener("click", () => this._createHelper(b.dataset.create)));
    R.querySelectorAll("button[data-update]").forEach(b => b.addEventListener("click", () => this._updateModelHelper()));
    const chk = R.querySelector("button[data-check]");
    if (chk) chk.addEventListener("click", () => this._checkFiles());
  }

  _helperOptions(key) {
    if (key === "model") return [...new Set(this._f.models.map(m => m.name).filter(Boolean))];
    return HELPER_OPTIONS[lang()][key];
  }

  /** «Crea l'aiutante»: input_select con l'id giusto (il nome "Avatar umore" dà input_select.avatar_umore) */
  async _createHelper(key) {
    const id = HELPER_IDS[key], name = id.split(".")[1].replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
    const options = this._helperOptions(key);
    this._busy = key; this._msg[key] = null; this._render();
    try {
      if (!options.length) throw new Error("no options");
      await this._hass.callWS({ type: "input_select/create", name, options, icon: HELPER_ICONS[key] });
      this._msg[key] = { cls: "ok", text: t("e_createdOk", { id }) };
    } catch (e) {
      this._msg[key] = { cls: "err", text: t("e_createErr", { err: esc((e && e.message) || e) }) };
    }
    this._busy = null; this._render();
  }

  /** Aggiunge all'aiutante dei modelli i nomi che mancano */
  async _updateModelHelper() {
    const id = this._helperId("model"), key = "model";
    this._busy = key; this._msg[key] = null; this._render();
    try {
      const list = await this._hass.callWS({ type: "input_select/list" });
      const item = list.find(x => "input_select." + x.id === id) || list.find(x => (x.name || "").toLowerCase().replace(/\s+/g, "_") === id.split(".")[1]);
      if (!item) throw new Error(id);
      const opts = [...new Set([...(item.options || []), ...this._helperOptions(key)])];
      await this._hass.callWS({ type: "input_select/update", input_select_id: item.id, name: item.name, options: opts, ...(item.icon ? { icon: item.icon } : {}) });
      this._msg[key] = { cls: "ok", text: t("e_updatedOk") };
    } catch (e) {
      this._msg[key] = { cls: "err", text: t("e_createErr", { err: esc((e && e.message) || e) }) };
    }
    this._busy = null; this._render();
  }

  /** «Controlla i file»: prova a scaricare l'inizio di ogni clip dalla cartella e dice quali mancano */
  async _checkFiles() {
    const base = animBase(this._f.animBase);
    this._checking = true; this._check = null; this._render();
    const res = await Promise.all(MIXAMO_FILES.map(async n => {
      try { const r = await fetch(base + n, { method: "HEAD", cache: "no-store" }); return r.ok ? null : n; } catch (e) { return n; }
    }));
    this._check = { missing: res.filter(Boolean) };
    this._checking = false; this._render();
  }
}
if (!customElements.get("vrm-assist-avatar-card-editor")) customElements.define("vrm-assist-avatar-card-editor", VrmAssistAvatarCardEditor);
