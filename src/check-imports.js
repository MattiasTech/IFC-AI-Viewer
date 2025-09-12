import * as THREE from 'three';

console.log('✅ Import map resolved "three"', !!THREE.BoxGeometry);
document.body.insertAdjacentHTML('beforeend', '<div style="position:absolute;top:10px;right:10px;background:#0b0;color:#fff;padding:6px 10px;border-radius:6px;font:12px/1.2 system-ui;">Import map OK</div>');
