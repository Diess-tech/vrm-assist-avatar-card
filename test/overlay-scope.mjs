// La sovrimpressione vive solo nella dashboard della card (salvo overlay.everywhere) e non si memorizza
import { createRequire } from "module"; import { serve } from "./serve.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const server = await serve(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }); const p = await b.newPage();
await p.goto(`http://localhost:${server.address().port}/test/editor.html`);
await p.waitForTimeout(1200);
const r = await p.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), L = () => !!document.getElementById("vrm-assist-avatar-overlay");
  const out = { livelloAllAvvio: L() };
  const make = extra => { const c = document.createElement("vrm-assist-avatar-card"); c.setConfig({ type: "custom:vrm-assist-avatar-card", model: "clips/models/sample-vrm1.vrm", overlay: { position: "bottom-right", ...extra } }); document.body.appendChild(c); return c; };
  let c = make({}); await wait(200);
  out.nellaSuaDashboard = { livello: L(), memorizzato: !!localStorage.getItem("vrm-assist-avatar-card-overlay") };
  c.remove(); history.pushState({}, "", "/test/altra-scheda"); await wait(500);
  out.altraSchedaStessaDashboard = L();
  history.pushState({}, "", "/altra-dashboard/x"); await wait(500);
  out.altraDashboard = L();
  history.pushState({}, "", "/test/editor.html"); c = make({}); await wait(300);
  out.tornatoIndietro = L();
  c.remove(); c = make({ everywhere: true }); await wait(300);
  history.pushState({}, "", "/altra-dashboard/x"); await wait(500);
  out.everywhere = { livello: L(), memorizzato: !!localStorage.getItem("vrm-assist-avatar-card-overlay") };
  return out;
});
console.log(JSON.stringify(r, null, 1)); await b.close(); server.close();
