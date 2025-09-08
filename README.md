# IFC AI Viewer — Entra login + BYOK OpenAI (100% client-side)

A privacy-first web app that:
- parses **IFC in the browser** (WASM) and never uploads the model,
- lets users **sign in** with **Microsoft Entra ID** (Azure AD) and **use their own OpenAI key**, and
- asks an **LLM** to translate natural language into a **local filter** applied to the model,
- exports the filtered list to **CSV**.

## Why not Autodesk Viewer?

Autodesk’s Viewer requires **SVF/SVF2 derivatives** produced by the **Model Derivative API**. That means your source model must be **uploaded** to Autodesk (APS) for translation before it can be viewed, which violates our “no cloud processing of IFC” requirement. There is an offline sample, but it still assumes you already have **pre-translated** SVF artifacts from Autodesk. SVF2 has additional caveats for offline usage.  
Sources: [Model Derivative API Overview](https://forge.autodesk.com/developer/overview/model-derivative-api) [1](https://forge.autodesk.com/developer/overview/model-derivative-api), [Offline Viewer sample](https://github.com/Autodesk-Forge/viewer-javascript-offline.sample) [2](https://github.com/Autodesk-Forge/viewer-javascript-offline.sample), [SVF2 notes](https://aps.autodesk.com/blog/model-derivative-svf2-enhancements-part-1-viewer) [4](https://aps.autodesk.com/blog/model-derivative-svf2-enhancements-part-1-viewer), [SVF2 offline Q&A](https://stackoverflow.com/questions/75478668/is-it-possible-to-download-svf2-model-derivatives-for-offline-viewing) [3](https://stackoverflow.com/questions/75478668/is-it-possible-to-download-svf2-model-derivatives-for-offline-viewing).

## Getting started
```bash
# 1) Clone and install vendor assets (no NPM deps, this just downloads static files)
npm run vendor

# 2) Configure Entra ID in src/auth.js
#    - Replace YOUR_TENANT_ID and YOUR_APP_CLIENT_ID
#    - App type: SPA, Redirect URI: https://<your-gh-username>.github.io/<repo> or http://localhost:5173
#    (MSAL uses PKCE under the hood.)

# 3) Run locally
npm start
#  -> http://localhost:5173

# 4) Deploy to GitHub Pages
#    Push the repo, set Pages to serve /public.
#    (Optional) For best performance with WASM threads, deploy to Netlify/Cloudflare and keep /public/_headers.
