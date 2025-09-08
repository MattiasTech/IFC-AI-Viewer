// scripts/fetch-vendor.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const files = [
  // three.js (r160 example)
  { url: 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js', path: 'public/vendor/three.module.js' },
  { url: 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js', path: 'public/vendor/OrbitControls.js' },

  // three-mesh-bvh (ESM)
  { url: 'https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.9.1/build/index.module.js', path: 'public/vendor/three-mesh-bvh.module.js' },

  // MSAL browser (PKCE)
  { url: 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.14.0/dist/msal-browser.min.js', path: 'public/vendor/msal-browser.min.js' },

  // IFC.js loader and WASM runtime
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.56/web-ifc-api.js', path: 'public/vendor/web-ifc-api.js' },
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc-three@0.0.126/IFCLoader.js', path: 'public/vendor/IFCLoader.js' },

  // web-ifc WASM binaries (version must match the web-ifc runtime)
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.56/wasm/web-ifc.wasm', path: 'public/wasm/web-ifc.wasm' },
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.56/wasm/web-ifc-mt.wasm', path: 'public/wasm/web-ifc-mt.wasm' },
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.56/wasm/web-ifc.wasm.wasm', path: 'public/wasm/web-ifc.wasm.wasm' } // some builds look for this alias
];

await mkdir('public/vendor', { recursive: true });
await mkdir('public/wasm', { recursive: true });

for (const f of files) {
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`Failed to fetch ${f.url}: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(f.path, buf);
  console.log('Fetched', f.path);
}
console.log('Vendor fetched.');
