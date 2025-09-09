// src/viewer.js
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { IFCLoader } from '../vendor/IFCLoader.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from '../vendor/three-mesh-bvh.module.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export class ViewerApp {
  constructor() {
  this.canvas = document.getElementById('viewer');
  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color(0xf8f8f8);

  // create camera using container aspect ratio
  const rect = this.canvas.getBoundingClientRect();
  const cw = rect.width || window.innerWidth;
  const ch = rect.height || window.innerHeight;
  this.camera = new THREE.PerspectiveCamera(60, cw / ch, 0.1, 5000);
  this.camera.position.set(18, 14, 18);

  this.renderer = new THREE.WebGLRenderer({ antialias: true });
  this.renderer.setPixelRatio(window.devicePixelRatio || 1);
  // ensure the canvas fills the container
  this.renderer.domElement.style.width = '100%';
  this.renderer.domElement.style.height = '100%';
  this.renderer.setSize(cw, ch);
  this.canvas.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.1); this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(10, 20, 10); this.scene.add(dir);

    this.ifcLoader = new IFCLoader();
    // WASM files are served from /wasm at the repo root
    this.ifcLoader.ifcManager.setWasmPath('./wasm/');
    this.ifcLoader.ifcManager.applyWebIfcConfig({ USE_FAST_BOOLS: true });

    this.model = null;
    this.index = { byExpressID: new Map(), byClass: new Map() };
    this.filteredIDs = [];

    const resize = () => {
      const r = this.canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    // react to window resize and container changes
    window.addEventListener('resize', resize);
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(resize);
      this._ro.observe(this.canvas);
    }
    const animate = () => { requestAnimationFrame(animate); this.renderer.render(this.scene, this.camera); };
    animate();
  }

  async loadIFCFile(file, onProgress = () => {}) {
    onProgress('Reading file…');
    const arrayBuffer = await file.arrayBuffer();

    onProgress('Parsing IFC (WASM)…');
    const model = await this.ifcLoader.parse(arrayBuffer, file.name);
  this.model = model; this.scene.add(model);
  console.log('[viewer] model parsed and added to scene', { name: file.name, model });

    this.model.traverse(obj => { if (obj.isMesh) obj.geometry?.computeBoundsTree?.(); });

    onProgress('Indexing properties…');
    await this.buildIndex(onProgress);
    // ensure the loaded model is framed in the viewer
    this.frameModel();
    onProgress('');
  }

  frameModel() {
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model);
  console.log('[viewer] frameModel bounding box', box.min.toArray(), box.max.toArray());
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
      this.camera.position.set(center.x + cameraZ, center.y + cameraZ/3, center.z + cameraZ);
      this.camera.lookAt(center);
      this.controls.target.copy(center);
      this.controls.update();
  console.log('[viewer] camera positioned to frame model', { position: this.camera.position.toArray(), target: this.controls.target.toArray() });
    }
  }

  async buildIndex(onProgress = () => {}) {
    const ifc = this.ifcLoader.ifcManager;
    const modelID = this.model.modelID;
    const classes = [
      ifc.types.IFCWALL, ifc.types.IFCWALLSTANDARDCASE, ifc.types.IFCWINDOW,
      ifc.types.IFCDOOR, ifc.types.IFCSLAB, ifc.types.IFCCOLUMN, ifc.types.IFCBEAM,
      ifc.types.IFCSTAIR, ifc.types.IFCPLATE, ifc.types.IFCMECHANICALFASTENER
    ].filter(Boolean);

    this.index = { byExpressID: new Map(), byClass: new Map() };

    let total = 0;
    for (const cls of classes) total += (await ifc.getAllItemsOfType(modelID, cls, false)).length;
    let processed = 0;

    for (const cls of classes) {
      const ids = await ifc.getAllItemsOfType(modelID, cls, false);
      const ifcClassName = ifc.getIfcType(cls);
      if (ids.length) this.index.byClass.set(ifcClassName, []);
      for (const id of ids) {
        const props = await ifc.getItemProperties(modelID, id, true);
        const psets = await ifc.getPropertySets(modelID, id, true);
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

    this.model.traverse(obj => {
      if (obj.isMesh && obj.geometry?.attributes?.expressID) {
        const ids = obj.geometry.attributes.expressID.array;
        for (let i = 0; i < ids.length; i++) {
          const eid = ids[i];
          const rec = this.index.byExpressID.get(eid);
          if (rec && !rec.meshIDs.includes(obj.id)) rec.meshIDs.push(obj.id);
        }
      }
    });
  }

  resetView() { this.setVisibilityForAll(true); this.filteredIDs = []; }
  setVisibilityForAll(visible) { this.scene.traverse(o => { if (o.isMesh) o.visible = visible; }); }

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
    if (classes.length) for (const cls of classes) (this.index.byClass.get(cls) || []).forEach(id => candidates.add(id));
    else for (const ids of this.index.byClass.values()) ids.forEach(id => candidates.add(id));

    const res = [];
    for (const id of candidates) {
      const rec = this.index.byExpressID.get(id);
      if (!rec) continue;
      if (this.matches(rec, conditions)) { res.push(rec); if (limit && res.length >= limit) break; }
    }
    return res;
  }

  matches(rec, conditions) {
    for (const c of conditions) {
      const { field, op, value } = c;
      let v = null;
      if (field.startsWith('pset:')) {
        const [, pset, prop] = field.split(':');
        v = rec.psets?.[pset]?.[prop] ?? null;
      } else {
        v = (field === 'IfcType') ? rec.ifcClass : (rec[field] ?? null);
      }
      const str = x => (x == null) ? '' : String(x).toLowerCase();
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
