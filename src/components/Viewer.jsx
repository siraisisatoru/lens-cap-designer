import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PART_COLORS_LIGHT = [0x2b2b30, 0xe8590c, 0x5c7cfa];
const PART_COLORS_DARK = [0x76767f, 0xe8590c, 0x748ffc];

function toGeometry(mesh) {
  const { vertProperties: vp, triVerts, numProp } = mesh;
  const pos = new Float32Array((vp.length / numProp) * 3);
  for (let i = 0, j = 0; i < vp.length; i += numProp, j += 3) {
    pos[j] = vp[i]; pos[j + 1] = vp[i + 1]; pos[j + 2] = vp[i + 2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(triVerts, 1));
  const flat = g.toNonIndexed(); // flat shading: crisp edges on the thread and knurl
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}

/** parts: [{ name, mesh, x, y, rot90, asm, explode }], view: 'plate' | 'exploded', bed: [w, h] */
export default function Viewer({ parts, view, bed, frameKey }) {
  const hostRef = useRef(null);
  const ctx = useRef(null);

  // one-time three.js setup
  useEffect(() => {
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    host.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444450, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(80, -120, 200);
    scene.add(sun);
    const content = new THREE.Group();
    scene.add(content);

    // fit the camera to the content, using whichever field of view (vertical/horizontal) is narrower
    const frame = (view) => {
      if (!content.children.length) return;
      const box = new THREE.Box3().setFromObject(content);
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      const vHalf = (camera.fov * Math.PI) / 360;
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const dist = (radius / Math.tan(Math.min(vHalf, hHalf))) * 1.02;
      const dir = view === 'plate' ? new THREE.Vector3(0, -0.9, 1.1) : new THREE.Vector3(0.6, -1, -0.55);
      camera.position.copy(center).addScaledVector(dir.normalize(), dist);
      controls.target.copy(center);
      camera.near = dist / 100; camera.far = dist * 10;
      camera.updateProjectionMatrix();
    };

    let lastAspect = 0;
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // re-fit when the shape of the view changes a lot (rotating a phone, resizing the window)
      if (lastAspect && Math.abs(camera.aspect / lastAspect - 1) > 0.15 && ctx.current) frame(ctx.current.view);
      lastAspect = camera.aspect;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    ctx.current = { renderer, scene, camera, controls, content, dark, frame, view: 'plate', lastFrame: '' };

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      content.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
    };
  }, []);

  // rebuild the scene when parts / view / theme change
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const draw = () => {
      const { scene, content } = c;
      content.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      content.clear();
      const isDark = c.dark.matches;
      scene.background = new THREE.Color(isDark ? 0x1b1b1e : 0xf1f1ee);
      const [bw, bh] = bed;
      if (view === 'plate') {
        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(bw, bh),
          new THREE.MeshStandardMaterial({ color: isDark ? 0x28282d : 0xe2e2dd, roughness: 1 }),
        );
        plate.position.z = -0.05;
        content.add(plate);
        const grid = new THREE.GridHelper(Math.max(bw, bh), Math.round(Math.max(bw, bh) / 20), 0x9a9aa0, isDark ? 0x36363c : 0xcbcbc5);
        grid.rotation.x = Math.PI / 2;
        content.add(grid);
      }
      const colors = isDark ? PART_COLORS_DARK : PART_COLORS_LIGHT;
      (parts || []).forEach((p, i) => {
        const isCard = p.name.includes('card');
        const mat = new THREE.MeshStandardMaterial({ color: isCard ? 0xf1f3f5 : colors[i % colors.length], roughness: 0.6, metalness: 0.05 });
        if (isCard && view !== 'plate') { mat.transparent = true; mat.opacity = 0.85; }
        const m = new THREE.Mesh(toGeometry(p.mesh), mat);
        if (view === 'plate') {
          m.position.set(p.x - bw / 2, p.y - bh / 2, 0);
          if (p.rot90) m.rotation.z = Math.PI / 2;
        } else {
          m.position.set(p.asm[0], p.asm[1], p.asm[2] + p.explode);
        }
        content.add(m);
      });
      // re-frame the camera only when the kind of scene changes, not on every slider move
      c.view = view;
      const key = `${view}|${bw}|${frameKey}`;
      if (key !== c.lastFrame && parts?.length) {
        c.lastFrame = key;
        c.frame(view);
      }
    };
    draw();
    c.dark.addEventListener('change', draw);
    return () => c.dark.removeEventListener('change', draw);
  }, [parts, view, bed, frameKey]);

  return <div className="viewer-canvas" ref={hostRef} aria-label="3D preview of the parts" role="img" />;
}
