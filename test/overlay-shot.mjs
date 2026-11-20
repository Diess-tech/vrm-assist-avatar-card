// node test/overlay-shot.mjs out.png [larghezza] [altezza] [query]
import { createRequire } from "node:module";
import { serve } from "./serve.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const [out, w = 412, h = 915, query = ""] = process.argv.slice(2);
const server = await serve(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on("pageerror", e => console.log("[pageerror]", e.message));
  await p.goto(`http://localhost:${server.address().port}/test/overlay.html?${query}`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await p.evaluate(() => { const c = window.inner(); c._renderer.setAnimationLoop(null); for (let i = 0; i < 90; i++) c._tick(1 / 30); c._renderer.render(c._scene, c._camera); });
  // un tocco su una tessera sotto il personaggio deve arrivare alla dashboard
  const hit = await p.evaluate(() => { const r = document.querySelector("#vrm-assist-avatar-overlay").getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el && (el.className || el.tagName); });
  console.log("sotto il personaggio c'è:", hit);
  await p.screenshot({ path: out });
} finally { await b.close(); server.close(); }
