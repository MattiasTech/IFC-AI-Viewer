// scripts/fetch-vendor.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const files = [
  // three.js (r160 example)
  { url: 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js', path: 'vendor/three.module.js' },
  { url: 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js', path: 'vendor/OrbitControls.js' },

  // three-mesh-bvh (ESM)
  { url: 'https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.9.1/build/index.module.js', path: 'vendor/three-mesh-bvh.module.js' },

  // IFC.js loader
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc-three@0.0.126/IFCLoader.js', path: 'vendor/IFCLoader.js' },

  // web-ifc runtime (match WASM and API versions!)
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.69/web-ifc-api.js', path: 'vendor/web-ifc-api.js' },

  // web-ifc WASM binaries (exported at package root since 0.65+)
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.69/web-ifc.wasm', path: 'wasm/web-ifc.wasm' },
  { url: 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.69/web-ifc-mt.wasm', path: 'wasm/web-ifc-mt.wasm' }
];

await mkdir('vendor', { recursive: true });
await mkdir('wasm', { recursive: true });

for (const f of files) {
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`Failed to fetch ${f.url}: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(f.path, buf);
  console.log('Fetched', f.path);
}
console.log('Vendor fetched.');
