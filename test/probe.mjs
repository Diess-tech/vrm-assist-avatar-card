// Prova veloce: esegue del codice nella pagina e salva uno screenshot.
// node test/probe.mjs out.png "<codice JS>" [framing] [larghezza] [altezza] [stato]
// Nel codice sono disponibili: card, POSES (le pose della card), advance(sec), snap(), setState(stato), gesture(nome, durata, lato)
// Se il codice restituisce { frames: [snap(), ...] } salva una "pellicola" in out.png (fotogrammi affiancati)
import { createRequire } from "node:module";
import { serve } from "./serve.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const [out, code = "", framing = "full", w = 412, h = 915, state = "idle"] = process.argv.slice(2);
const MODEL = process.env.MODEL ? `&model=${encodeURIComponent(process.env.MODEL)}` : "";
const server = await serve(0);
const PORT = server.address().port;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  page.on("pageerror", e => console.log("[pageerror]", e.message));
  await page.goto(`http://localhost:${PORT}/test/index.html?shot=1&framing=${framing}&anim=${encodeURIComponent(process.env.ANIM || "")}&pers=${process.env.PERS || ""}${process.env.DEMO ? "&demo" : ""}&state=${state}${MODEL}${process.env.BODY ? "&body=" + process.env.BODY : ""}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const res = await page.evaluate(c => {
    const card = document.querySelector("vrm-assist-avatar-card"), POSES = card.constructor.POSES, advance = window.advance;
    advance(0.1);
    const r = new Function("card", "POSES", "advance", "snap", "setState", "gesture", c)(card, POSES, advance, window.snap, window.setSatState, window.gesture);
    if (r === undefined) advance(4);
    return r;
  }, code);
  if (res && res.log) console.log(JSON.stringify(res.log));
  if (res && res.frames) {
    // Pellicola: affianca i fotogrammi in una sola immagine
    await page.setContent(`<body style="margin:0;background:#111;display:flex">${res.frames.map(f => `<img src="${f}" style="width:${+w}px;height:${+h}px">`).join("")}</body>`);
    await page.setViewportSize({ width: res.frames.length * +w, height: +h });
    await page.screenshot({ path: out });
  } else {
    if (res !== undefined) console.log(JSON.stringify(res, null, 1));
    await page.screenshot({ path: out });
  }
} finally { await browser.close(); server.close(); }
