// Prova dell'editor grafico: node test/editor-test.mjs [cartella-screenshot]
// Finta HA con callWS (crea gli aiutanti davvero nel finto stato), giro andata e ritorno delle configurazioni,
// «Controlla i file» su una cartella del banco di prova. Salva gli screenshot dell'editor in test/shots/.
import { createRequire } from "module"; import { serve } from "./serve.mjs"; import { mkdir } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)("playwright");
const server = await serve(0);
await mkdir(new URL("./shots/", import.meta.url), { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 560, height: 1400 } });
const errors = [];
p.on("pageerror", e => errors.push(e.message));
p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await p.goto(`http://localhost:${server.address().port}/test/editor.html`); await p.waitForTimeout(500);

const r = await p.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const C = customElements.get("vrm-assist-avatar-card");
  const ws = [];
  const hass = { language: "it", user: { is_admin: true }, states: {
    "assist_satellite.voice_pe": { attributes: { friendly_name: "Voice PE Soggiorno" } },
  } };
  hass.callWS = async msg => {
    ws.push(msg);
    if (msg.type === "input_select/create") {
      const id = "input_select." + msg.name.toLowerCase().replace(/\s+/g, "_");
      ed.hass = { ...hass, states: { ...hass.states, [id]: { state: msg.options[0], attributes: { options: msg.options } } } };
      Object.assign(hass.states, ed._hass.states);
      return { id: id.split(".")[1], ...msg };
    }
    if (msg.type === "input_select/list") return Object.entries(hass.states).filter(([k]) => k.startsWith("input_select."))
      .map(([k, v]) => ({ id: k.split(".")[1], name: k.split(".")[1].replace(/_/g, " "), options: v.attributes.options }));
    if (msg.type === "input_select/update") {
      const id = "input_select." + msg.input_select_id;
      hass.states[id] = { state: msg.options[0], attributes: { options: msg.options } };
      ed.hass = { ...hass, states: { ...hass.states } };
      return msg;
    }
  };
  const out = {};
  out.stub = C.getStubConfig(hass);
  var ed = C.getConfigElement(); document.body.appendChild(ed);
  const got = []; ed.addEventListener("config-changed", e => got.push(e.detail.config));
  ed.hass = hass; ed.setConfig({ type: "custom:vrm-assist-avatar-card", ...out.stub });
  const R = ed.shadowRoot, $ = s => R.querySelector(s), $$ = s => [...R.querySelectorAll(s)];
  const pick = (k, v) => { const el = $(`select[data-k="${k}"]`); el.value = v; el.dispatchEvent(new Event("change")); };
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); };
  out.primo = { labels: $$("label").map(l => l.textContent).slice(0, 3), sezioni: $$("button[data-exp]").map(b => b.textContent.trim().split("\n")[0]) };

  // più modelli + aiutante del modello
  pick("modelMode", "multi");
  type($('input[data-m="0"][data-f="name"]'), "Aiko");
  type($('input[data-m="0"][data-f="file"]'), "/local/avatar/aiko.vrm");
  $("button[data-addm]").click();
  type($('input[data-m="1"][data-f="name"]'), "Ren");
  type($('input[data-m="1"][data-f="file"]'), "/local/avatar/ren.vrm");
  $('button[data-sw="modelEntity"]').click();
  out.multi = got.at(-1);
  out.avvisoModello = !!$("button[data-create=model]");
  $("button[data-create=model]").click(); await wait(50);
  out.dopoCrea = { messaggio: R.textContent.includes("Creato input_select.avatar_modello"), opzioni: hass.states["input_select.avatar_modello"].attributes.options };
  // un terzo modello: l'aiutante non lo ha → «Aggiorna le opzioni»
  $("button[data-addm]").click();
  type($('input[data-m="2"][data-f="name"]'), "Kei");
  out.mancaKei = !!$("button[data-update=model]");
  $("button[data-update=model]").click(); await wait(50);
  out.dopoAggiorna = hass.states["input_select.avatar_modello"].attributes.options;

  // carattere
  $('button[data-exp="carattere"]').click();
  pick("pers", "segui");
  $('button[data-sw="mood"]').click();
  $('button[data-sw="action"]').click();
  pick("theme", "automatico");
  out.aiutantiMancanti = $$("button[data-create]").map(b => b.dataset.create);
  $("button[data-create=mood]").click(); await wait(50);
  out.umoreCreato = hass.states["input_select.avatar_umore"].attributes.options;

  // animazioni
  $('button[data-exp="animazioni"]').click();
  pick("anim", "mixamo");
  out.inclusoDisabilitato = $('select[data-k="anim"] option[value="incluse"]').disabled;
  type($('input[data-k="animBase"]'), "/test/clips/anim/");
  $("button[data-check]").click();
  for (let i = 0; i < 50 && ed._checking !== false; i++) await wait(50);
  out.controllo = ed._check;

  // dove si vede
  $('button[data-exp="dove"]').click();
  const ov = $('input[name=where][value=overlay]'); ov.checked = true; ov.dispatchEvent(new Event("change"));
  pick("corner", "tl"); pick("size", "grande"); $('button[data-sw="everywhere"]').click();
  out.figuraInteraDisabilitata = $('select[data-k="framing"] option[value="intera"]').disabled;

  // avanzate
  $('button[data-exp="avanzate"]').click();
  type($('input[data-k="name"]'), "Aiko");
  pick("fps", "15");
  $('button[data-sw="shadow"]').click();
  out.pcDisabilitato = R.querySelector(".row.off .sw").disabled;
  out.finale = got.at(-1);

  // la card accetta la configurazione prodotta?
  const card = document.createElement("vrm-assist-avatar-card"); card.setConfig(out.finale);
  out.card = { models: card._models.map(m => m.file), anim: Object.keys(card._config.animations), body: card._config.body };

  // andata e ritorno: configurazioni scritte a mano restano identiche se non si tocca niente
  const { toForm, fromForm } = await import("../src/editor.js");
  const samples = [
    { type: "custom:vrm-assist-avatar-card", model: "esempio", entity: "assist_satellite.x" },
    { type: "custom:vrm-assist-avatar-card", model: "/local/avatar/a.vrm", personality: "serio", height: "480px", demo: true, clip_head: true, headroom: 0.2 },
    { type: "custom:vrm-assist-avatar-card", model: "/local/a.vrm", models: [{ name: "A", file: "/local/a.vrm", personality: "composto" }, { name: "B", file: "/local/b.vrm" }],
      model_entity: "input_select.mio", personality_entity: "input_select.att", mood_entity: "input_select.umore", theme: "automatico", theme_entity: "input_select.tema",
      animations: { riposo: ["/local/x.fbx"] }, body: "clip", overlay: { position: "top-left", width: "30vw", height: "50vh", margin: "8px" }, zoom: 1.2, fps: 24, shadow: false },
    { type: "custom:vrm-assist-avatar-card", model: "/local/a.vrm", animations: "consigliate", body: "clip", anim_base: "/local/clip/", overlay: { position: "bottom-left", size: "piccola", everywhere: true } },
  ];
  out.andataRitorno = samples.map(s => JSON.stringify(fromForm(toForm(s), s)) === JSON.stringify(s) || { prima: s, dopo: fromForm(toForm(s), s) });

  // inglese
  ed.hass = { ...hass, language: "en" };
  out.inglese = $$("label").map(l => l.textContent).slice(0, 2);
  ed.hass = { ...hass, language: "it" };
  out.ws = ws.map(m => m.type + (m.name ? " " + m.name : "") + (m.options ? " [" + m.options.join(",") + "]" : ""));
  out.nome = (window.customCards || []).map(c => c.name + " / " + c.type);
  return out;
});
// screenshot: italiano con tutte le sezioni aperte, poi primo avvio
await p.locator("vrm-assist-avatar-card-editor").screenshot({ path: "test/shots/editor-aperto.png" });
await p.evaluate(() => { const ed = document.querySelector("vrm-assist-avatar-card-editor"); ed.remove();
  const C = customElements.get("vrm-assist-avatar-card"), e2 = C.getConfigElement(); document.body.appendChild(e2);
  e2.hass = { language: "it", states: { "assist_satellite.voice_pe": { attributes: { friendly_name: "Voice PE Soggiorno" } } } };
  e2.setConfig({ type: "custom:vrm-assist-avatar-card", model: "esempio", entity: "assist_satellite.voice_pe" }); });
await p.locator("vrm-assist-avatar-card-editor").screenshot({ path: "test/shots/editor-primo.png" });
console.log(JSON.stringify(r, null, 1));
console.log(errors.length ? "ERRORI: " + errors.join("\n") : "nessun errore nella pagina");
await b.close(); server.close();
