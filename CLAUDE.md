# vrm-assist-avatar-card — instructions for Claude Code

Public Home Assistant card (HACS, plugin): a 3D VRM character that follows the state of an Assist voice satellite.
It is a **copy** of Davide's private card `Diess-tech/vrm-avatar-card` (v1.8.4, element `vrm-avatar-card`), cleaned
of everything personal. The two live side by side: this one is `custom:vrm-assist-avatar-card`, so both can be
installed on the same Home Assistant. The private repository keeps Davide's models, Mixamo clips, the Windows app
(Jarvis Desktop), the TV page and the long history of decisions: read its `CLAUDE.md` for the "why" of the animation
code (poses, face shapes, clips, framing). Fixes to the shared code should be ported both ways.

Talk to Davide **in Italian, in simple words** (he is not a developer; he works mostly from a phone). Rules of the
studio: `Diess-tech/studio/CLAUDE.md` and `studio/home-assistant/modello-repository.md`.

## How it works
- Source in `src/` (Italian comments), bundled by esbuild into **`dist/vrm-assist-avatar-card.js`** (~1 MB, includes
  three 0.180.0 and @pixiv/three-vrm 3.5.2). `npm install`, `npm run build`. **Rebuild and commit `dist/` on every change.**
  Unlike the other cards this one has a build step; HACS still installs one file (`hacs.json` → `dist/`).
- `src/vrm-assist-avatar-card.js` card; `editor.js` visual editor (plain HTML with HA theme variables, not `ha-form`);
  `presets.js` example model, Mixamo pack, helper ids; `i18n.js` Italian/English (follows HA language, else English);
  `personalities.js`, `funny.js`, `calibrate.js`, `themes.js`, `overlay.js`, `animations.js` as in the private card.
- Example model (`model: esempio`): official three-vrm VRM 1.0 sample, loaded from raw.githubusercontent.com at a fixed
  tag (not stored here: 10 MB).
- Helpers the editor creates (`input_select/create`): `input_select.avatar_modello/umore/atteggiamento/azione/tema`.
- **Licences:** never commit Mixamo files, Davide's models (`jarvis.vrm`, `harley.vrm`) or Clawatar clips. Users
  download Mixamo clips themselves (README table, names in `presets.js`).
- "Coming soon" in the editor, not active: included free animation pack, full-body framing, PC activity (Windows app).

## Test bench
Playwright is preinstalled: `NODE_PATH=$(npm root -g) node test/…`. Download the sample model first into
`test/clips/models/sample-vrm1.vrm` (ignored by git; URL in `presets.js`).
- `npm run shots` + `python3 test/sheet.py bust`: every state, portrait and landscape, in `test/shots/`.
- `node test/editor-test.mjs`: editor with a fake HA (creates helpers, checks files, round-trip of configs, screenshots).
- `node test/overlay-scope.mjs`: overlay only in its dashboard unless `everywhere`.
- `node test/probe.mjs out.png "<code>"`: quick experiments (see the private CLAUDE.md).
- `node tools/preview.mjs`: README `preview.png` (English). Logo and social image: `tools/logo-e-social/`.
**Never call a pose or a screen done without looking at a screenshot.**

## Releasing
1. Raise `VERSION` in `src/vrm-assist-avatar-card.js` (also the comment on the first line), `npm run build`, commit.
2. Davide creates the release by hand on GitHub (tag `vX.Y.Z`); sessions cannot push tags.
3. The workflow `.github/workflows/allega-alla-release.yml` attaches `dist/vrm-assist-avatar-card.js`.
   `hacs.json` filename, the workflow and the file name always match.
4. In HACS: ⋮ → "Update information". README or preview changes show in HACS only with a new release.

## Commits
Author `Davide Sanna <Diess-tech@users.noreply.github.com>`; last line `Co-Authored-By: Claude <noreply@anthropic.com>`.
**No `Claude-Session` line** (public repository). One branch and one pull request per change, message in Italian;
Davide decides the merge. Nothing personal in this repository (entity ids of Davide's home, dashboards, names).

## Donations
PayPal `paypal.me/diesstech`, Ko-fi `ko-fi.com/diesstech`, Buy Me a Coffee `buymeacoffee.com/diesstech`
(`.github/FUNDING.yml`, buttons at the top of the README).
