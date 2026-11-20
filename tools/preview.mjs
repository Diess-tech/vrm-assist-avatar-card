// Anteprima del README (in inglese): tre card con il modello di esempio, in una finta dashboard scura.
// node tools/preview.mjs  →  preview.png (640 px di larghezza, scala 2). Serve test/clips/models/sample-vrm1.vrm.
import { createRequire } from "node:module";
import { serve } from "../test/serve.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const server = await serve(0), PORT = server.address().port;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SHOTS = [
  { label: "Idle · composed", state: "idle", pers: "composto" },
  { label: "Thinking", state: "processing", pers: "" },
  { label: "Talking · Christmas", state: "responding", pers: "spiritoso", theme: "natale" },
];
const imgs = [];
try {
  for (const s of SHOTS) {
    const p = await browser.newPage({ viewport: { width: 200, height: 270 }, deviceScaleFactor: 2 });
    await p.goto(`http://localhost:${PORT}/test/index.html?shot=1&state=${s.state}&pers=${s.pers}${s.theme ? "&theme=" + s.theme : ""}`);
    await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await p.evaluate(() => { window.advance(0.1); document.body.style.background = "transparent"; document.documentElement.style.background = "transparent"; });
    await p.evaluate(() => window.advance(4));
    imgs.push((await p.screenshot({ omitBackground: true })).toString("base64"));
    await p.close();
  }
  const p = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 });
  await p.setContent(`<style>
    body{margin:0;background:#111111;font-family:Roboto,"Segoe UI",sans-serif;color:#e1e1e1}
    .bar{height:48px;background:#1c1c1c;display:flex;align-items:center;padding:0 16px;font-size:19px;border-bottom:1px solid #2a2a2a}
    .row{display:flex;gap:10px;padding:14px}
    .card{flex:1;background:#1c1c1c;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.4)}
    .card img{display:block;width:100%}
    .card div{padding:8px 12px 10px;font-size:13px;color:#9b9b9b}
  </style><div class="bar">Living room</div><div class="row">${SHOTS.map((s, i) =>
    `<div class="card"><img src="data:image/png;base64,${imgs[i]}"><div>${s.label}</div></div>`).join("")}</div>`);
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewportSize({ width: 640, height: h });
  await p.screenshot({ path: "preview.png" });
  console.log("salvato preview.png");
} finally { await browser.close(); server.close(); }
