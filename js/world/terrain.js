// Real terrain for the Alameda drive.
//
// assets/bay-dem.png holds the surveyed height of the land round San Francisco Bay (see tools/fetch-elevation.ps1).
// The game's map is a compressed sketch of the real one - a 34 km loop standing in for about 80 km of road - so the
// survey is fitted to it: named points on the route (the house, the tube mouths, the bridge ends, Hyde Street, Shane
// Drive...) are tied to their real longitude and latitude, and everything between is warped to suit. From that come
//   - the hills themselves, as a mesh built in 640 m tiles, nearest first, a few milliseconds a frame while you drive
//     (flat where the real ground is flat, as Alameda is; rising where it rises, as in the city, Marin and the East Bay)
//   - the horizon: the true skyline seen from where the car is, redrawn as you move.
// Ground within reach of the road, and under anything the game has built, is left level so nothing is buried.
import * as THREE from 'three';

// ---- the survey
const LON0 = -122.6953125, LON1 = -121.9921875, TY0 = 789, TYN = 4, ZN = 2048;      // zoom-11 tiles 326-329 x 789-792
const DEM = { w: 0, h: 0, d: null };
async function load(url) {
  // fetched and decoded off the page, so it also works when the tab is in the background
  const img = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data, d = new Float32Array(c.width * c.height);
  for (let i = 0; i < d.length; i++) { const v = px[i * 4] / 255; d[i] = v * v * 1000; }
  DEM.w = c.width; DEM.h = c.height; DEM.d = d;
}
function demAt(lon, lat) {
  const w = DEM.w, h = DEM.h; if (!w) return 0;
  let fx = (lon - LON0) / (LON1 - LON0) * w - 0.5;
  let fy = ((1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * ZN - TY0) / TYN * h - 0.5;
  fx = fx < 0 ? 0 : fx > w - 1.001 ? w - 1.001 : fx; fy = fy < 0 ? 0 : fy > h - 1.001 ? h - 1.001 : fy;
  const ix = fx | 0, iy = fy | 0, a = fx - ix, b = fy - iy, i = iy * w + ix, d = DEM.d;
  return (d[i] * (1 - a) + d[i + 1] * a) * (1 - b) + (d[i + w] * (1 - a) + d[i + w + 1] * a) * b;
}

// ---- tying the game's map to the real one: [latitude, longitude] of the named points on the route
const REAL = {
  start: [37.7686, -122.2650], paru: [37.7690, -122.2685], central: [37.7735, -122.2720], wilma: [37.7800, -122.2775], tu0: [37.7862, -122.2772], tu1: [37.7962, -122.2735],
  i880: [37.7990, -122.2800], detour: [37.8180, -122.2950], toll: [37.8255, -122.3150], b0: [37.8215, -122.3300], b1: [37.7870, -122.3900], downtown: [37.7900, -122.4000],
  hyde: [37.7950, -122.4175], marina: [37.8065, -122.4205], gg0: [37.8075, -122.4750], gg1: [37.8325, -122.4795], woods: [37.8600, -122.4950], sq: [37.9385, -122.4900],
  rb0: [37.9420, -122.4770], rb1: [37.9300, -122.4080], richmond: [37.9350, -122.3900], shane: [37.9730, -122.3360], i80: [37.9300, -122.3250], berkeley: [37.8680, -122.3040],
  emeryville: [37.8380, -122.2960], oakland: [37.8080, -122.2850], wt1: [37.7955, -122.2760], wt0: [37.7850, -122.2790], bv: [37.7790, -122.2600],
};
const CPX = [], CPZ = [], RLON = [], RLAT = [], AF = new Float64Array(6); let HS = 0.6, KREAL = 1.7;
function solve3(A, b) {   // 3 x 3 linear system
  const m = [A[0].concat(b[0]), A[1].concat(b[1]), A[2].concat(b[2])];
  for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r; [m[i], m[p]] = [m[p], m[i]];
    for (let r = 0; r < 3; r++) if (r !== i) { const f = m[r][i] / m[i][i]; for (let c = i; c < 4; c++) m[r][c] -= f * m[i][c]; } }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}
function georef(marks) {   // marks: {name: [x, z]} in game metres
  const P = []; for (const k in REAL) if (marks[k]) P.push([marks[k][0], marks[k][1], REAL[k][1], REAL[k][0]]);
  // best straight fit first (least squares): lon = a0 + a1 x + a2 z, lat = a3 + a4 x + a5 z
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bl = [0, 0, 0], bt = [0, 0, 0];
  for (const [x, z, lon, lat] of P) { const v = [1, x, z]; for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; bl[i] += v[i] * lon; bt[i] += v[i] * lat; } }
  const sl = solve3(A.map(r => r.slice()), bl), st = solve3(A.map(r => r.slice()), bt); AF.set([sl[0], sl[1], sl[2], st[0], st[1], st[2]]);
  // ...then what is left over at each named point, to be spread smoothly between them
  for (const [x, z, lon, lat] of P) { CPX.push(x); CPZ.push(z); RLON.push(lon - (AF[0] + AF[1] * x + AF[2] * z)); RLAT.push(lat - (AF[3] + AF[4] * x + AF[5] * z)); }
  const mx = 87900, my = 111320, det = Math.abs(AF[1] * mx * AF[5] * my - AF[2] * mx * AF[4] * my);
  KREAL = Math.sqrt(det); HS = 1.15 / KREAL;      // real metres to a game metre; heights shrink with the map, and a little less, so the hills still read
}
const GEO = [0, 0];
function toGeo(x, z) {
  let sw = 0, dl = 0, dt = 0;
  for (let i = 0; i < CPX.length; i++) { const dx = x - CPX[i], dz = z - CPZ[i], w = 1 / (dx * dx + dz * dz + 90000); sw += w * w; dl += w * w * RLON[i]; dt += w * w * RLAT[i]; }
  const far = sw > 0 ? 1 : 0; GEO[0] = AF[0] + AF[1] * x + AF[2] * z + far * dl / sw; GEO[1] = AF[3] + AF[4] * x + AF[5] * z + far * dt / sw; return GEO;
}
// surveyed height at a point of the game's map, in game metres
const elev = (x, z) => { const g = toGeo(x, z); return demAt(g[0], g[1]) * HS; };

// ---- where the hills may stand: on the game's land, clear of the road and of anything built
const LAND = [];
const addLand = (pts, kind) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } LAND.push({ pts, kind, x0, x1, z0, z1 }); };
const sst = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function landAt(x, z) {   // 0 at sea; otherwise how far inland (0..1 over the first 160 m), and which piece of land
  for (let k = 0; k < LAND.length; k++) { const L = LAND[k]; if (x < L.x0 || x > L.x1 || z < L.z0 || z > L.z1) continue;
    const p = L.pts, n = p.length; let inside = false, dmin = 1e18;
    for (let i = 0, j = n - 1; i < n; j = i++) { const ax = p[i][0], az = p[i][1], bx = p[j][0], bz = p[j][1];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
      const ex = bx - ax, ez = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))), qx = ax + ex * t - x, qz = az + ez * t - z, d = qx * qx + qz * qz; if (d < dmin) dmin = d; }
    if (inside) { landAt.kind = L.kind; return sst(Math.sqrt(dmin), 10, 170); } }
  return 0;
}
const CELL = 40, GX0 = -9480, GZ0 = -13080, GNX = 346, GNZ = 340;
const roadD = new Float32Array(GNX * GNZ).fill(1e9), occD = new Float32Array(GNX * GNZ).fill(1e9);
function spread(D) {   // distance from the marked cells to every other cell (two sweeps)
  const a = CELL, b = CELL * 1.4142;
  for (let z = 0; z < GNZ; z++) for (let x = 0; x < GNX; x++) { const i = z * GNX + x; let v = D[i];
    if (x > 0) v = Math.min(v, D[i - 1] + a); if (z > 0) { v = Math.min(v, D[i - GNX] + a); if (x > 0) v = Math.min(v, D[i - GNX - 1] + b); if (x < GNX - 1) v = Math.min(v, D[i - GNX + 1] + b); } D[i] = v; }
  for (let z = GNZ - 1; z >= 0; z--) for (let x = GNX - 1; x >= 0; x--) { const i = z * GNX + x; let v = D[i];
    if (x < GNX - 1) v = Math.min(v, D[i + 1] + a); if (z < GNZ - 1) { v = Math.min(v, D[i + GNX] + a); if (x < GNX - 1) v = Math.min(v, D[i + GNX + 1] + b); if (x > 0) v = Math.min(v, D[i + GNX - 1] + b); } D[i] = v; }
}
const mark = (D, x, z) => { const cx = Math.floor((x - GX0) / CELL), cz = Math.floor((z - GZ0) / CELL); if (cx >= 0 && cz >= 0 && cx < GNX && cz < GNZ) D[cz * GNX + cx] = 0; };
function gridAt(D, x, z) {
  let fx = (x - GX0) / CELL - 0.5, fz = (z - GZ0) / CELL - 0.5; if (fx < 0 || fz < 0 || fx > GNX - 1.001 || fz > GNZ - 1.001) return 1e9;
  const ix = fx | 0, iz = fz | 0, a = fx - ix, b = fz - iz, i = iz * GNX + ix; return (D[i] * (1 - a) + D[i + 1] * a) * (1 - b) + (D[i + GNX] * (1 - a) + D[i + GNX + 1] * a) * b;
}
function setRoad(P, n) { for (let i = 0; i < n; i++) mark(roadD, P[i].x, P[i].z); spread(roadD); }
// Everything the game has built keeps level ground under it: mark the footprint of each object that is not itself landscape.
const BX = new THREE.Box3();
function occupy(objs) {
  for (const o of objs) { if (o.isInstancedMesh || o.isLight) continue; BX.setFromObject(o); if (BX.isEmpty()) continue;
    const sx = BX.max.x - BX.min.x, sz = BX.max.z - BX.min.z; if (sx > 520 || sz > 520) continue;      // roads, land and sea are not obstacles
    for (let x = BX.min.x; x <= BX.max.x + CELL; x += CELL) for (let z = BX.min.z; z <= BX.max.z + CELL; z += CELL) mark(occD, Math.min(x, BX.max.x), Math.min(z, BX.max.z)); }
  spread(occD);
}
// height of the hills at a point (0 where the ground is level)
function heightAt(x, z) {
  const lm = landAt(x, z); if (lm <= 0) return 0;
  const m = lm * sst(gridAt(roadD, x, z), 70, 400) * sst(gridAt(occD, x, z), 50, 260); if (m <= 0.001) return 0;
  return elev(x, z) * m;
}

// ---- the mesh, in tiles
const TILE = 640, NC = TILE / CELL, NV = NC + 1, NB = NV + 2;
const HB = new Float32Array(NB * NB), KB = new Uint8Array(NB * NB);
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, a = fx * fx * (3 - 2 * fx), b = fz * fz * (3 - 2 * fz);
  return (hash(ix, iz) * (1 - a) + hash(ix + 1, iz) * a) * (1 - b) + (hash(ix, iz + 1) * (1 - a) + hash(ix + 1, iz + 1) * a) * b; };
const T = { scene: null, cull: null, mats: null, queue: [], built: 0, total: 0, sortT: 0 };
function buildTile(tx, tz) {
  const x0 = tx * TILE, z0 = tz * TILE; let any = false, urban = 0, land = 0;
  for (let j = 0; j < NB; j++) for (let i = 0; i < NB; i++) { const h = heightAt(x0 + (i - 1) * CELL, z0 + (j - 1) * CELL); HB[j * NB + i] = h; KB[j * NB + i] = landAt.kind === 'urban' ? 1 : 0; if (h > 0.35) { any = true; if (KB[j * NB + i]) urban++; else land++; } }
  if (!any) return null;
  const city = urban > land, pos = [], nor = [], col = [], uv = [], idx = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) { const q = (j + 1) * NB + i + 1, h = HB[q], x = x0 + i * CELL, z = z0 + j * CELL;
    const nx = HB[q - 1] - HB[q + 1], nz = HB[q - NB] - HB[q + NB], il = 1 / Math.hypot(nx, 2 * CELL, nz), ny = 2 * CELL * il;
    pos.push(x, h + 0.06, z); nor.push(nx * il, ny, nz * il); uv.push(x / 8, z / 8);
    const steep = 1 - sst(ny, 0.82, 0.97), n1 = noise(x / 310, z / 310), n2 = noise(x / 90 + 7, z / 90 + 3);
    if (city) { const v = 0.82 + 0.3 * n2; col.push(v, v, v * 1.02); }
    else { // dry golden grass on the open tops, oak and bay woodland in the folds and on the shaded sides, bare earth where it is steep
      const gold = sst(h, 12, 110) * (1 - 0.55 * sst(n1 + nx * il * 1.5, 0.45, 0.75)), wood = sst(n1 * 0.7 + n2 * 0.3 + nz * il, 0.5, 0.68) * sst(h, 6, 40);
      let r = 1 + 0.75 * gold, g = 1 + 0.42 * gold, b = 1 - 0.1 * gold; r = r * (1 - wood) + 0.5 * wood; g = g * (1 - wood) + 0.74 * wood; b = b * (1 - wood) + 0.6 * wood;
      const k = 0.9 + 0.2 * n2; col.push((r * (1 - steep) + 1.25 * steep) * k, (g * (1 - steep) + 1.02 * steep) * k, (b * (1 - steep) + 0.8 * steep) * k); } }
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) { const a = j * NV + i, q = (j + 1) * NB + i + 1;
    if (Math.max(HB[q], HB[q + 1], HB[q + NB], HB[q + NB + 1]) < 0.35) continue; idx.push(a, a + NV, a + 1, a + 1, a + NV, a + NV + 1); }
  // things standing on the hills, in the same mesh so they cost nothing extra to draw: trees on open land, houses in the city
  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, r, g, b) => { const o = pos.length / 3; pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz); for (let k = 0; k < 4; k++) { nor.push(nx, ny, nz); col.push(r, g, b); uv.push(0.5, 0.5); } idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  const count = city ? 150 : 110;
  for (let k = 0; k < count; k++) { const rx = hash(tx * 13.1 + k * 1.7, tz * 7.3 + k), rz = hash(tx * 3.7 + k, tz * 17.9 + k * 2.3), x = x0 + rx * TILE, z = z0 + rz * TILE;
    const fi = rx * NC, fj = rz * NC, i = Math.min(NC - 1, fi | 0), j = Math.min(NC - 1, fj | 0), a = fi - i, b = fj - j, q = (j + 1) * NB + i + 1;
    const y = (HB[q] * (1 - a) + HB[q + 1] * a) * (1 - b) + (HB[q + NB] * (1 - a) + HB[q + NB + 1] * a) * b, lo = Math.min(HB[q], HB[q + 1], HB[q + NB], HB[q + NB + 1]);
    if (lo < 2.5) continue; const r3 = hash(k * 5.1 + tx, k * 9.7 + tz);
    if (city) { // a house: four walls and a flat roof, in the pale colours of the city's hills
      const w = 9 + r3 * 9, d = 9 + hash(k, tx + tz) * 8, hh = 6 + hash(tz, k * 3.3) * 9, yb = lo - 1, yt = y + hh, tints = [[1.9, 1.85, 1.7], [1.75, 1.8, 1.85], [1.9, 1.7, 1.55], [1.6, 1.75, 1.6], [2, 1.95, 1.85]], c = tints[(r3 * 5) | 0];
      quad(x - w, yb, z + d, x + w, yb, z + d, x + w, yt, z + d, x - w, yt, z + d, 0, 0, 1, c[0], c[1], c[2]); quad(x + w, yb, z - d, x - w, yb, z - d, x - w, yt, z - d, x + w, yt, z - d, 0, 0, -1, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8);
      quad(x + w, yb, z + d, x + w, yb, z - d, x + w, yt, z - d, x + w, yt, z + d, 1, 0, 0, c[0] * 0.9, c[1] * 0.9, c[2] * 0.9); quad(x - w, yb, z - d, x - w, yb, z + d, x - w, yt, z + d, x - w, yt, z - d, -1, 0, 0, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7);
      quad(x - w, yt, z + d, x + w, yt, z + d, x + w, yt, z - d, x - w, yt, z - d, 0, 1, 0, 0.9, 0.86, 0.82); }
    else { // a tree: only where the colouring above has put woodland, so the tops stay open grass
      const n1 = noise(x / 310, z / 310), n2 = noise(x / 90 + 7, z / 90 + 3); if (n1 * 0.7 + n2 * 0.3 < 0.47 + r3 * 0.1) continue;
      const rad = 5 + r3 * 5, th = rad * (1.5 + hash(k, tz) * 0.9), o = pos.length / 3, g0 = 0.42 + r3 * 0.2;
      for (let s = 0; s < 6; s++) { const an = s * Math.PI / 3, cx = Math.cos(an), sz = Math.sin(an); pos.push(x + cx * rad, y - 1 + th * 0.35, z + sz * rad); nor.push(cx * 0.8, 0.6, sz * 0.8); col.push(g0 * 0.75, g0 * 1.15, g0 * 0.7); uv.push(0.5, 0.5); }
      pos.push(x, y + th, z, x, y - 1, z); nor.push(0, 1, 0, 0, -1, 0); col.push(g0, g0 * 1.5, g0 * 0.9, g0 * 0.5, g0 * 0.8, g0 * 0.5); uv.push(0.5, 0.5, 0.5, 0.5);
      for (let s = 0; s < 6; s++) { const s2 = (s + 1) % 6; idx.push(o + s, o + 6, o + s2, o + s2, o + 7, o + s); } } }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
  const me = new THREE.Mesh(geo, city ? T.mats.city : T.mats.land); me.receiveShadow = true; me.matrixAutoUpdate = false; T.scene.add(me); T.cull.push(me); return me;
}
// Queue every tile that has land in it. They are built by pump(), nearest to the car first.
function start(scene, cull, landMats, grassTex) {
  const tex = grassTex.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 1); tex.needsUpdate = true;
  T.scene = scene; T.cull = cull;
  T.mats = { land: new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }), city: new THREE.MeshStandardMaterial({ color: 0x5d5f61, vertexColors: true, roughness: 0.95 }) };
  landMats.push(T.mats.land, T.mats.city);
  for (const L of LAND) for (let tx = Math.floor(L.x0 / TILE); tx * TILE < L.x1; tx++) for (let tz = Math.floor(L.z0 / TILE); tz * TILE < L.z1; tz++) if (!T.queue.some(q => q.tx === tx && q.tz === tz)) T.queue.push({ tx, tz, d: 0 });
  T.total = T.queue.length;
}
// Build tiles for up to `ms` milliseconds (always at least one). Returns how many are still to do.
function pump(cx, cz, ms) {
  const q = T.queue; if (!q.length) return 0;
  if (--T.sortT <= 0) { T.sortT = 40; for (const t of q) t.d = (t.tx * TILE + TILE / 2 - cx) ** 2 + (t.tz * TILE + TILE / 2 - cz) ** 2; q.sort((a, b) => b.d - a.d); }
  const t0 = performance.now(); do { const t = q.pop(); buildTile(t.tx, t.tz); T.built++; } while (q.length && performance.now() - t0 < ms);
  return q.length;
}

// ---- the horizon: the real skyline from where the car is, drawn onto the strip of sky behind everything
const PAN = { c: null, g: null, tex: null, x: 1e9, z: 1e9, W: 2048, Hh: 256, N: 1024, R: 3000, span: 300, base: 55 };
const BAND = [new Float32Array(1025), new Float32Array(1025), new Float32Array(1025)];
function panorama() {
  PAN.c = document.createElement('canvas'); PAN.c.width = PAN.W; PAN.c.height = PAN.Hh; PAN.g = PAN.c.getContext('2d');
  PAN.tex = new THREE.CanvasTexture(PAN.c); PAN.tex.colorSpace = THREE.SRGBColorSpace; PAN.tex.wrapS = THREE.RepeatWrapping; return PAN.tex;
}
// Redraw the skyline if the car has moved far enough for it to look different. eye: height of the camera.
function updatePanorama(x, z, eye) {
  if (!PAN.g || (x - PAN.x) ** 2 + (z - PAN.z) ** 2 < 300 * 300) return false; PAN.x = x; PAN.z = z;
  const N = PAN.N, g = PAN.g, W = PAN.W, Hh = PAN.Hh, EX = 1.5, curve = KREAL * KREAL / (2 * 6371000) * HS;
  for (let c = 0; c <= N; c++) { const th = c / N * Math.PI * 2, dx = Math.sin(th), dz = Math.cos(th); let a0 = -1, a1 = -1, a2 = -1;
    for (let d = 1700; d < 46000; d *= 1.05) { const h = elev(x + dx * d, z + dz * d); if (h <= 0.5) continue; const a = (h - eye - curve * d * d) / d; if (d < 5000) { if (a > a0) a0 = a; } else if (d < 13000) { if (a > a1) a1 = a; } else if (a > a2) a2 = a; }
    BAND[0][c] = a0; BAND[1][c] = a1; BAND[2][c] = a2; }
  g.clearRect(0, 0, W, Hh);
  const row = a => Hh - (PAN.base + PAN.R * Math.tan(Math.max(-0.01, a) * EX)) * (Hh / PAN.span);
  const layers = [[2, '#a9b8b6'], [1, '#8b9d92'], [0, '#6f8672']];   // furthest ridges first, paler with distance
  for (const [b, colr] of layers) { const A = BAND[b]; g.fillStyle = colr; g.beginPath(); g.moveTo(0, Hh);
    for (let c = 0; c <= N; c++) { const s = (A[Math.max(0, c - 1)] + A[c] * 2 + A[Math.min(N, c + 1)]) / 4; g.lineTo(c / N * W, Math.min(Hh, row(s))); }
    g.lineTo(W, Hh); g.fill(); }
  PAN.tex.needsUpdate = true; return true;
}

export const Terrain = { load, georef, addLand, setRoad, occupy, heightAt, landAt, elev, start, pump, panorama, updatePanorama, state: T, info: () => ({ scale: KREAL, heightScale: HS, tiles: T.built, left: T.queue.length }) };
