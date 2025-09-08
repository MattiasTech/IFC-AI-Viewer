// src/viewer.js
import * as THREE from '../public/vendor/three.module.js';
import { OrbitControls } from '../public/vendor/OrbitControls.js';
import { IFCLoader } from '../public/vendor/IFCLoader.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from '../public/vendor/three-mesh-bvh.module.js';

// Enable BVH accelerated raycasting (big perf boost on selection/filtering)
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export class ViewerApp {
  constructor() {
    this.canvas = document.getElementById('viewer');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8f8f8);
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 5000);
    this.camera.position.set(18, 14, 18);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.canvas.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.1);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(10, 20, 10);
    this.scene.add(dir);

    // IFC loader
    this.ifcLoader = new IFCLoader();
    // Set WASM path to local files
    this.ifcLoader.ifcManager.setWasmPath('/wasm/');
    // Robust boolean solver (avoid stalls in some files)
    this.ifcLoader.ifcManager.applyWebIfcConfig({ USE_FAST_BOOLS: true }); // recommended for tricky models [9](https://stackoverflow.com/questions/73372336/ifc-file-that-works-on-ifcjs-web-ifc-viewer-and-not-on-ifcjs-web-ifc-three)

    this.model = null;
    this.index = { byExpressID: new Map(), byClass: new Map() };
    this.filteredIDs = [];

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const animate = () => { requestAnimationFrame(animate); this.renderer.render(this.scene, this.camera); };
    animate();
  }

  async loadIFCFile(file, onProgress = () => {}) {
    // large file: display progress text
    onProgress('Reading file…');
    const arrayBuffer = await file.arrayBuffer();

    onProgress('Parsing IFC (WASM)…');
    const model = await this.ifcLoader.parse(arrayBuffer, file.name);
    this.model = model;
    this.scene.add(model);

    // Build BVH trees for meshes (faster interaction)
    this.model.traverse(obj => { if (obj.isMesh) obj.geometry?.computeBoundsTree?.(); });

    onProgress('Indexing properties (lazy)…');
    await this.buildIndex(onProgress);

    onProgress('');
  }

  async buildIndex(onProgress = () => {}) {
    const ifc = this.ifcLoader.ifcManager;
    const modelID = this.model.modelID;

    // Choose a set of common classes to index first; others can be added lazily
    const classes = [
      ifc.types.IFCWALL, ifc.types.IFCWALLSTANDARDCASE, ifc.types.IFCWINDOW,
      ifc.types.IFCDOOR, ifc.types.IFCSLAB, ifc.types.IFCCOLUMN, ifc.types.IFCBEAM,
      ifc.types.IFCSTAIR, ifc.types.IFCPLATE, ifc.types.IFCMECHANICALFASTENER
    ].filter(Boolean);

    this.index = { byExpressID: new Map(), byClass: new Map() };

    let total = 0;
    for (const cls of classes) {
      const ids = await ifc.getAllItemsOfType(modelID, cls, false);
      total += ids.length;
    }
    let processed = 0;

    for (const cls of classes) {
      const ids = await ifc.getAllItemsOfType(modelID, cls, false);
      const ifcClassName = ifc.getIfcType(cls);
      if (ids.length) this.index.byClass.set(ifcClassName, []);
      for (const id of ids) {
        // For big files, avoid deep property traversal first; fetch basics, then selected psets
        const props = await ifc.getItemProperties(modelID, id, true);
        const psets = await ifc.getPropertySets(modelID, id, true); // consider lazy fetch if too slow

        const pIndex = {};
        for (const p of psets || []) {
          const pName = p.Name?.value || p.Name || 'UnknownPset';
          pIndex[pName] = {};
          (p.HasProperties || []).forEach(hp => {
            const n = hp?.Name?.value || hp?.Name;
            const v = hp?.NominalValue?.value ?? hp?.NominalValue ?? null;
            if (n) pIndex[pName][n] = (typeof v === 'object' && v?.value !== undefined) ? v.value : v;
          });
        }

        const rec = {
          expressID: id,
          globalId: props.GlobalId?.value || props.GlobalId,
          ifcClass: ifcClassName,
          name: props.Name?.value || props.Name || '',
          predefinedType: props.PredefinedType?.value || props.PredefinedType || '',
          objectType: props.ObjectType?.value || props.ObjectType || '',
          tag: props.Tag?.value || props.Tag || '',
          psets: pIndex,
          meshIDs: []
        };
        this.index.byExpressID.set(id, rec);
        this.index.byClass.get(ifcClassName)?.push(id);

        processed++;
        if (processed % 250 === 0) onProgress(`Indexing… ${processed}/${total}`);
      }
    }

    // Map element → meshes for visibility toggles
    this.model.traverse(obj => {
      if (obj.isMesh && obj.geometry?.attributes?.expressID) {
        const ids = obj.geometry.attributes.expressID.array;
        for (let i = 0; i < ids.length; i++) {
          const eid = ids[i];
          const rec = this.index.byExpressID.get(eid);
          if (rec) {
            if (!rec.meshIDs.includes(obj.id)) rec.meshIDs.push(obj.id);
          }
        }
      }
    });
  }

  resetView() {
    this.setVisibilityForAll(true);
    this.filteredIDs = [];
  }

  setVisibilityForAll(visible) {
    this.scene.traverse(obj => { if (obj.isMesh) obj.visible = visible; });
  }

  isolateByExpressIDs(ids) {
    this.setVisibilityForAll(false);
    const idSet = new Set(ids);
    for (const [eid, rec] of this.index.byExpressID.entries()) {
      const vis = idSet.has(eid);
      (rec.meshIDs || []).forEach(mid => {
        const mesh = this.scene.getObjectById(mid);
        if (mesh) mesh.visible = vis;
      });
    }
    this.filteredIDs = ids;
  }

  queryLocal(filterSpec) {
    const { classes = [], conditions = [], limit = null } = filterSpec;
    const candidates = new Set();

    if (classes.length) {
      for (const cls of classes) {
        const ids = this.index.byClass.get(cls) || [];
        ids.forEach(id => candidates.add(id));
      }
    } else {
      for (const ids of this.index.byClass.values()) ids.forEach(id => candidates.add(id));
    }

    const res = [];
    for (const id of candidates) {
      const rec = this.index.byExpressID.get(id);
      if (!rec) continue;
      if (this.matches(rec, conditions)) {
        res.push(rec);
        if (limit && res.length >= limit) break;
      }
    }
    return res;
  }

  matches(rec, conditions) {
    for (const c of conditions) {
      const { field, op, value } = c;
      let v = null;

      if (field.startsWith('pset:')) {
        const parts = field.split(':'); // pset:Pset:Prop
        const pset = parts[1], prop = parts[2];
        v = rec.psets?.[pset]?.[prop] ?? null;
      } else {
        if (field === 'IfcType') v = rec.ifcClass;
        else v = rec[field] ?? null;
      }

      const str = (x) => (x === null || x === undefined) ? '' : String(x).toLowerCase();
      const sV = str(v);
      const sVal = Array.isArray(value) ? value.map(str) : str(value);

      switch (op) {
        case 'equals': if (sV !== sVal) return false; break;
        case 'contains': if (!sV.includes(sVal)) return false; break;
        case 'startsWith': if (!sV.startsWith(sVal)) return false; break;
        case 'in': if (!Array.isArray(sVal) || !sVal.includes(sV)) return false; break;
        case 'regex': try { if (!(new RegExp(value, 'i')).test(String(v))) return false; } catch { return false; } break;
        case 'gt': if (!(Number(v) > Number(value))) return false; break;
        case 'lt': if (!(Number(v) < Number(value))) return false; break;
        default: return false;
      }
    }
    return true;
  }
}
