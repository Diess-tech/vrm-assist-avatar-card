// Screenshot di ogni stato, in verticale e orizzontale: node test/screenshots.mjs [framing...]
// Salva in test/shots/<framing>-<orientamento>-<stato>.png
import { createRequire } from "node:module";
// Playwright: quello del progetto se installato, altrimenti quello globale
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdir } from "node:fs/promises";
import { serve } from "./serve.mjs";

const STATES = ["idle", "listening", "processing", "responding"];
const VIEWS = { verticale: { width: 412, height: 915 }, orizzontale: { width: 915, height: 412 } };
const FRAMINGS = ["bust"]; // unica inquadratura dalla v1.0
const SETTLE_S = Number(process.env.SETTLE_S) || 4; // secondi simulati per raggiungere la posa

const server = await serve(0);
const PORT = server.address().port;
const MODEL = process.env.MODEL ? `&model=${encodeURIComponent(process.env.MODEL)}` : "";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
await mkdir(new URL("./shots/", import.meta.url), { recursive: true });

try {
  for (const framing of FRAMINGS) for (const [view, size] of Object.entries(VIEWS)) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    page.on("console", m => { if (m.type() === "error" || m.type() === "warning") console.log(`  [${m.type()}] ${m.text()}`); });
    page.on("pageerror", e => console.log(`  [pageerror] ${e.message}`));
    await page.goto(`http://localhost:${PORT}/test/index.html?shot=1&framing=${framing}&anim=${encodeURIComponent(process.env.ANIM || "")}&pers=${process.env.PERS || ""}${MODEL}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await page.evaluate(() => window.advance(0.1)); // ferma subito il ciclo in tempo reale
    for (const s of STATES) {
      await page.evaluate(st => window.setSatState(st), s);
      await page.evaluate(sec => window.advance(sec), SETTLE_S);
      const file = `test/shots/${process.env.PERS ? process.env.PERS + "-" : ""}${framing}-${view}-${s}.png`;
      await page.screenshot({ path: file });
      console.log("salvato", file);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
