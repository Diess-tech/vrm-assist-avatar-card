/* vrm-assist-avatar-card — avatar 3D VRM animato per Home Assistant (v0.1.0)
 * Versione pubblica, nata dalla card privata vrm-avatar-card v1.8.4. https://github.com/Diess-tech/vrm-assist-avatar-card */
const VERSION = "0.1.0";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { parseAnimationConfig, loadAnimationClip, pruneStaticTracks } from "./animations.js";
import { PERSONALITIES, MOODS, ACTIONS, ARMS, moodName, actionName, hold, pulse, clipFace, CHEER, FUNNY } from "./personalities.js";
import { calibrateArms } from "./calibrate.js";
import { setupFunny, FACES } from "./funny.js";
import { expandAnimations, ANIM_PRESETS, resolveModel, personalityName } from "./presets.js";
import { t, setLang } from "./i18n.js";
import "./editor.js";
import { buildTheme, measureHead, themeName, themeForDate } from "./themes.js";
import { overlayOptions, mountOverlay, unmountOverlay, restoreOverlay } from "./overlay.js";

// Le librerie sono incluse nel file finale (nessun CDN)
const loadLibs = () => Promise.resolve({ THREE, GLTFLoader, VRMLoaderPlugin, VRMUtils });

const STATE_MAP = { listening: "ascolta", processing: "pensa", responding: "parla" };
const PERS_KEYS = ["serio", "spiritoso", "composto"];

// Pose obiettivo per ogni stato (il personaggio ci arriva gradualmente)
const POSES = {
  riposo: { lean: 0.0,  headX: 0.02, headY: 0.0,  headZ: 0.0,  armL: 1.5,  armR: 1.5,  elbL: 0.25, elbR: 0.25, smile: 0.15, brow: 0, speak: 0, sway: 1.0, gx: 0, gy: 0 },
  // ascolta: attento (sopracciglia su, occhi un po' più aperti, sorriso leggero); l'inclinazione della testa cambia ogni tanto (vedi _tick)
  ascolta:{ lean: 0.06, headX: 0.04, headY: 0.0,  headZ: 0.05, armL: 1.46, armR: 1.46, elbL: 0.35, elbR: 0.35, smile: 0.3, brow: 0.25, speak: 0, sway: 0.4, gx: 0, gy: 0, part: 1 },
  // pensa: mano destra chiusa sotto il mento (valori trovati misurando la posizione delle nocche sul modello)
  pensa:  { lean: -0.02,headX: -0.13,headY: 0.18, headZ: -0.07,armR: 1.45, elbR: 2.42, smile: 0.0,  brow: -0.4, speak: 0, sway: 0.25, gx: 0.22, gy: 0.1,
            fwdR: 0.47, twR: 0.66, wrR: 0.28, fistR: 0.8,
            // braccio sinistro piegato sotto il gomito destro (posa "del pensatore", da solvePose); viso pensieroso
            armL: 1.89, fwdL: 0.81, twL: 1.385, elbL: 1.223, wrL: 0.272, fistL: 0.35, lips: 0.3, frown: 0.15 },
  parla:  { lean: 0.05, headX: 0.0,  headY: 0.0,  headZ: 0.03, armL: 1.44, armR: 1.42, elbL: 0.45, elbR: 0.5,  smile: 0.25, brow: 0.15,  speak: 1, sway: 0.8, gx: 0, gy: 0 },
};
// Valori non indicati in una posa: 0 per spalla avanti, rotazione e polso; dita appena piegate
for (const p of Object.values(POSES)) for (const k of ["fwdL", "fwdR", "twL", "twR", "wrL", "wrR"]) p[k] = p[k] || 0;
for (const p of Object.values(POSES)) for (const k of ["fistL", "fistR"]) p[k] = p[k] ?? 0.25; // dita appena piegate
// Campi usati dagli atteggiamenti (vedi personalities.js)
for (const p of Object.values(POSES)) Object.assign(p, { energy: 1, shift: 0, focus: 0, wink: 0, whistle: 0, gest: 1, nod: 1,
  surprise: 0, eyeSmile: 0, lips: 0, frown: 0, sad: 0, sleepy: 0, part: 0, gape: 0, gazeHead: 0, tremble: 0, dart: 0, ...p });
const FAST = { speak: 8, wink: 25, whistle: 8, surprise: 14, lips: 10, brow: 6 }; // campi che cambiano più in fretta degli altri

// Valori originali (trovati sul modello di riferimento) delle pose delle braccia: a ogni modello si ritarano partendo da questi
const ARM_KEYS = ["armL", "fwdL", "twL", "elbL", "wrL", "armR", "fwdR", "twR", "elbR", "wrR"];
const pick = o => Object.fromEntries(ARM_KEYS.filter(k => k in o).map(k => [k, o[k]]));
const ARM_ORIG = { pensa: pick(POSES.pensa), ...Object.fromEntries(Object.entries(ARMS).map(([k, v]) => [k, pick(v)])) };

const nz = (t, s) => Math.sin(t * 0.71 + s) * 0.5 + Math.sin(t * 1.37 + s * 2.1) * 0.3 + Math.sin(t * 2.93 + s * 3.7) * 0.2;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rnd = (a, b) => a + Math.random() * (b - a);
const FADE = 0.5; // secondi di passaggio sfumato tra un'animazione e l'altra

class VrmAvatarCard extends HTMLElement {
  setConfig(config) {
    // senza model (e senza models) si usa il modello di esempio: la card si vede subito
    this._config = { zoom: 1, fps: 30, height: "480px", demo: false, ...config };
    if (!config.model && !(Array.isArray(config.models) && config.models.length)) this._config.model = "esempio";
    config = this._config;
    // pacchetti pronti (v1.7, scelti dall'editor grafico): animations: consigliate | consigliate+clawatar
    if (typeof config.animations === "string") {
      if (ANIM_PRESETS.includes(config.animations.trim())) {
        this._config.animations = expandAnimations(config.animations.trim(), config.anim_base);
        if (!config.body) this._config.body = "clip";
      } else {
        console.warn(`vrm-assist-avatar-card: animations "${config.animations}" sconosciuto (usa ${ANIM_PRESETS.join(" o ")})`);
        delete this._config.animations;
      }
    }
    // body: clip = il corpo lo muovono solo le clip (come le app di VRoid); la card gestisce solo viso, occhi e passaggi
    // (la testa resta alla card anche qui: con la testa delle clip il personaggio a volte guardava in basso)
    this._pure = this._config.body === "clip";
    this._forced = null;
    this._mood = this._mood || "neutro";
    const pb = personalityName(config.personality);
    this._persBase = pb && PERSONALITIES[pb] ? pb : "neutro";
    this._persName = this._persBase;
    if (config.personality && pb === undefined)
      console.warn(`vrm-assist-avatar-card: personality "${config.personality}" sconosciuta (usa serio, spiritoso o composto)`);
    // Modelli tra cui scegliere: models (elenco) oppure il solo model
    this._models = (Array.isArray(config.models) ? config.models : [])
      .map(m => typeof m === "string" ? { name: m.split("/").pop().replace(/\.vrm$/i, ""), file: m } : m)
      .filter(m => m && m.file).map(m => ({ ...m, file: resolveModel(m.file) }));
    if (!this._models.length) this._models = [{ name: config.name || (resolveModel(config.model) !== config.model ? "VRM" : String(config.model).split("/").pop().replace(/\.vrm$/i, "")), file: resolveModel(config.model) }];
    const first = this._models.findIndex(m => m.file === resolveModel(config.model));
    this._modelIdx = first >= 0 ? first : 0;
    this._choosePersonality();
    // tema delle feste (v1.8): nessuno (default), automatico (in base alla data), halloween, natale
    if (config.theme !== undefined && themeName(config.theme) === undefined)
      console.warn(`vrm-assist-avatar-card: theme "${config.theme}" sconosciuto (usa automatico, halloween, natale o nessuno)`);
    if (this._themePick === undefined || !config.theme_entity) this._themePick = themeName(config.theme) ?? null;
    this._applyTheme();
    if (this._root) this._buildUi();
  }

  /** Tema delle feste: halloween, natale, automatico (in base alla data) o nessuno */
  setTheme(name) {
    const t = themeName(name);
    if (t === undefined) { console.warn(`vrm-assist-avatar-card: tema "${name}" sconosciuto`); return; }
    this._themePick = t;
    this._applyTheme();
  }
  _applyTheme(force) {
    const want = this._themePick === "auto" ? themeForDate() : this._themePick || null;
    this._themeChecked = this._t || 0;
    if (!force && this._themeBuilt && (this._theme ? this._theme.name : null) === want) return;
    if (this._theme) this._theme.dispose();
    this._theme = null; this._themeBuilt = false;
    if (!this._vrm || !this._scene) return;   // si rifà quando il modello è pronto
    if (want) this._theme = buildTheme(want, this._vrm, this._THREE, this._scene, this._headAnchor);
    this._themeBuilt = true;
    if (this._key) this._key.color.setHex(this._theme ? this._theme.light : 0xffffff);
    // inquadratura: la zona da mostrare sale fin sopra il cappello (e torna com'era senza tema)
    const F = this._frame;
    if (F) {
      // il riquadro si allunga verso l'alto fino alla punta del cappello (60% in più di altezza, il resto sposta la vista
      // in su: il busto resta grande)
      const extra = this._theme && this._theme.hatTop ? Math.max(0, this._theme.hatTop - F.top0) * (this._config.headroom ? 0.3 : 1) : 0;
      const dh = extra * 0.6 - (F.dh || 0);
      F.top = F.top0 + extra; F.dh = extra * 0.6;
      F.h0 += dh; F.h += dh; F.low += dh;
      this._resize();
    }
  }


  /** Atteggiamento in uso: quello scelto (setPersonality / personality_entity) > quello del modello (models[].personality)
   *  > personality della card. "automatico" toglie la scelta. */
  _choosePersonality() {
    const m = this._models && this._models[this._modelIdx];
    const mp = m && personalityName(m.personality);
    const name = this._persPick || (mp && PERSONALITIES[mp] ? mp : this._persBase);
    this._persName = PERSONALITIES[name] ? name : "neutro";
  }

  /** Attività al PC (da app desktop o da activity_entity), es. "gioco: Elden Ring". Con "gioco" a riposo fa il tifo. */
  setActivity(text) {
    const kind = String(text || "").trim().toLowerCase().split(/[:\s]/)[0];
    // appena comincia un gioco, il primo gesto di tifo parte entro un secondo
    if (kind === "gioco" && this._activity !== "gioco" && this._idle && this._t !== undefined) this._idle.next = Math.min(this._idle.next, this._t + 1);
    this._activity = kind;
  }

  /** Atteggiamento: serio, spiritoso, composto, nessuno (= neutro), oppure automatico (quello del modello o della card) */
  setPersonality(name) {
    const p = personalityName(name);
    this._persPick = p && PERSONALITIES[p] ? p : null;
    this._choosePersonality();
  }
  set hass(hass) {
    this._hass = hass;
    setLang(hass);
    if (this._config && this._config.overlay !== undefined) return;
    // Modello scelto da Home Assistant (model_entity: lo stato è il nome o il file del modello)
    const id = this._config.model_entity, st = id && hass && hass.states[id] && hass.states[id].state;
    if (st && st !== this._modelEntityState) {
      this._modelEntityState = st;
      const i = this._models.findIndex(m => m.name === st || m.file === st);
      // (v1.4.1) se il primo modello non è ancora partito si sceglie subito questo; se è in caricamento o se ne sta
      // cambiando un altro, si ricorda e si cambia appena possibile (prima la richiesta andava persa: restava il personaggio)
      if (i >= 0 && !this._vrm && !this._loadingFirst) this._modelIdx = i;
      else if (i >= 0) { this._wantModel = i; this._applyWantedModel(); }
      else console.warn(`vrm-assist-avatar-card: ${id} = "${st}" non corrisponde a nessun modello in models`);
    }
    // Tema delle feste da Home Assistant (theme_entity): automatico, nessuno, halloween, natale
    const tid = this._config.theme_entity, ts = tid && hass && hass.states[tid];
    if (ts && ts.state !== this._themeEntityState && !["unknown", "unavailable"].includes(ts.state)) {
      this._themeEntityState = ts.state; this.setTheme(ts.state);
    }
    // Atteggiamento scelto da Home Assistant (personality_entity): serio, spiritoso, composto, nessuno, automatico
    const pid = this._config.personality_entity, ps = pid && hass && hass.states[pid];
    if (ps && ps.state !== this._persEntityState) { this._persEntityState = ps.state; this.setPersonality(ps.state); }
    // Cosa si fa al PC (activity_entity, scritto da app desktop): "gioco: …" = tifo
    const acid = this._config.activity_entity, acs = acid && hass && hass.states[acid];
    if (acs) this.setActivity(acs.state);
    // Umore scelto da Home Assistant (mood_entity), in italiano o in inglese
    const mid = this._config.mood_entity, ms = mid && hass && hass.states[mid];
    if (ms) this.setMood(moodName(ms.state));
    // Azioni chieste da Home Assistant (action_entity): ogni cambio di stato è una richiesta.
    // Con input_select / input_text lo stato è il nome dell'azione; con un pulsante (input_button, button) è un saluto.
    const aid = this._config.action_entity, as = aid && hass && hass.states[aid];
    if (as) {
      const key = as.state + "|" + (as.last_changed || "");
      if (this._actionSeen !== undefined && key !== this._actionSeen) {
        const domain = aid.split(".")[0];
        // "nessuna" (o vuoto) è lo stato di riposo dell'aiutante: l'app desktop ci torna dopo ogni azione
        if (!/^(nessuna|nessuno|none|-|)$/i.test(String(as.state).trim()) && !["unknown", "unavailable"].includes(as.state))
          this.doAction(domain === "input_button" || domain === "button" ? "saluto" : as.state);
      }
      this._actionSeen = key;
    }
    if (this._root && this._config.demo) this._renderButtons();
  }

  /** Umore: neutro, felice, triste, sorpreso, arrabbiato, stanco, pensieroso (vedi MOODS in personalities.js) */
  setMood(name) {
    name = MOODS[name] ? name : moodName(name);
    if (name === this._mood) return;
    this._mood = name;
    const e = MOODS[name].enter;
    if (e && this._t !== undefined) { const { dur, ...f } = e; this._react = { f, t0: this._t, dur }; }
  }

  /** Azione: saluto, inchino, occhiolino. Se il personaggio sta ascoltando o parlando, la fa appena torna a riposo (entro 20 s). */
  doAction(what) {
    const name = actionName(what);
    if (!name) { console.warn(`vrm-assist-avatar-card: azione "${what}" sconosciuta (usa saluto, inchino, occhiolino)`); return; }
    this._pendingAction = { name, until: (this._t || 0) + 20 };
  }

  _startAction(name) {
    const t = this._t, I = this._idle, pers = PERSONALITIES[this._persName];
    const clips = this._clipList(name);
    const clip = clips && clips[Math.floor(Math.random() * clips.length)];
    // con una clip (es. waving.fbx) il viso sorride e la mano non deve passare davanti alla faccia (faceGuard)
    const face = clip && clipFace(clip.name);
    I.g = clip ? { name, clip, faceGuard: true, apply: face || ((T, u) => { T.eyeSmile = Math.max(T.eyeSmile, 0.3 * hold(u, 0.15)); T.smile = Math.max(T.smile, 0.65 * hold(u, 0.15)); }) } : ACTIONS[name];
    // i balli possono durare molto: al massimo 12 s
    I.t0 = t; I.until = t + (clip ? Math.min(12, Math.max(1, clip.duration - FADE)) : I.g.dur[0]);
    I.next = I.until + rnd(...pers.every); I.dir = 1;
  }
  getCardSize() { return this._config && this._config.overlay !== undefined ? 0 : 8; }
  getGridOptions() { return { columns: 12, rows: 8, min_rows: 4 }; }
  /** Editor grafico (v1.7, src/editor.js) */
  static getConfigElement() { return document.createElement("vrm-assist-avatar-card-editor"); }
  /** Configurazione proposta quando si aggiunge la card dall'elenco di HA */
  static getStubConfig(hass) {
    const sat = hass && Object.keys(hass.states || {}).find(e => e.startsWith("assist_satellite."));
    return { model: "esempio", ...(sat ? { entity: sat } : {}), personality: "composto" };
  }

  connectedCallback() {
    // Card in modalità sovrimpressione: al suo posto non disegna niente, crea il livello sopra l'interfaccia
    if (this._config && this._config.overlay !== undefined) {
      if (!this._root) this._root = this.attachShadow({ mode: "open" });
      this._root.innerHTML = this._config.demo ? `<div style="padding:8px;color:var(--secondary-text-color);font:13px sans-serif">${t("overlayDemo", { name: this._config.name || "Avatar" })}</div>` : "";
      const { overlay, ...rest } = this._config, o = overlayOptions(this._config);
      // v1.8.2: nell'anteprima dell'editor la sovrimpressione non si accende (prima si accendeva e restava memorizzata
      // sul dispositivo, in tutte le schermate, anche annullando). HA imposta "preview" poco dopo: si controlla al giro dopo.
      setTimeout(() => {
        if (!this.isConnected) return;
        if (this._inEditor()) {
          this._root.innerHTML = `<div style="padding:12px;color:var(--secondary-text-color);font:13px sans-serif">${t("overlayEditor", { name: this._config.name || "Avatar", pos: o ? o.position : t("overlayOff") })}</div>`;
          return;
        }
        if (o) mountOverlay(rest, o); else unmountOverlay(true);
      }, 0);
      return;
    }
    if (!this._root) {
      this._root = this.attachShadow({ mode: "open" });
      this._buildUi();
    }
    this._running = true;
    this._start();
  }
  /** La card è l'anteprima dentro l'editor di Home Assistant? */
  _inEditor() {
    if (this.preview === true) return true;
    for (let n = this; n; n = n.parentNode || n.host) {
      const t = n.localName;
      if (t === "hui-card-preview" || t === "hui-dialog-edit-card" || t === "hui-card-picker" || t === "vrm-assist-avatar-card-editor") return true;
    }
    return false;
  }
  disconnectedCallback() {
    if (this._config && this._config.overlay !== undefined) return;
    this._running = false;
    if (this._renderer) this._renderer.setAnimationLoop(null);
  }

  _buildUi() {
    const h = this._config.height;
    this._root.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { display: block; background: transparent; border: none; box-shadow: none; overflow: hidden; position: relative; height: ${h}; }
        .stage { position: absolute; inset: 0; }
        canvas { display: block; width: 100%; height: 100%; }
        .msg { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 16px;
               color: var(--secondary-text-color); font: 14px/1.4 var(--paper-font-body1_-_font-family, sans-serif); }
        .bar { position: absolute; left: 0; right: 0; bottom: 8px; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
        .bar .sep { flex-basis: 100%; height: 0; }
        .bar button.pers { font-size: 12px; padding: 4px 10px; }
        .bar button { border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);
               border-radius: 999px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
        .bar button.on { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
        .note { position: absolute; left: 8px; right: 8px; top: 8px; color: var(--warning-color, #ffa600);
               font: 12px/1.4 var(--paper-font-body1_-_font-family, sans-serif); pointer-events: none; }
        .bar button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      </style>
      <ha-card><div class="stage"></div><div class="msg">${t("loading", { name: (this._models && this._models[this._modelIdx].name) || this._config.name || "Avatar" })}</div><div class="note"></div><div class="bar"></div></ha-card>`;
    this._stage = this._root.querySelector(".stage");
    this._msg = this._root.querySelector(".msg");
    this._bar = this._root.querySelector(".bar");
    this._note = this._root.querySelector(".note");
    if (this._renderer) this._stage.appendChild(this._renderer.domElement);
    this._renderButtons();
  }

  _renderButtons() {
    if (!this._bar) return;
    if (!this._config.demo) { this._bar.innerHTML = ""; return; }
    const cur = this._forced || "auto";
    const keys = this._config.entity ? ["auto", "riposo", "ascolta", "pensa", "parla"] : ["riposo", "ascolta", "pensa", "parla"];
    const modelName = this._models.length > 1 ? this._models[this._modelIdx].name : "";
    const sig = keys.join() + cur + this._persName + modelName + (this._swapping ? "…" : "");
    if (this._barSig === sig) return;
    this._barSig = sig;
    // Prima riga: atteggiamenti (per provarli); seconda riga: stati
    this._bar.innerHTML = PERS_KEYS.map(k => `<button class="pers ${k === this._persName ? "on" : ""}" data-p="${k}">${t("p_" + k)}</button>`).join("")
      + (modelName ? `<button class="pers" data-m="1">${t("model", { name: modelName })}${this._swapping ? "…" : ""}</button>` : "")
      + `<span class="sep"></span>`
      + keys.map(k => `<button data-k="${k}" class="${(k === cur || (!this._config.entity && k === (this._forced || "riposo"))) ? "on" : ""}">${t("st_" + k)}</button>`).join("");
    this._bar.querySelectorAll("button[data-k]").forEach(b => b.onclick = () => {
      this._forced = b.dataset.k === "auto" ? null : b.dataset.k;
      this._barSig = null; this._renderButtons();
    });
    const mb = this._bar.querySelector("button[data-m]");
    if (mb) mb.onclick = () => { if (!this._swapping) this.setModel((this._modelIdx + 1) % this._models.length); };
    this._bar.querySelectorAll("button[data-p]").forEach(b => b.onclick = () => {
      this.setPersonality(b.dataset.p === this._persName ? "nessuno" : b.dataset.p); // secondo tocco = nessun atteggiamento
      if (this._idle) this._idle.until = 0;
      this._barSig = null; this._renderButtons();
    });
  }

  _wanted() {
    if (this._forced) return this._forced;
    const e = this._config.entity && this._hass && this._hass.states[this._config.entity];
    return (e && STATE_MAP[e.state]) || "riposo";
  }

  async _start() {
    if (this._loading || this._vrm) { if (this._vrm) this._loop(); return; }
    this._loading = true;
    try {
      const L = await loadLibs();
      this._L = L;
      await this._init(L);
      this._msg.textContent = "";
      this._animReady = this._loadAnimations();
      this._loop();
      this._animReady.then(() => this._applyWantedModel());   // modello chiesto da HA durante il primo caricamento
    } catch (err) {
      console.error("vrm-assist-avatar-card", err);
      this._msg.textContent = String(err && err.message || err).includes("404")
        ? t("notFound", { file: this._models[this._modelIdx].file })
        : t("loadError", { err: err && err.message || err });
    } finally { this._loading = false; }
  }

  async _init({ THREE }) {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    this._renderer = renderer;
    this._stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
    const key = new THREE.DirectionalLight(0xffffff, Math.PI); key.position.set(-0.4, 1.0, 2.0);
    scene.add(key); this._key = key;

    this._scene = scene; this._camera = camera; this._THREE = THREE;
    this._camLook = new THREE.Vector3();
    this._gaze = new THREE.Object3D(); scene.add(this._gaze);
    this._gazeOff = new THREE.Vector3();
    // Ombra morbida sotto i piedi (shadow: false per toglierla): fa capire dov'è il pavimento
    if (this._config.shadow !== false) {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const g = c.getContext("2d"), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      // alone chiaro (il "pavimento", visibile anche sul tema scuro) con l'ombra scura dove poggiano i piedi
      grd.addColorStop(0, "rgba(0,0,0,0.8)"); grd.addColorStop(0.18, "rgba(0,0,0,0.45)"); grd.addColorStop(0.3, "rgba(255,255,255,0.05)");
      grd.addColorStop(0.5, "rgba(255,255,255,0.13)"); grd.addColorStop(0.78, "rgba(255,255,255,0.06)"); grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
      this._shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), mat);
      this._shadow.rotation.x = -Math.PI / 2; this._shadow.renderOrder = -1;
      scene.add(this._shadow);
    }
    this._loadingFirst = true;
    await this._loadModel(this._models[this._modelIdx].file);
    this._loadingFirst = false;

    this._P = { ...POSES.riposo };
    this._clock = new THREE.Clock();
    this._t = 0; this._acc = 0;
    this._blink = { next: rnd(1.5, 4), t: -1, double: false };
    this._idle = { next: rnd(6, 10), until: 0, g: null };
    this._micro = { next: rnd(3, 6), until: 0, g: null };   // micro-espressioni del viso a riposo
    this._react = null;                                      // reazione del viso a un cambio di stato
    this._sacc = { next: 0, x: 0, y: 0, ox: 0, oy: 0 };      // piccoli scatti degli occhi
    this._mouth = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this._syl = { t0: 0, end: 0, dur: 0, v: "aa", amp: 0, left: 0, pause: true, phrase: 1 };

    const ro = new ResizeObserver(() => this._resize());
    ro.observe(this._stage); this._resize();
    document.addEventListener("visibilitychange", () => { if (!document.hidden && this._running) this._loop(); });
  }

  // Animazioni vere (VRMA / Mixamo): gli stati senza file restano con la posa procedurale
  async _loadAnimations() {
    const groups = parseAnimationConfig(this._config.animations);
    const urls = [...new Set(Object.values(groups).flatMap(g => Object.values(g).flat()))];
    if (!urls.length) return;
    const vrm = this._vrm, byUrl = {}, errors = [];
    const res = await Promise.allSettled(urls.map(u => loadAnimationClip(u, vrm)));
    res.forEach((r, i) => {
      if (r.status === "fulfilled") byUrl[urls[i]] = pruneStaticTracks(r.value, vrm);
      else { console.warn("vrm-assist-avatar-card: animazione non caricata", urls[i], r.reason); errors.push(urls[i]); }
    });
    // Gruppi di clip: "tutti" vale per ogni atteggiamento, quelli con il nome di un atteggiamento lo sostituiscono
    const clipGroups = {};
    for (const [g, keys] of Object.entries(groups)) {
      clipGroups[g] = {};
      for (const [k, list] of Object.entries(keys)) {
        const cl = list.map(u => byUrl[u]).filter(Boolean);
        if (cl.length) clipGroups[g][k] = cl;
      }
    }
    const clips = Object.values(byUrl);
    if (errors.length && this._note) {
      this._note.textContent = t("animErrors", { list: errors.map(u => u.split("/").pop()).join(", ") });
      setTimeout(() => { if (this._note) this._note.textContent = ""; }, 15000);
    }
    if (!clips.length) return;
    // Testa e collo: la posizione la decide la card (inclinazioni per stato, sguardo verso di te); della clip si
    // aggiungono solo i movimenti (cenni, scosse, sguardi), cioè la rotazione rispetto al primo fotogramma.
    // Con clip_head: true invece la testa la muove tutta la clip.
    const headNames = ["neck", "head"].map(n => vrm.humanoid.getNormalizedBoneNode(n)).filter(Boolean).map(n => n.name);
    if (!this._config.clip_head) for (const c of clips) {
      c.userData = c.userData || {};
      c.userData.headBase = {};
      for (const t of c.tracks) {
        const [node, prop] = t.name.split(".");
        if (prop === "quaternion" && headNames.includes(node))
          c.userData.headBase[node] = new this._THREE.Quaternion().fromArray(t.values, 0).invert();
      }
    }
    // Ossa da mescolare tra posa procedurale e clip (occhi esclusi: li muove lo sguardo)
    const nodes = Object.keys(vrm.humanoid.humanBones)
      .filter(n => !["leftEye", "rightEye", "jaw"].includes(n))
      .map(n => vrm.humanoid.getNormalizedBoneNode(n)).filter(Boolean);
    const pose = () => nodes.map(n => ({ q: n.quaternion.clone(), p: n.position.clone() }));
    // layers: strati che sfumano uno sopra l'altro, sopra la posa procedurale (vedi _applyClips)
    // Ossa della schiena (per tenere dritta la testa quando la clip piega il busto) e collo
    const idx = b => nodes.indexOf(vrm.humanoid.getNormalizedBoneNode(b));
    const spine = ["hips", "spine", "chest", "upperChest"].map(idx).filter(i => i >= 0);
    const additive = this._config.clip_head ? [] : headNames.map(n => nodes.findIndex(x => x.name === n)).filter(i => i >= 0);
    // Ossa di ciascun braccio (con le dita), per far vincere la posa dell'atteggiamento sulle clip "calme"
    const armOf = side => nodes.map((n, i) => [n, i]).filter(([n]) => { const hb = Object.keys(vrm.humanoid.humanBones).find(b => vrm.humanoid.getNormalizedBoneNode(b) === n);
      return hb && hb.startsWith(side) && /Shoulder|Arm|Hand|Thumb|Index|Middle|Ring|Little/.test(hb); }).map(([, i]) => i);
    const arms = { L: armOf("left"), R: armOf("right") };
    this._anim = { groups: clipGroups, nodes, rest: nodes.map(n => n.position.clone()), proc: pose(), out: pose(), tmp: pose(), layers: [], state: null, additive, arms,
      spine, neck: this._config.clip_head ? -1 : idx("neck"), qa: new this._THREE.Quaternion(), qb: new this._THREE.Quaternion() };
  }

  // Clip per una chiave (stato o "gesti") nell'atteggiamento corrente; null se non ce ne sono
  _clipList(key) {
    const G = this._anim && this._anim.groups;
    if (!G) return null;
    // prima l'umore (v1.6, es. animations.triste.riposo), poi l'atteggiamento, poi le clip per tutti
    const mood = this._mood && G[this._mood] && G[this._mood][key];
    const own = G[this._persName] && G[this._persName][key];
    return mood || own || (G.tutti && G.tutti[key]) || null;
  }

  // Aggiunge in cima uno strato: una clip (once = una volta sola), oppure (clip = null) il ritorno alla posa procedurale
  _pushLayer(key, clip, once) {
    const A = this._anim, THREE = this._THREE;
    const layer = { key, clip, w: 0 };
    if (clip) {
      layer.mixer = new THREE.AnimationMixer(this._vrm.scene);
      layer.action = layer.mixer.clipAction(clip);
      if (once) { layer.action.setLoop(THREE.LoopOnce, 1); layer.action.clampWhenFinished = true; }
      if (key === "ascolta") layer.action.timeScale = 0.7; // cenni più lenti e calmi
      layer.action.play();
    }
    A.layers.push(layer);
    A.key = key;
  }

  _pickClip(list) {
    const top = this._anim.layers[this._anim.layers.length - 1];
    const choices = list.length > 1 && top ? list.filter(c => c !== top.clip) : list;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  _dropLayer(layer) {
    if (layer.mixer) { layer.action.stop(); layer.mixer.uncacheRoot(this._vrm.scene); }
  }

  // Mescola la posa procedurale (già scritta nelle ossa) con le clip, strato per strato
  _applyClips(state, dt) {
    const A = this._anim;
    if (!A) return;
    const N = A.nodes, top = A.layers[A.layers.length - 1], I = this._idle;
    // Che cosa deve andare: un gesto-clip in corso a riposo, oppure le clip (o la posa procedurale) dello stato
    const gest = state === "riposo" && I.g && I.g.clip && this._t < I.until;
    const key = gest ? `gesto:${I.t0}` : state;
    if (A.key !== key) {
      if (gest) this._pushLayer(key, I.g.clip, true);
      else { const list = this._clipList(state); this._pushLayer(key, list ? this._pickClip(list) : null, list && list.length > 1); }
    } else if (!gest && top && top.clip && top.w >= 1 && top.action.time >= top.clip.duration - FADE) {
      // Più clip per lo stesso stato: ognuna va una volta sola, poi ne parte un'altra a caso
      const list = this._clipList(state);
      if (list && list.length > 1) this._pushLayer(key, this._pickClip(list), true);
    }
    if (!A.layers.length) return;

    for (let i = 0; i < N.length; i++) { A.proc[i].q.copy(N[i].quaternion); A.proc[i].p.copy(N[i].position); A.out[i].q.copy(N[i].quaternion); A.out[i].p.copy(N[i].position); }
    for (const L of A.layers) {
      L.w = Math.min(1, L.w + dt / FADE);
      const w = L.w * L.w * (3 - 2 * L.w); // partenza e arrivo morbidi
      let src = A.proc;
      if (L.mixer) {
        // Le ossa che la clip non muove restano nella posa procedurale
        for (let i = 0; i < N.length; i++) { N[i].quaternion.copy(A.proc[i].q); N[i].position.copy(A.proc[i].p); }
        L.mixer.update(dt);
        for (let i = 0; i < N.length; i++) { A.tmp[i].q.copy(N[i].quaternion); A.tmp[i].p.copy(N[i].position); }
        // Testa e collo: posa procedurale + movimento della clip rispetto al suo primo fotogramma
        const base = L.clip.userData && L.clip.userData.headBase;
        if (base) for (const i of A.additive) {
          const b0 = base[N[i].name];
          if (b0) {
            // movimento della clip rispetto al suo primo fotogramma (collo e testa): cenni e sguardi sì, ma non la
            // testa china di alcune clip (briefcase-idle e looking-around guardavano in basso di ~30–40°)
            // limiti per direzione (radianti, per osso): girarsi a destra/sinistra sì, chinare o alzare la testa poco
            const d = A.tmp[i].q.premultiply(b0), e = A.eul || (A.eul = new this._THREE.Euler(0, 0, 0, "YXZ"));
            e.setFromQuaternion(d, "YXZ");
            const lim = (x, m) => Math.max(-m, Math.min(m, x));
            // su/giù: la parte lenta (testa che resta china) si limita a ±0,06; la parte veloce (cenni) passa fino a ±0,14
            const avg = A.pitchAvg || (A.pitchAvg = {}), k = N[i].name;
            avg[k] = avg[k] === undefined ? e.x : avg[k] + (e.x - avg[k]) * Math.min(1, dt * 1.2);
            // in ascolto e mentre parla i movimenti di testa delle clip sono più piccoli (scatti; le Talking chinavano la
            // testa fino a 26°), e la testa non va mai più giù di ~4° per osso: il personaggio ti guarda mentre parla
            const g = L.key === "ascolta" ? 0.45 : L.key === "parla" ? 0.4 : 1;
            const pitch = (lim(avg[k], 0.06) + lim(e.x - avg[k], 0.14)) * g;
            e.set(L.key === "parla" ? Math.min(pitch, 0.035) : pitch, lim(e.y, 0.15) * g, lim(e.z, 0.1) * g, "YXZ");
            d.setFromEuler(e).premultiply(A.proc[i].q);
          }
        }
        // Clip con braccia calme (riposo, cenni): se l'atteggiamento o un gesto ha una posa sua per un braccio, vince quella
        if (L.clip.userData && L.clip.userData.calm && L.clip.userData.calm.braccia && this._armOv)
          for (const X of ["L", "R"]) { const w = this._armOv[X]; if (w > 0) for (const i of A.arms[X]) A.tmp[i].q.slerp(A.proc[i].q, w); }
        src = A.tmp;
      }
      for (let i = 0; i < N.length; i++) { A.out[i].q.slerp(src[i].q, w); A.out[i].p.lerp(src[i].p, w); }
    }
    // Quando lo strato in cima è del tutto visibile, quelli sotto non servono più
    const last = A.layers[A.layers.length - 1];
    if (last.w >= 1) {
      A.layers.slice(0, -1).forEach(L => this._dropLayer(L));
      A.layers = last.clip ? [last] : [];
    }
    // Il corpo non si gira troppo: le clip (looking-around, talking) ruotavano bacino e schiena fino a ~90° e il personaggio
    // dava le spalle. Rotazione verso destra/sinistra limitata: bacino ±0,15 rad, ogni osso della schiena ±0,05 rad, testa e collo ±0,15.
    {
      const e = A.eulB || (A.eulB = new this._THREE.Euler(0, 0, 0, "YXZ"));
      A.spine.forEach((i, n) => {
        e.setFromQuaternion(A.out[i].q, "YXZ");
        const m = n === 0 ? 0.15 : 0.05;
        if (Math.abs(e.y) > m) { e.y = Math.sign(e.y) * m; A.out[i].q.setFromEuler(e); }
      });
    }
    // Testa gestita dalla card: il collo compensa (all'85%) quanto la clip ha piegato o girato la schiena,
    // così la testa resta orientata come nella posa procedurale e il personaggio continua a guardare avanti
    // (con body: clip no: con le clip Mixamo chinava la testa di ~20° in più invece di raddrizzarla, misurato in v1.0.6)
    if (A.neck >= 0 && !this._pure) {
      A.qa.identity(); A.qb.identity();
      for (const i of A.spine) { A.qa.multiply(A.out[i].q); A.qb.multiply(A.proc[i].q); }
      const neck = A.out[A.neck].q, fixed = A.qa.invert().multiply(A.qb).multiply(neck);
      neck.slerp(fixed, 0.85);
    }
    for (let i = 0; i < N.length; i++) { N[i].quaternion.copy(A.out[i].q); N[i].position.copy(A.out[i].p); }
  }

  // Carica un modello (indirizzo o ArrayBuffer): taratura delle braccia, forme del viso, inquadratura
  async _loadModel(src) {
    const { THREE, GLTFLoader, VRMLoaderPlugin, VRMUtils } = this._L, scene = this._scene;
    const loader = new GLTFLoader();
    loader.register(p => new VRMLoaderPlugin(p));
    // src: indirizzo del file, oppure i dati già letti (ArrayBuffer, per esempio da un file scelto nella pagina di prova)
    const gltf = await new Promise((res, rej) => {
      const fail = e => rej(new Error((e && e.target && e.target.status === 404) ? "404" : (e && e.message) || "errore di rete"));
      if (src instanceof ArrayBuffer) loader.parse(src, "", res, fail);
      else loader.load(src, res, undefined, fail);
    });
    const vrm = gltf.userData.vrm;
    if (!vrm) throw new Error("il file non è un modello VRM");
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    if (VRMUtils.combineSkeletons) VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse(o => { o.frustumCulled = false; });
    // Il modello nuovo si prepara tutto prima di sostituire il vecchio, che intanto resta visibile
    const old = this._vrm;

    // Forme del viso VRoid (sorriso a bocca chiusa, sopracciglia), se il modello le ha
    this._morphs = [];
    vrm.scene.traverse(o => { if (o.isMesh && o.morphTargetDictionary) this._morphs.push(o); });
    // VRoid mette i nomi delle forme nei "primitive" del glTF: three.js allora numera le forme (0, 1, 2…)
    // e i nomi restano in geometry.userData.targetNames. Si ricostruisce l'elenco con i nomi veri.
    for (const m of this._morphs) {
      const names = m.geometry && m.geometry.userData && m.geometry.userData.targetNames;
      if (Array.isArray(names) && names.length === m.morphTargetInfluences.length)
        names.forEach((name, i) => { m.morphTargetDictionary[name] = i; });
    }
    this._hasMorph = suffix => this._morphs.some(m => Object.keys(m.morphTargetDictionary).some(k => k.endsWith(suffix)));
    this._vroid = this._hasMorph("Fcl_MTH_Up");

    const B = n => vrm.humanoid.getNormalizedBoneNode(n);
    this._b = {};
    ["hips", "spine", "chest", "upperChest", "neck", "head", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm", "leftHand", "rightHand",
     "leftUpperLeg", "rightUpperLeg"].forEach(n => this._b[n] = B(n));
    this._hipsRest = this._b.hips.position.clone();
    // Dita (per chiudere la mano): falangi di indice, medio, anulare, mignolo
    this._fingers = {};
    for (const side of ["left", "right"]) this._fingers[side] = ["Index", "Middle", "Ring", "Little"]
      .flatMap(f => ["Proximal", "Intermediate", "Distal"].map(j => B(side + f + j))).filter(Boolean);

    // Taratura automatica: capisce da che parte girare braccia e gomiti per questo modello
    const world = n => { const o = vrm.humanoid.getRawBoneNode(n); const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };
    const settle = () => { vrm.humanoid.update(); vrm.scene.updateMatrixWorld(true); };
    this._sign = {};
    for (const side of ["left", "right"]) {
      const up = this._b[side + "UpperArm"], lo = this._b[side + "LowerArm"];
      if (!up) continue;
      let s = side === "left" ? -1 : 1;
      up.rotation.z = s * 1.2; settle();
      if (world(side + "Hand").y > world(side + "UpperArm").y) { s = -s; up.rotation.z = s * 1.2; settle(); }
      let e = side === "left" ? -1 : 1;
      if (lo) {
        lo.rotation.y = e * 0.8; settle();
        if (world(side + "Hand").z < world(side + "LowerArm").z) e = -e;
        lo.rotation.y = 0;
      }
      // Spalla in avanti (positivo = il braccio va verso la camera)
      up.rotation.set(0.5, 0, s * 1.5); settle();
      const f = world(side + "Hand").z > world(side + "UpperArm").z ? 1 : -1;
      // Rotazione del braccio su se stesso (positivo = col gomito piegato la mano va verso il centro del corpo)
      let w = 1;
      if (lo) {
        lo.rotation.y = e * 1.5;
        up.rotation.set(0, 0.5, s * 1.5); settle();
        const xa = Math.abs(world(side + "Hand").x - world("hips").x);
        up.rotation.set(0, -0.5, s * 1.5); settle();
        if (Math.abs(world(side + "Hand").x - world("hips").x) < xa) w = -1;
        lo.rotation.y = 0;
      }
      up.rotation.set(0, 0, s * 1.2);
      this._sign[side] = { arm: s, elb: e, fwd: f, tw: w };
    }
    settle();

    // Pose delle braccia ritarate sulle proporzioni di questo modello (mano al mento, braccia conserte, ecc.)
    const ARM_POSES = { pensa: POSES.pensa, ...ARMS };
    for (const [k, o] of Object.entries(ARM_ORIG)) Object.assign(ARM_POSES[k], o);
    try { calibrateArms(this, vrm, ARM_POSES, ARM_ORIG); } catch (e) { console.warn("vrm-assist-avatar-card: taratura braccia non riuscita", e); }
    // le pose degli atteggiamenti hanno una copia delle braccia: si aggiornano anche quelle
    for (const p of Object.values(PERSONALITIES)) for (const st of Object.values(p.pose || {})) {
      if (st._arms) Object.assign(st, pick(ARMS[st._arms]));
      if (st._armsR) for (const [k, v] of Object.entries(pick(ARMS[st._armsR]))) if (k.endsWith("R")) st[k] = v;
    }
    settle();

    // Inquadratura: zona da mostrare (alto, larghezza, altezza in metri); la distanza si adatta allo schermo
    // Punto più alto reale del modello (capelli compresi), non l'attaccatura della testa
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const head = world("head");
    const top = Math.max(box.max.y, head.y + 0.2) + 0.06;
    // Inquadratura a busto (unica: a figura intera le clip facevano sembrare il personaggio sospeso)
    const F = { w: 0.36, h: 0.6 };
    // Braccia conserte (serio): stanno sotto il petto e a 0,6 m restavano tagliate in basso nei riquadri larghi
    // e in verticale le mani uscivano dai lati (foto di Davide): in quella posa la zona da mostrare scende fino a 14 cm
    // sotto il petto (anche con maniche larghe) ed è larga 0,46 m
    const chest = vrm.humanoid.getRawBoneNode("chest") ? world("chest") : world("spine");
    // cima dei capelli rispetto alla testa, a riposo (per il cappello dei temi delle feste)
    this._headAnchor = measureHead(vrm, THREE);
    this._frame = { top, top0: top, ...F, h0: F.h, w0: F.w, low: Math.max(F.h, top - (chest.y - 0.14)), wide: 0.46, c: 0 };
    if (vrm.lookAt) vrm.lookAt.target = this._gaze;
    // Occhi disegnati per le facce buffe (solo modelli VRoid, che hanno la mesh EyeExtra)
    if (this._funny) this._funny.dispose();
    this._funny = setupFunny(vrm, THREE);

    // Piedi: posizione e orientamento a riposo (servono per tenerli fermi a terra), e altezza del pavimento
    this._feet = null;
    const NB = n => vrm.humanoid.getNormalizedBoneNode(n);
    if (["leftUpperLeg", "leftLowerLeg", "leftFoot", "rightUpperLeg", "rightLowerLeg", "rightFoot"].every(NB)) {
      this._feet = ["left", "right"].map(side => {
        const up = NB(side + "UpperLeg"), lo = NB(side + "LowerLeg"), ft = NB(side + "Foot");
        const P = o => o.getWorldPosition(new THREE.Vector3());
        return { up, lo, ft, rest: P(ft), restQ: ft.getWorldQuaternion(new THREE.Quaternion()),
                 l1: P(up).distanceTo(P(lo)), l2: P(lo).distanceTo(P(ft)), bend: 0 };
      });
    }
    this._ground = box.min.y;
    this._hipsRestWorld = vrm.humanoid.getNormalizedBoneNode("hips").getWorldPosition(new THREE.Vector3());
    if (this._shadow) { this._shadow.position.y = this._ground + 0.002; }

    // Sostituzione: via il modello vecchio (e le sue clip), dentro quello nuovo
    if (old) { scene.remove(old.scene); VRMUtils.deepDispose(old.scene); }
    this._anim = null;
    scene.add(vrm.scene);
    this._vrm = vrm; this._faceSlots = null;
    this._resize();
    // tema: il cappello era agganciato alla testa del modello vecchio; qui il nuovo è ancora a riposo
    this._applyTheme(true);

  }

  /** Modello chiesto da model_entity mentre non si poteva cambiare (primo caricamento o altro cambio in corso) */
  _applyWantedModel() {
    const i = this._wantModel;
    if (i === undefined || !this._vrm || this._swapping || this._loadingFirst) return;
    this._wantModel = undefined;
    if (i !== this._modelIdx) this.setModel(i);
  }

  /** Cambia modello: i = posizione in models, oppure { name, file } / { name, data: ArrayBuffer } */
  async setModel(i) {
    if (!this._vrm || this._swapping) return;
    const m = typeof i === "number" ? this._models[i] : i;
    if (!m) return;
    this._swapping = true; this._barSig = null; this._renderButtons();
    try {
      await this._loadModel(m.data || m.file);
      if (typeof i === "number") this._modelIdx = i;
      this._choosePersonality();   // ogni modello può avere il suo atteggiamento (models[].personality)
      this._animReady = this._loadAnimations();
      if (this._note) this._note.textContent = "";
    } catch (err) {
      console.error("vrm-assist-avatar-card", err);
      if (this._note) this._note.textContent = t("modelError", { name: m.name || "", err: err && err.message || err });
    } finally { this._swapping = false; this._barSig = null; this._renderButtons(); this._applyWantedModel(); }
  }

  _resize() {
    if (!this._renderer) return;
    const w = this._stage.clientWidth || 300, h = this._stage.clientHeight || 400;
    this._renderer.setSize(w, h, false);
    const cam = this._camera, F = this._frame, aspect = w / h;
    cam.aspect = aspect;
    const tv = Math.tan(cam.fov * Math.PI / 360), th = tv * aspect;
    const d = Math.max(F.h / 2 / tv, F.w / 2 / th) / (this._config.zoom || 1);
    const visH = 2 * d * tv;
    // headroom (m): spazio in più sopra la testa (app desktop: le braccia alzate non escono dalla finestra)
    const cy = F.top + (+this._config.headroom || 0) - visH / 2;
    cam.position.set(0, cy, d);
    this._camLook.set(0, cy, 0);
    cam.lookAt(this._camLook);
    cam.updateProjectionMatrix();
  }

  _loop() {
    if (!this._renderer || !this._running) return;
    const minDt = 1 / (this._config.fps || 30);
    this._renderer.setAnimationLoop(() => {
      if (document.hidden) return;
      const d = this._clock.getDelta();
      this._acc += d;
      if (this._acc < minDt * 0.95) return;
      const dt = Math.min(this._acc, 0.1); this._acc = 0;
      this._tick(dt);
      this._renderer.render(this._scene, this._camera);
    });
  }

  _expr(name, v) {
    const m = this._vrm.expressionManager;
    if (m && m.getExpression(name)) m.setValue(name, Math.max(0, Math.min(1, v)));
  }

  _morph(suffix, v) {
    v = Math.max(0, Math.min(1, v));
    for (const m of this._morphs) for (const k in m.morphTargetDictionary) if (k.endsWith(suffix)) m.morphTargetInfluences[m.morphTargetDictionary[k]] = v;
  }

  /** Clip "gesti" come gesti a riposo (peso 1,5 ciascuna); il viso lo decide clipFace (sbadiglio, stiracchiata…) */
  _clipGestures(group = "gesti") {
    // gesti: quelli dell'umore (v1.6, peso 2) si aggiungono a quelli dell'atteggiamento o di tutti, non li sostituiscono
    if (group === "gesti") {
      const G = this._anim && this._anim.groups;
      const mood = (G && this._mood && G[this._mood] && G[this._mood].gesti) || [];
      const base = (G && ((G[this._persName] && G[this._persName].gesti) || (G.tutti && G.tutti.gesti))) || [];
      return mood.map(clip => ({ name: clip.name, clip, weight: 2, apply: clipFace(clip.name) || (() => {}) }))
        .concat(base.map(clip => ({ name: clip.name, clip, weight: 1.5, apply: clipFace(clip.name) || (() => {}) })));
    }
    return (this._clipList(group) || []).map(clip => ({ name: clip.name, clip, weight: 1.5, apply: clipFace(clip.name) || (() => {}) }));
  }

  _tick(dt) {
    const t = (this._t += dt);
    // tema delle feste: animazione (pipistrelli, neve) e, con "automatico", controllo della data ogni minuto
    if (this._theme) this._theme.update(dt, t, this._camera);
    if (this._themePick === "auto" && t - (this._themeChecked || 0) > 60) this._applyTheme();
    const state = this._wanted();
    const pers = PERSONALITIES[this._persName];
    const T = { ...POSES[state], ...pers.pose[state] };
    const P = this._P, b = this._b, sg = this._sign;

    // Inquadratura più bassa e più larga mentre le braccia sono conserte (passaggio morbido, ~1 s)
    const F = this._frame;
    if (F && F.low && this._config.adaptive_frame !== false) {   // adaptive_frame: false = inquadratura fissa (app desktop)
      const I0 = this._idle, waving = I0.g && I0.g.faceGuard && t < I0.until;   // anche durante il saluto, che si vede di lato
      const want = T._arms === "crossed" || waving || T._ownArms ? 1 : 0, c0 = F.c || 0;   // e nel tifo
      let c = c0 + (want - c0) * (1 - Math.exp(-3 * dt));
      if (Math.abs(c - want) < 1e-3) c = want;
      if (c !== c0) { F.c = c; F.h = F.h0 + (F.low - F.h0) * c; F.w = F.w0 + (F.wide - F.w0) * c; this._resize(); }
    }

    // Gesti casuali a riposo, scelti tra quelli dell'atteggiamento (i più frequenti hanno weight più alto)
    const I = this._idle;
    if (state === "riposo") {
      if (t > I.next) {
        // Gesti dell'atteggiamento più le clip "gesti" (ognuna con peso 1,5), se ci sono
        // si gioca al PC: tifo (gesti, clip "tifo" e qualche faccia buffa entusiasta) al posto dei gesti normali
        const all = this._activity === "gioco"
          ? CHEER.concat(this._clipGestures("tifo"), FUNNY.filter(g => ["buffa-stelle", "buffa-strizza", "buffa-felice"].includes(g.name)).map(g => ({ ...g, weight: 0.6, funny: false })))
          : pers.gestures.concat(this._clipGestures(),
            // Halloween: ogni tanto la faccia da vampiro (canini), anche senza atteggiamento spiritoso
            this._theme && this._theme.vampire && !pers.gestures.some(g => g.name === "buffa-vampiro")
              ? FUNNY.filter(g => g.name === "buffa-vampiro").map(g => ({ ...g, weight: 0.7, funny: false })) : []);
        // facce buffe (spiritoso): se da 45 s non ne ha fatte, tocca a una di loro (con i gesti lunghi delle clip
        // passavano anche 2–3 minuti senza, e Davide pensava che non funzionassero)
        const fun = all.filter(g => g.funny), pool = fun.length && t - (I.lastFunny ?? 0) > 45 ? fun : all;
        let r = Math.random() * pool.reduce((a, g) => a + g.weight, 0);
        I.g = pool.find(g => (r -= g.weight) < 0) || pool[0];
        if (I.g.funny) I.lastFunny = t;
        I.t0 = t; I.until = t + (I.g.clip ? Math.max(1, I.g.clip.duration - FADE) : rnd(...I.g.dur));
        I.next = I.until + (this._activity === "gioco" ? rnd(1.5, 4) : rnd(...pers.every)); I.dir = Math.random() < 0.5 ? -1 : 1;
      }
      if (I.g && t < I.until) I.g.apply(T, (t - I.t0) / (I.until - I.t0), I.dir);
      // faccia buffa in corso (gesti di spiritoso): la applica la parte del viso, più sotto
    } else I.next = Math.max(I.next, t + 5);
    this._funnyNow = T.funny && T.funnyK > 0.02 ? { name: T.funny, k: T.funnyK } : null;

    // Pensiero: lo sguardo vaga in alto, da un lato all'altro (chi pensa non guarda l'interlocutore), la testa lo segue
    // un poco; ogni tanto un piccolo "mmh" con le labbra
    if (state === "pensa") {
      const Th = this._think || (this._think = { next: 0, side: 1, mmh: 0 });
      if (t > Th.next) { Th.side = Math.random() < 0.65 ? -Th.side : Th.side; Th.gy = rnd(0.12, 0.22); Th.next = t + rnd(1.8, 3.5); Th.mmh = Math.random() < 0.4 ? t + 0.6 : 0; }
      T.gx = 0.65 * Th.side; T.gy = Th.gy; T.headY = 0.08 * Th.side; T.headZ += 0.04 * Th.side;
      if (Th.mmh && t > Th.mmh && t < Th.mmh + 1) T.lips += 0.35 * Math.sin(Math.PI * (t - Th.mmh));
    }

    // Ascolto attivo: ogni 1,5–3 s la testa cambia un po' inclinazione e direzione, come chi ascolta davvero
    if (state === "ascolta") {
      const Li = this._listen || (this._listen = { next: 0, z: 0, y: 0 });
      if (t > Li.next) { Li.z = rnd(-0.06, 0.09); Li.y = rnd(-0.06, 0.06); Li.next = t + rnd(1.5, 3); }
      T.headZ += Li.z; T.headY += Li.y;
    }

    // Viso: reazioni ai cambi di stato (sorpresa quando inizia ad ascoltare, sorriso a fine risposta)
    if (state !== this._lastState) {
      if (state === "ascolta" && pers.listen) this._react = { f: pers.listen, t0: t, dur: 0.9 };
      else if (state === "riposo" && this._lastState === "parla" && pers.done)
        this._react = { f: pers.done, t0: t, dur: 2.6, wink: Math.random() < (pers.doneWink || 0) };
      this._lastState = state;
    }
    const R = this._react;
    if (R && t < R.t0 + R.dur) {
      const u = (t - R.t0) / R.dur, k = hold(u, 0.25);
      for (const f in R.f) T[f] += R.f[f] * k;
      if (R.wink) T.wink = Math.max(T.wink, pulse((u - 0.45) / 0.3));
    }
    // Viso: micro-espressioni a riposo
    const Mi = this._micro;
    if (state === "riposo" && pers.micro) {
      if (t > Mi.next) {
        Mi.g = pers.micro[Math.floor(Math.random() * pers.micro.length)];
        Mi.t0 = t; Mi.until = t + rnd(...Mi.g.dur); Mi.next = Mi.until + rnd(...pers.microEvery);
      }
      if (Mi.g && t < Mi.until) Mi.g.apply(T, (t - Mi.t0) / (Mi.until - Mi.t0), 1);
    } else Mi.next = Math.max(Mi.next, t + 3);

    // Azione chiesta da Home Assistant: parte appena il personaggio è a riposo (interrompe un gesto casuale in corso)
    const A = this._pendingAction;
    if (A) {
      if (t > A.until) this._pendingAction = null;
      else if (state === "riposo" && !(I.g && ACTIONS[I.g.name] && t < I.until)) { this._pendingAction = null; this._startAction(A.name); }
    }

    // Umore (sopra l'atteggiamento, in tutti gli stati)
    const md = MOODS[this._mood];
    if (md.mul) for (const k in md.mul) T[k] *= md.mul[k];
    if (md.add) for (const k in md.add) T[k] += md.add[k];

    // Se una clip muove già il corpo in questo stato, lo spostamento del peso e l'ondeggiamento calcolati si riducono
    // (sommati alla clip spingevano i fianchi troppo di lato e le gambe andavano in diagonale)
    if (this._anim && this._clipList(state)) { T.shift *= 0.35; T.sway *= 0.4; }
    for (const k in T) if (typeof T[k] === "number") P[k] = damp(P[k] ?? T[k], T[k], FAST[k] || 3.5, dt);

    // Con le clip attive: tutte le ossa ripartono dalla posa di riposo, così non resta niente della clip precedente
    if (this._anim) this._anim.nodes.forEach((n, i) => { n.quaternion.identity(); n.position.copy(this._anim.rest[i]); });

    // Corpo: respiro, oscillazione, postura
    const br = Math.sin(t * 2 * Math.PI * 0.23);
    // Peso su una gamba (shift): fianchi spostati di lato e inclinati, gambe che compensano per tenere i piedi a terra
    const roll = P.shift * 2;
    if (b.hips) {
      b.hips.rotation.y = nz(t * 0.5, 1) * 0.035 * P.sway;
      b.hips.rotation.z = nz(t * 0.4, 2) * 0.018 * P.sway + roll;
      b.hips.position.set(this._hipsRest.x + P.shift, this._hipsRest.y - Math.abs(P.shift) * 0.3, this._hipsRest.z);
    }
    for (const leg of [b.leftUpperLeg, b.rightUpperLeg]) if (leg) leg.rotation.set(0, 0, -roll - P.shift / 0.85);
    // lean positivo = busto in avanti (fino alla v1.0.4 il segno era invertito e il personaggio si tirava indietro)
    if (b.spine) { b.spine.rotation.x = -P.lean * 0.5 + br * 0.012; b.spine.rotation.z = -(b.hips ? b.hips.rotation.z : 0) * 0.7; }
    if (b.chest) b.chest.rotation.x = -P.lean * 0.5 + br * 0.018;
    if (b.upperChest) b.upperChest.rotation.x = br * 0.01;

    // Testa
    const nod = P.speak * P.nod * (Math.sin(t * 5.3) * 0.5 + Math.sin(t * 3.1 + 1) * 0.5) * 0.045;
    const en = P.energy;
    // tremble (impaurito): tremito piccolo e veloce della testa, sopra tutto il resto
    const tr = P.tremble || 0;
    const hx = P.headX + nz(t * 0.6, 3) * 0.03 * en + nod + tr * 0.012 * Math.sin(t * 31),
      hy = P.headY + nz(t * 0.45, 4) * 0.06 * en + tr * 0.015 * Math.sin(t * 23 + 1),
      hz = P.headZ + nz(t * 0.5, 5) * 0.025 * en + tr * 0.01 * Math.sin(t * 41 + 2);
    if (b.neck) b.neck.rotation.set(hx * 0.4, hy * 0.4, hz * 0.4);
    if (b.head) b.head.rotation.set(hx * 0.6, hy * 0.6, hz * 0.6);

    // Braccia
    const gest = P.speak * P.gest * (0.22 + 0.18 * Math.sin(t * 1.9)), gestL = P.speak * P.gest * (0.12 + 0.12 * Math.sin(t * 1.3 + 2));
    // arm = abbassa dalla T-pose, fwd = porta avanti, tw = ruota su se stesso, elb = piega il gomito, wr = piega il polso
    for (const [side, X, g] of [["left", "L", gestL], ["right", "R", gest]]) {
      const s = sg[side]; if (!s) continue;
      b[side + "UpperArm"].rotation.set(s.fwd * P["fwd" + X], s.tw * P["tw" + X], s.arm * (P["arm" + X] + br * 0.015));
      if (b[side + "LowerArm"]) b[side + "LowerArm"].rotation.set(0, s.elb * (P["elb" + X] + g), 0);
      if (b[side + "Hand"]) b[side + "Hand"].rotation.set(0, 0, s.arm * P["wr" + X]);
      // Dita: si piegano nello stesso verso in cui si abbassa il braccio dalla T-pose (palmo in giù)
      for (const f of this._fingers[side]) f.rotation.set(0, 0, s.arm * P["fist" + X] * 1.2);
    }

    // Quanto le braccia della posa si allontanano da quelle "normali" dello stato (atteggiamento, gesti, azioni):
    // 0 = usa le braccia della clip, 1 = usa la posa calcolata
    // Con body: clip le braccia restano alla clip, tranne in "pensa": la mano al mento (richiesta di Davide) vince sempre
    // (e nei gesti del tifo, _ownArms: entrano e escono sfumando in ~0,4 s)
    this._own = damp(this._own || 0, T._ownArms ? 1 : 0, 6, dt);
    const own = this._pure && state !== "pensa" && this._own > 0.01;
    const base = this._pure ? (state === "pensa" || own ? POSES.riposo : null) : POSES[state];
    this._armOv = { L: 0, R: 0 };
    for (const X of ["L", "R"]) {
      if (!base) break;
      let m = 0;
      for (const k of ["arm", "fwd", "tw", "elb", "wr"]) m = Math.max(m, Math.abs(P[k + X] - base[k + X]));
      this._armOv[X] = Math.min(1, m / 0.2) * (own ? this._own : 1);
    }
    this._applyClips(state, dt);

    // Sguardo
    this._gazeOff.x = damp(this._gazeOff.x, P.gx + nz(t * 0.3, 6) * 0.04 * en, 4, dt);
    this._gazeOff.y = damp(this._gazeOff.y, P.gy + nz(t * 0.3, 7) * 0.03 * en, 4, dt);
    // Gli occhi seguono la testa (si guarda intorno): punto davanti al viso, un po' oltre la direzione della testa
    if (P.gazeHead > 0.01) {
      const T3 = this._THREE, NB = n => this._vrm.humanoid.getNormalizedBoneNode(n), hd = NB("head"), ch = NB("chest") || NB("spine");
      const V = this._v4 || (this._v4 = { p: new T3.Vector3(), f: new T3.Vector3(), c: new T3.Vector3(), q: new T3.Quaternion() });
      hd.getWorldPosition(V.p); hd.getWorldQuaternion(V.q);
      V.f.set(0, 0, 1).applyQuaternion(V.q);
      ch.getWorldQuaternion(V.q); V.c.set(0, 0, 1).applyQuaternion(V.q);
      V.f.addScaledVector(V.f.clone().sub(V.c), 0.7).normalize();   // gli occhi vanno un po' oltre la testa (la anticipano)
      const D = this._camera.position.distanceTo(V.p);
      V.p.addScaledVector(V.f, D).sub(this._camera.position);
      this._gazeOff.x += (V.p.x - this._gazeOff.x) * P.gazeHead; this._gazeOff.y += (V.p.y - this._gazeOff.y) * P.gazeHead;
    }
    // Piccoli scatti degli occhi (saccadi): gli occhi veri saltano da un punto all'altro, non scivolano
    const Sc = this._sacc;
    // dart (impaurito): lo sguardo salta più lontano e più spesso, come chi si guarda attorno spaventato
    if (t > Sc.next) { const k = (state === "ascolta" ? 0.4 : 1) * (1 + 2.5 * (P.dart || 0)); Sc.x = rnd(-0.03, 0.03) * en * k; Sc.y = rnd(-0.018, 0.018) * en * k; Sc.next = t + rnd(0.4, 2.2) / (1 + 2 * (P.dart || 0)); }
    Sc.ox = damp(Sc.ox, Sc.x, 30, dt); Sc.oy = damp(Sc.oy, Sc.y, 30, dt);
    this._gaze.position.copy(this._camera.position).add(this._gazeOff);
    this._gaze.position.x += Sc.ox; this._gaze.position.y += Sc.oy;

    // Palpebre
    const Bk = this._blink; let blink = 0;
    if (t > Bk.next && Bk.t < 0) Bk.t = 0;
    if (Bk.t >= 0) {
      Bk.t += dt; const d = 0.16;
      blink = Bk.t < d ? Math.sin((Bk.t / d) * Math.PI) : 0;
      if (Bk.t >= d) { if (!Bk.double && Math.random() < 0.2) { Bk.double = true; Bk.t = -1; Bk.next = t + 0.12; } else { Bk.double = false; Bk.t = -1; Bk.next = t + rnd(2, 5.5); } }
    }

    // Bocca mentre parla (la voce esce dal Voice PE, quindi il movimento è generico ma imita il parlato italiano):
    // frasi di 4–12 sillabe con brevi pause; ogni sillaba ~0,13–0,22 s = consonante (bocca quasi chiusa) + vocale.
    // Vocali con la frequenza dell'italiano; "i" ed "e" più chiuse (aperte mostrano la striscia dei denti).
    const S = this._syl, M = this._mouth;
    if (P.speak > 0.05 && t >= S.end) {
      if (S.left <= 0 && !S.pause) {                       // fine frase: pausa
        S.pause = true; S.amp = 0; S.t0 = t; S.dur = rnd(0.22, 0.55); S.end = t + S.dur;
      } else {
        if (S.pause) { S.pause = false; S.left = Math.floor(rnd(4, 13)); S.phrase = rnd(0.8, 1.1); }
        const r = Math.random();
        S.v = r < 0.28 ? "aa" : r < 0.52 ? "ee" : r < 0.70 ? "ih" : r < 0.90 ? "oh" : "ou";
        const max = { aa: 0.6, oh: 0.5, ou: 0.45, ee: 0.45, ih: 0.4 }[S.v];
        S.left--;
        S.amp = max * S.phrase * rnd(0.7, 1) * (S.left === 0 ? 0.75 : 1);   // l'ultima sillaba della frase cala
        S.closed = Math.random() < 0.2;                                       // m, p, b: labbra chiuse del tutto
        S.t0 = t; S.dur = rnd(0.13, 0.22); S.end = t + S.dur;
      }
    } else if (P.speak <= 0.05) { S.pause = true; S.left = 0; S.amp = 0; }
    // Forma della sillaba: attacco della consonante (bocca quasi chiusa), poi la vocale che si apre e cala verso la successiva
    const u = S.dur ? Math.min(1, (t - S.t0) / S.dur) : 1;
    const shape = S.pause ? 0 : u < 0.25 ? (S.closed ? 0 : 0.2) + (u / 0.25) * (S.closed ? 0.6 : 0.5) : u < 0.6 ? 0.75 + (u - 0.25) / 0.35 * 0.25 : 1 - (u - 0.6) / 0.4 * 0.45;
    // ogni vocale è un misto di forme VRoid: da sole "a", "e" e "i" mostrano la striscia dei denti e sembrano una smorfia
    const MIX = { aa: { aa: 0.75, oh: 0.45 }, oh: { oh: 1 }, ou: { ou: 1 }, ee: { ee: 0.6, aa: 0.45 }, ih: { ih: 0.5, aa: 0.5 } }[S.v];
    for (const v in M) M[v] = damp(M[v], (MIX[v] || 0) * S.amp * shape * P.speak, 24, dt);

    if (this._vroid) {
      // Espressioni disegnate da VRoid, prese per parti (occhi, sopracciglia, bocca) e solo nelle versioni a bocca chiusa:
      // smile = "Fun" (sorriso dolce), eyeSmile = occhi e sopracciglia di "Joy" con la bocca di "Fun" (sorriso ampio),
      // focus = occhi e sopracciglia di "Angry" (concentrato), surprise = occhi e sopracciglia di "Surprised",
      // sad = "Sorrow" completa. Gli occhi si spengono durante il battito delle palpebre.
      // Ogni fotogramma il viso riparte da zero: senza, le forme dell'umore non usate dalle altre parti restavano
      // bloccate (sorpreso → neutro lasciava la bocca aperta)
      if (!this._faceSlots) {
        this._faceSlots = [];
        for (const m of this._morphs) for (const k in m.morphTargetDictionary)
          if (/Fcl_(EYE|BRW|MTH|ALL)_/.test(k) && !/Fcl_MTH_[AIUEO]$/.test(k)) this._faceSlots.push([m, m.morphTargetDictionary[k], k]);
        // Forme legate a un'espressione VRM (occhi chiusi = blink, Fcl_ALL_* = joy/sorrow/…): vrm.update le rimette a 0
        // prima di applicare le espressioni, quindi i valori scritti qui sparivano (sleepy e "Close" non chiudevano gli
        // occhi). Dopo vrm.update si rimette il valore della card, se più alto.
        const bound = new Set();
        for (const e of (this._vrm.expressionManager && this._vrm.expressionManager.expressions) || [])
          for (const b of e._binds || []) if (b.primitives) for (const pm of b.primitives) bound.add(pm.uuid + ":" + b.index);
        this._faceBound = this._faceSlots.filter(([m, i]) => bound.has(m.uuid + ":" + i)).map(([m, i]) => [m, i, 0]);
      }
      for (const [m, i] of this._faceSlots) m.morphTargetInfluences[i] = 0;
      const open = 1 - blink, talk = 1 - P.speak * 0.85;
      const joy = P.eyeSmile, fun = P.smile, sad = P.sad;
      this._morph("Fcl_MTH_Fun", Math.max(fun, joy) * talk);
      this._morph("Fcl_EYE_Fun", fun * 0.7 * open);
      this._morph("Fcl_EYE_Joy", joy * 0.75 * open);
      this._morph("Fcl_BRW_Fun", fun * 0.8 + Math.max(0, P.brow));
      this._morph("Fcl_BRW_Joy", joy);
      this._morph("Fcl_BRW_Sorrow", Math.max(0, -P.brow) * 0.6);
      this._morph("Fcl_EYE_Angry", P.focus * 0.5 * open);
      this._morph("Fcl_BRW_Angry", P.focus);
      this._morph("Fcl_EYE_Surprised", P.surprise * 0.65 * open);
      this._morph("Fcl_BRW_Surprised", P.surprise * 0.8);
      this._morph("Fcl_ALL_Sorrow", sad);
      this._morph("Fcl_EYE_Close", P.sleepy * open);
      this._morph("Fcl_MTH_Small", P.lips * (1 - P.speak));
      this._morph("Fcl_MTH_Down", P.frown * (1 - P.speak));
      // Umore: espressioni complete di VRoid che sfumano lentamente da un umore all'altro.
      // Le parti piccole qui sopra si attenuano quando l'umore è forte (non si sommano due espressioni diverse);
      // la bocca dell'umore cala mentre parla, così si vedono le sillabe.
      const MF = this._moodFace || (this._moodFace = {}), face = MOODS[this._mood].face || {};
      const want = {};
      for (const [x, v] of Object.entries(face)) {
        if (x === "Close") { want.Fcl_EYE_Close = v; continue; }
        want[`Fcl_EYE_${x}`] = v[0]; want[`Fcl_BRW_${x}`] = v[1]; want[`Fcl_MTH_${x}`] = v[2];
      }
      let strength = 0;
      for (const k of new Set([...Object.keys(MF), ...Object.keys(want)])) { MF[k] = damp(MF[k] || 0, want[k] || 0, 3, dt); strength = Math.max(strength, MF[k]); }
      if (strength > 0.01) for (const m of this._morphs) for (const k in m.morphTargetDictionary) {
        if (!k.includes("Fcl_EYE_") && !k.includes("Fcl_BRW_") && !k.includes("Fcl_MTH_") && !k.includes("Fcl_ALL_")) continue;
        if (/Fcl_MTH_[AIUEO]$/.test(k)) continue; // vocali gestite dalle espressioni aa/ih/ou/ee/oh
        const i = m.morphTargetDictionary[k], key = k.slice(k.indexOf("Fcl_"));
        const mood = MF[key] || 0, part = key.startsWith("Fcl_MTH") ? talk * 1.0 : key.startsWith("Fcl_EYE") ? open : 1;
        m.morphTargetInfluences[i] = Math.min(1, m.morphTargetInfluences[i] * (1 - strength * 0.8) + mood * (key.startsWith("Fcl_MTH") ? 1 - P.speak * 0.75 : part));
      }
      // Faccia buffa: occhi disegnati al posto di quelli veri (scatto a metà del gesto, come negli anime) e forme
      // del viso piene; bocca e sopracciglia dell'atteggiamento si spengono per non sommarsi
      this._morph("Fcl_HA_Fung1", 0);
      const FN = this._funnyNow, FD = FN && FACES[FN.name];
      if (FD) {
        const k = Math.min(1, FN.k * 1.5);
        for (const [m, i, key] of this._faceSlots) {
          if (/Fcl_(MTH|BRW)_/.test(key) || (FD.eyes && /Fcl_EYE_/.test(key))) m.morphTargetInfluences[i] *= 1 - k;
        }
        for (const [key, v] of Object.entries(FD.face || {})) this._morph(key, v * k);
      }
      if (this._funny) {
        // l'espressione VRoid "extra" accende i riquadri e nasconde gli occhi veri (e ogni fotogramma riscrive quelle
        // forme: impostarle a mano non basta); senza l'espressione, le forme si scrivono direttamente
        // (in VRM 0 il nome è "Extra", con la maiuscola)
        const on = !!(FD && FD.eyes && FN.k > 0.5), em = this._vrm.expressionManager;
        const ex = em && em.expressions.find(e => /^extra$/i.test(e.expressionName));
        if (on) this._funny.draw(FN.name);
        if (ex) em.setValue(ex.expressionName, on ? 1 : 0);
        else { this._funny.show(on ? 1 : 0); if (on) this._morph("Fcl_EYE_Extra", 1); }
      }
    } else {
      // Modelli non VRoid: solo le espressioni standard VRM, più leggere (possono aprire la bocca)
      this._expr("relaxed", P.smile * 0.5);
      this._expr("happy", P.eyeSmile * 0.4);
      this._expr("surprised", P.surprise * 0.4);
      this._expr("angry", P.focus * 0.3);
      const face = MOODS[this._mood].face || {}, f = x => (face[x] ? Math.max(...face[x]) : 0);
      this._expr("sad", Math.max(P.sad, f("Sorrow")));
      if (face.Joy) this._expr("happy", f("Joy") * 0.7);
      if (face.Surprised) this._expr("surprised", f("Surprised") * 0.7);
      if (face.Angry) this._expr("angry", f("Angry") * 0.7);
    }
    this._expr("blink", blink);
    this._expr("blinkLeft", P.wink * (1 - blink));
    // gape = bocca spalancata (sbadiglio): "o" grande più un po' di "a"
    for (const v in M) this._expr(v, v === "ou" ? Math.max(M[v], P.whistle * 0.55) : v === "aa" ? Math.max(M[v], P.part * 0.07, P.gape * 0.5)
      : v === "oh" ? Math.max(M[v], P.gape * 0.9) : M[v]);

    const clipBody = this._pure && this._anim && this._anim.layers.some(l => l.clip);
    if (!clipBody) this._lockFeet();
    else this._groundFeet();   // corpo dalle clip: la posa resta, ma il piede più basso tocca sempre il pavimento
    // Balli e tifo (v1.6): molti balli si accovacciano o saltano e a busto il personaggio usciva dall'inquadratura;
    // il bacino non scende più di 5 cm e non sale più di 8 rispetto a riposo (le gambe sotto non si vedono)
    const Ig = this._idle.g;
    if (this._anim && Ig && Ig.clip && (Ig.name === "balla" || /clapping|happy-hand/.test(Ig.clip.name)) && t < this._idle.until && this._hipsRestWorld) {
      const hips = this._b.hips, v = this._v6 || (this._v6 = new this._THREE.Vector3());
      hips.updateWorldMatrix(true, false); hips.getWorldPosition(v);
      const dy = v.y - this._hipsRestWorld.y, c = Math.max(-0.05, Math.min(0.08, dy));
      if (c !== dy) hips.position.y += c - dy;   // il genitore dei fianchi non è ruotato: y del mondo = y locale
    }
    this._keepHandsOut();
    if (this._idle.g && this._idle.g.faceGuard && this._t < this._idle.until) this._keepHandsOffFace();
    const FB = this._vroid && this._faceBound;
    if (FB) for (const f of FB) f[2] = f[0].morphTargetInfluences[f[1]];
    this._vrm.update(dt);
    if (this._theme && this._theme.sync) this._theme.sync();   // maschera dei capelli dove sta il cappello adesso
    if (FB) for (const [m, i, v] of FB) if (v > m.morphTargetInfluences[i]) m.morphTargetInfluences[i] = Math.min(1, v);
  }

  // Appoggio a terra: le clip Mixamo sono fatte per un manichino con proporzioni diverse e lasciano il bacino
  // un po' troppo alto (il personaggio "galleggiava" di 1–3,5 cm): si sposta il bacino perché il piede più basso tocchi terra
  _groundFeet() {
    const F = this._feet;
    if (!F) return;
    const hips = this._b.hips, v = this._v3 || (this._v3 = new this._THREE.Vector3());
    hips.updateWorldMatrix(true, true);
    const low = Math.min(...F.map(L => L.ft.getWorldPosition(v).y));
    const diff = low - F[0].rest.y;
    hips.position.y -= diff;   // il genitore dei fianchi non è ruotato in verticale: y del mondo = y locale
  }

  // Mani fuori dalle cosce: se una mano entra nella gamba, il braccio si apre quanto basta (ruotando la spalla)
  _keepHandsOut() {
    const F = this._feet, T3 = this._THREE;
    if (!F) return;
    const v = this._v2 || (this._v2 = { h: new T3.Vector3(), a: new T3.Vector3(), b: new T3.Vector3(), s: new T3.Vector3(), q: new T3.Quaternion(), q2: new T3.Quaternion() });
    const NB = n => this._vrm.humanoid.getNormalizedBoneNode(n);
    ["left", "right"].forEach((side, k) => {
      const up = NB(side + "UpperArm"), hand = NB(side + "Hand"), leg = F[k];
      if (!up || !hand) return;
      for (let it = 0; it < 3; it++) {
        up.updateWorldMatrix(true, true);
        hand.getWorldPosition(v.h);
        // distanza della mano dall'asse della coscia (segmento anca-ginocchio), sul piano orizzontale
        leg.up.getWorldPosition(v.a); leg.lo.getWorldPosition(v.b);
        const t = Math.min(1, Math.max(0, (v.h.y - v.a.y) / (v.b.y - v.a.y || -1)));
        const cx = v.a.x + (v.b.x - v.a.x) * t, cz = v.a.z + (v.b.z - v.a.z) * t;
        const dx = v.h.x - cx, dz = v.h.z - cz, dist = Math.hypot(dx, dz), R = 0.11;
        // gomito contro il busto: distanza dal centro della schiena (asse fianchi-petto) alla stessa altezza
        const elbow = NB(side + "LowerArm").getWorldPosition(v.s), chest = (this._b.upperChest || this._b.chest).getWorldPosition(v.b);
        const pen = Math.max(v.h.y > v.a.y + 0.05 ? 0 : R - dist, 0.165 - Math.hypot(elbow.x - chest.x, elbow.z - chest.z));
        if (pen <= 0.002) break;
        // apre il braccio verso l'esterno: rotazione nel mondo attorno all'asse avanti-indietro, centrata sulla spalla
        up.getWorldPosition(v.s);
        const out = Math.sign(dx || (v.h.x - this._hipsRestWorld.x)) || 1;
        const len = v.s.distanceTo(v.h) || 0.5, ang = (pen / len) * 1.1;
        v.q.setFromAxisAngle(v.b.set(0, 0, 1), out * ang * Math.sign(v.s.y - v.h.y));
        up.parent.getWorldQuaternion(v.q2);
        const upW = up.getWorldQuaternion(new T3.Quaternion());
        up.quaternion.copy(v.q2.clone().invert().multiply(v.q).multiply(upW));
      }
    });
  }

  // Mano lontana dal viso (azioni con clip): nel saluto di Mixamo la mano oscilla e due volte passa davanti alla faccia
  // (a 1 cm dal centro, misurato). Se la mano è davanti al viso, il braccio ruota attorno alla verticale della spalla
  // quanto basta a portare la punta delle dita di lato (13 cm dal centro della testa).
  _keepHandsOffFace() {
    const T3 = this._THREE, NB = n => this._vrm.humanoid.getNormalizedBoneNode(n);
    const v = this._v5 || (this._v5 = { h: new T3.Vector3(), s: new T3.Vector3(), c: new T3.Vector3(), q: new T3.Quaternion(), q2: new T3.Quaternion(), q3: new T3.Quaternion(), y: new T3.Vector3(0, 1, 0) });
    const head = NB("head");
    if (!head) return;
    ["left", "right"].forEach(side => {
      const up = NB(side + "UpperArm"), hand = NB(side + "Hand");
      if (!up || !hand) return;
      for (let it = 0; it < 2; it++) {
        up.updateWorldMatrix(true, true);
        head.getWorldPosition(v.c); hand.getWorldPosition(v.h); up.getWorldPosition(v.s);
        // conta la punta delle dita (le dita aperte si allungano verso il viso): polso + 2 × (nocca del medio − polso)
        const mid = NB(side + "MiddleProximal");
        if (mid) { const m = mid.getWorldPosition(new T3.Vector3()); v.h.addScaledVector(m.sub(v.h), 2); }
        const dx = v.h.x - v.c.x, dy = v.h.y - v.c.y, dz = v.h.z - v.c.z;
        const out = Math.sign(v.s.x - v.c.x) || (side === "left" ? 1 : -1), W = 0.13;
        if (dy < -0.25 || dy > 0.16 || dz < 0.02 || dx * out >= W) break;
        const pz = v.h.z - v.s.z;
        if (pz < 0.05) break;
        const ang = Math.min(0.6, (out * W - dx) / pz);   // piccola rotazione attorno alla verticale: Δx ≈ pz·angolo
        v.q.setFromAxisAngle(v.y, ang);
        up.parent.getWorldQuaternion(v.q2); up.getWorldQuaternion(v.q3);
        up.quaternion.copy(v.q2.invert().multiply(v.q).multiply(v.q3));
      }
    });
  }

  // Piedi incollati a terra: per ogni gamba, ginocchio e anca si ricalcolano (due ossa, come nei videogiochi)
  // in modo che il piede resti dov'era a riposo, qualunque cosa facciano fianchi, schiena e clip.
  _lockFeet() {
    const F = this._feet;
    if (!F || this._config.feet === "free") return;
    const T3 = this._THREE, v = this._v || (this._v = { a: new T3.Vector3(), b: new T3.Vector3(), c: new T3.Vector3(), d: new T3.Vector3(),
      q: new T3.Quaternion(), q2: new T3.Quaternion(), axis: new T3.Vector3() });
    const hips = this._b.hips;
    hips.updateWorldMatrix(true, true);
    // Se i fianchi sono troppo alti per arrivare a terra con le gambe, si abbassano un po'
    let drop = 0;
    for (const L of F) {
      L.up.getWorldPosition(v.a);
      const need = v.a.distanceTo(L.rest) - (L.l1 + L.l2) * 0.995;
      if (need > drop) drop = need;
    }
    if (drop > 0) { hips.position.y -= drop; hips.updateWorldMatrix(false, true); }
    // Gamba d'appoggio: quando i fianchi vanno di lato, il piede da quella parte si porta sotto il bacino (gamba dritta
    // che regge il peso); l'altro resta dov'era, con il ginocchio che si rilassa. Come chi sta in piedi su una gamba.
    const hx = hips.getWorldPosition(v.c).x - this._hipsRestWorld.x;
    for (const L of F) {
      const hip = L.up.getWorldPosition(v.a), target = v.b.copy(L.rest);
      if (Math.sign(L.rest.x - this._hipsRestWorld.x) === Math.sign(hx)) target.x += hx * 0.8;
      const d = Math.min(hip.distanceTo(target), (L.l1 + L.l2) * 0.999);
      // 1) ginocchio: angolo che dà la distanza giusta fra anca e piede (legge del coseno)
      const want = Math.acos(Math.min(1, Math.max(-1, (L.l1 * L.l1 + L.l2 * L.l2 - d * d) / (2 * L.l1 * L.l2))));
      const knee = L.lo.getWorldPosition(v.c), foot = L.ft.getWorldPosition(v.d);
      const cur = v.c.clone().sub(hip).angleTo(foot.clone().sub(knee)); // 0 = gamba dritta
      const delta = (Math.PI - want) - cur;
      if (Math.abs(delta) > 1e-4) {
        // il ginocchio si piega in avanti: si prova un verso e, se allontana il piede dal risultato voluto, l'altro
        const tryBend = sgn => { L.lo.rotateX(sgn * delta); L.lo.updateWorldMatrix(false, true); return Math.abs(L.ft.getWorldPosition(v.d).distanceTo(hip) - d); };
        const s0 = L.bend || 1, e1 = tryBend(s0);
        L.lo.rotateX(-s0 * delta);
        const e2 = tryBend(-s0);
        if (e1 < e2) { L.lo.rotateX(s0 * delta * 2); L.lo.updateWorldMatrix(false, true); L.bend = s0; } else L.bend = -s0;
      }
      // 2) anca: ruota tutta la gamba perché il piede punti sull'obiettivo
      L.ft.getWorldPosition(v.d);
      const from = v.d.sub(hip).normalize(), to = v.c.copy(target).sub(hip).normalize();
      v.q.setFromUnitVectors(from, to);                       // rotazione nel mondo
      L.up.parent.getWorldQuaternion(v.q2);
      const upW = L.up.getWorldQuaternion(new T3.Quaternion());
      L.up.quaternion.copy(v.q2.clone().invert().multiply(v.q).multiply(upW));
      L.up.updateWorldMatrix(false, true);
      // 3) piede piatto come a riposo
      L.lo.getWorldQuaternion(v.q2);
      L.ft.quaternion.copy(v.q2.invert().multiply(L.restQ));
    }
  }
}

VrmAvatarCard.POSES = POSES; // accessibili dal banco di prova
VrmAvatarCard.PERSONALITIES = PERSONALITIES;
VrmAvatarCard.CHEER = CHEER;
VrmAvatarCard.MOODS = MOODS;

const TAG = "vrm-assist-avatar-card";
if (!customElements.get(TAG)) { customElements.define(TAG, VrmAvatarCard); restoreOverlay(); }
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === TAG))
  window.customCards.push({ type: TAG, name: t("cardName"), preview: false, description: t("cardDesc"),
    documentationURL: "https://github.com/Diess-tech/vrm-assist-avatar-card" });
console.info(`%c ${TAG} %c v${VERSION} `, "background:#4b6cb7;color:#fff", "");
