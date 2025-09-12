
# IFC AI Viewer — Local-only + Encrypted BYOK (OpenAI)

- IFC parsed/rendered **entirely in browser** (WebAssembly IFC.js + three.js)
- **BYOK** OpenAI key encrypted locally (PBKDF2 + AES-GCM)
- Natural-language queries → LLM plans a **local filter**; viewer isolates and CSV exports
- Deploy from repo **root** (GitHub Pages → main + /(root))

## Quick start

```bash
npm run vendor   # downloads vendor/ and wasm/ assets
npm start        # serves on http://localhost:5173
```

Then open `index.html` via the local server (not file://). Use the top bar to set a passphrase + OpenAI API key, load an IFC, and ask a query.

## Notes
- WASM files are from `web-ifc@0.0.69` (exposed at package root). IFCLoader `0.0.126`.
- `src/viewer.js` sets `setWasmPath('./wasm/')`.
- `index.html` provides an **import map** so IFCLoader’s bare imports ("three", "web-ifc") resolve to `./vendor/...`.

## Deploy (GitHub Pages)
- Settings → Pages → **Source: main**; **Folder: /(root)**
- Commit `vendor/` and `wasm/` folders (or let Actions fetch them and publish)

## Security & privacy
- Key encryption with PBKDF2 (salted, 100k iters) + AES-GCM
- CSP limits `connect-src` to OpenAI endpoints only

