// Male (external) screw thread built directly as a watertight mesh.
//
// The outer surface is a height field r(theta, z) over a regular (theta, z) grid, which is
// always manifold and avoids fragile helical sweeps / CSG on helices.
//
// Profile: ISO 60-degree metric thread (filter threads are 60-degree, right-hand).
//   radial depth  h  = 0.5413 * p   (5/8 of the fundamental triangle height)
//   crest flat       = p / 8
//   root flat        = p / 4
//   each flank       = 0.3125 * p axially (30 deg from radial)

export function threadDims(nominal, pitch, clearance) {
  const depth = 0.5413 * pitch;
  const rMajor = nominal / 2 - clearance / 2;
  return { depth, rMajor, rRoot: rMajor - depth };
}

// 0..1 radial offset along one pitch, u in [0, 1)
function profile01(u) {
  const root = 1 / 8;            // half of the root flat on each side
  const flank = 0.3125;
  const crest = 1 / 8;
  if (u < root) return 0;
  u -= root;
  if (u < flank) return u / flank;
  u -= flank;
  if (u < crest) return 1;
  u -= crest;
  if (u < flank) return 1 - u / flank;
  return 0;
}

function smoothstep(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

/**
 * Threaded tube: plain bore of radius rInner, threaded outside, from z0 to z1.
 * fadeLo / fadeHi: axial length over which the thread fades into the root at each end
 * (lead-in on the free end, relief at the shoulder end).
 */
export function threadedTube(wasm, { rRoot, depth, pitch, rInner, z0, z1, fadeLo = 0.6, fadeHi = 0.3, segLen = 0.45 }) {
  const { Manifold, Mesh } = wasm;
  let n = Math.ceil((2 * Math.PI * (rRoot + depth)) / segLen);
  n += (4 - (n % 4)) % 4;
  const dz = pitch / 16;
  const nz = Math.max(2, Math.ceil((z1 - z0) / dz) + 1);
  const zs = Array.from({ length: nz }, (_, j) => z0 + ((z1 - z0) * j) / (nz - 1));

  const nOuter = n * nz;
  const verts = new Float32Array((nOuter + 2 * n) * 3);
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n;
    const c = Math.cos(th), s = Math.sin(th);
    for (let j = 0; j < nz; j++) {
      const z = zs[j];
      let u = (z - (pitch * th) / (2 * Math.PI)) / pitch;
      u -= Math.floor(u);
      const fade = Math.min(
        fadeLo > 0 ? smoothstep((z - z0) / fadeLo) : 1,
        fadeHi > 0 ? smoothstep((z1 - z) / fadeHi) : 1,
      );
      const r = rRoot + depth * fade * profile01(u);
      const k = (i * nz + j) * 3;
      verts[k] = r * c; verts[k + 1] = r * s; verts[k + 2] = z;
    }
    const kb = (nOuter + i) * 3, kt = (nOuter + n + i) * 3;
    verts[kb] = rInner * c; verts[kb + 1] = rInner * s; verts[kb + 2] = z0;
    verts[kt] = rInner * c; verts[kt + 1] = rInner * s; verts[kt + 2] = z1;
  }

  const O = (i, j) => (i % n) * nz + j;
  const IB = (i) => nOuter + (i % n);
  const IT = (i) => nOuter + n + (i % n);
  const tris = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < nz - 1; j++) {
      const a = O(i, j), b = O(i + 1, j), c = O(i + 1, j + 1), d = O(i, j + 1);
      tris.push(a, b, c, a, c, d);
    }
    // bore (normal inward)
    tris.push(IB(i), IT(i + 1), IB(i + 1), IB(i), IT(i), IT(i + 1));
    // bottom cap (normal -z)
    tris.push(IB(i), O(i + 1, 0), O(i, 0), IB(i), IB(i + 1), O(i + 1, 0));
    // top cap (normal +z)
    tris.push(IT(i), O(i, nz - 1), O(i + 1, nz - 1), IT(i), O(i + 1, nz - 1), IT(i + 1));
  }
  const mesh = new Mesh({ numProp: 3, vertProperties: verts, triVerts: new Uint32Array(tris) });
  return new Manifold(mesh);
}
