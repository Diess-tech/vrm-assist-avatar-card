/* Sovrimpressione (opzione overlay): il personaggio sta in un angolo sopra tutta l'interfaccia di Home Assistant,
 * con sfondo trasparente, come Desktop Mate sul PC. I tocchi passano attraverso (la dashboard sotto resta usabile).
 *
 * - La card con `overlay` messa in una dashboard non disegna niente al suo posto: crea (una volta sola) il livello sopra.
 * - Il livello vive in document.body, quindi resta cambiando vista o dashboard.
 * - La configurazione si salva nel dispositivo (localStorage): alla riapertura dell'app il personaggio ricompare da solo,
 *   ma solo su quel dispositivo. Con `overlay: false` (o `overlay: { enabled: false }`) si spegne e si dimentica.
 * - Lo stato del satellite arriva leggendo `hass` dall'elemento <home-assistant> (la card nella dashboard può non esserci).
 */
// Di base la sovrimpressione vive solo mentre è aperta la dashboard che contiene la card; si memorizza nel dispositivo
// solo con overlay: { everywhere: true }. Si nasconde mentre è acceso lo screensaver di Wallpanel.
const KEY = "vrm-assist-avatar-card-overlay";
/** Dashboard aperta adesso: primo pezzo dell'indirizzo (es. "lovelace") */
const dashboardNow = () => location.pathname.split("/")[1] || "";
let home = null;
let layer = null, inner = null, timer = null, current = "";

const SIZES = { piccola: { width: "30vw", height: "40vh" }, media: { width: "45vw", height: "60vh" }, grande: { width: "60vw", height: "80vh" } };
SIZES.small = SIZES.piccola; SIZES.medium = SIZES.media; SIZES.large = SIZES.grande;
const DEFAULTS = { position: "bottom-right", width: "45vw", height: "60vh", margin: "0px", opacity: 1 };

function haRoot() { return document.querySelector("home-assistant"); }

/** Screensaver di Wallpanel acceso? (il suo `<wallpanel-view>` sta nella shadow root di <home-assistant> e sa dire se gira) */
function screensaverOn() {
  try {
    const r = haRoot();
    const v = r && r.shadowRoot && r.shadowRoot.querySelector("wallpanel-view");
    return !!(v && typeof v.screensaverRunning === "function" && v.screensaverRunning());
  } catch (e) { return false; }
}

export function overlayOptions(cfg) {
  const o = cfg.overlay;
  if (!o) return null;
  if (o === true) return { ...DEFAULTS };
  if (typeof o === "object" && o.enabled !== false) {
    // size: piccola | media | grande (anche small | medium | large); width e height scritti a mano vincono
    const sz = SIZES[String(o.size || "").toLowerCase()] || {};
    return { ...DEFAULTS, ...sz, ...o };
  }
  return null;
}

/** Crea o aggiorna il livello con questa configurazione della card (senza `overlay`) */
export function mountOverlay(cardConfig, opts) {
  const sig = JSON.stringify([cardConfig, opts]);
  home = opts.everywhere || opts.container ? null : dashboardNow();
  if (layer && sig === current) return;
  unmountOverlay(false);
  current = sig;
  const host = (opts.container && document.querySelector(opts.container)) || document.body;
  layer = document.createElement("div");
  layer.id = "vrm-assist-avatar-overlay";
  const [v, h] = String(opts.position).split("-");
  const m = opts.margin;
  Object.assign(layer.style, {
    position: host === document.body ? "fixed" : "absolute", zIndex: 4, pointerEvents: "none",
    width: opts.width, height: opts.height, opacity: opts.opacity,
    [v === "top" ? "top" : "bottom"]: m, [h === "left" ? "left" : "right"]: m,
  });
  inner = document.createElement("vrm-assist-avatar-card");
  inner.setConfig({ ...cardConfig, overlay: undefined, demo: false, height: "100%" });
  inner.style.cssText = "display:block;width:100%;height:100%;pointer-events:none";
  layer.appendChild(inner);
  host.appendChild(layer);
  // stato di Home Assistant: si rilegge ogni 300 ms (l'oggetto hass cambia a ogni aggiornamento)
  let last = null;
  const feed = () => {
    const hass = opts.hass ? opts.hass() : haRoot() && haRoot().hass;
    if (hass && hass !== last) { last = hass; inner.hass = hass; }
  };
  feed();
  // ogni 300 ms: stato di HA e, se la sovrimpressione appartiene a una dashboard, controllo che sia ancora aperta
  // (cambiando dashboard sparisce; tornandoci la card la rimette)
  timer = setInterval(() => {
    if (home !== null && dashboardNow() !== home) { unmountOverlay(false); return; }
    // mentre lo screensaver (Wallpanel) è acceso il livello si nasconde: sta fuori da Home Assistant (in body),
    // quindi finiva sopra le immagini dello screensaver
    if (layer) layer.style.visibility = screensaverOn() ? "hidden" : "visible";
    feed();
  }, 300);
  try {
    if (opts.everywhere && !opts.container) localStorage.setItem(KEY, JSON.stringify({ config: cardConfig, opts }));
    else localStorage.removeItem(KEY);
  } catch (e) { /* ignorato */ }
}

export function unmountOverlay(forget = true) {
  if (timer) clearInterval(timer);
  timer = null;
  if (layer) layer.remove();
  layer = inner = null; current = "";
  if (forget) try { localStorage.removeItem(KEY); } catch (e) { /* ignorato */ }
}

/** All'apertura dell'app: se su questo dispositivo la sovrimpressione era attiva, ricompare da sola */
export function restoreOverlay() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { saved = null; }
  if (!saved || !saved.config || !saved.opts || !saved.opts.everywhere) return;
  const start = () => (haRoot() ? mountOverlay(saved.config, saved.opts) : setTimeout(start, 500));
  start();
}
