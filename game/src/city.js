// Solmar, the game's own sunny seaside city: a street grid, buildings
// with procedural window textures, a beach and sea to the east, palm
// trees, lamps and a pier. No image files — every texture is drawn on
// a canvas at load time. Also owns building collision boxes.
import * as THREE from 'three';
import { CITY } from './config.js';

const PALETTE = {
  ground: 0xb8b2a2,
  road: 0x3a3f46,
  dash: 0xd8d8c8,
  sand: 0xe6d49b,
  sea: 0x2e7cb5,
  sidewalk: 0xc9c3b2,
  park: 0x6f9e5a,
};

function makeFacadeTexture(base, litRatio, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Slight vertical shading so floors read at a distance.
  const shade = g.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 5; col++) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#20262e';
      g.fillRect(12 + col * 22, 12 + row * 20, 14, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Circle (player / car) vs the building boxes. Returns true on overlap.
export function makeColliderChecker(colliders) {
  return function collides(x, z, radius) {
    if (Math.abs(x) > CITY.WORLD_HALF || Math.abs(z) > CITY.WORLD_HALF) return true;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
        return true;
      }
    }
    return false;
  };
}

// Push a circle out of any overlapping building box. Returns the fixed position.
export function resolveCircleCollision(colliders, x, z, radius) {
  let px = x;
  let pz = z;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const closestX = Math.max(c.minX, Math.min(px, c.maxX));
    const closestZ = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - closestX;
    const dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq < 1e-6) {
        // Centre is inside the box: push out along the smallest axis.
        const pushLeft = px - c.minX;
        const pushRight = c.maxX - px;
        const pushBack = pz - c.minZ;
        const pushFront = c.maxZ - pz;
        const m = Math.min(pushLeft, pushRight, pushBack, pushFront);
        if (m === pushLeft) px = c.minX - radius;
        else if (m === pushRight) px = c.maxX + radius;
        else if (m === pushBack) pz = c.minZ - radius;
        else pz = c.maxZ + radius;
      } else {
        const dist = Math.sqrt(distSq);
        px = closestX + (dx / dist) * radius;
        pz = closestZ + (dz / dist) * radius;
      }
    }
  }
  return { x: px, z: pz };
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Sky, sun and ambient light.
  scene.background = new THREE.Color(0x8ec8e8);
  scene.fog = new THREE.Fog(0x8ec8e8, 260, 620);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9));

  // Ground, roads, sand and sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 700),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.SAND_X + 22, 0.02, 0);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 700),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CITY.SEA_X + 180, 0.04, 0);
  group.add(sea);

  // Road strips + centre dashes, instanced so the whole grid is a few draws.
  const roadGeo = new THREE.BoxGeometry(1, 0.06, 1);
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const roadCount = CITY.ROADS.length * 2;
  const roads = new THREE.InstancedMesh(roadGeo, roadMat, roadCount);
  const m4 = new THREE.Matrix4();
  const span = CITY.ROADS[CITY.ROADS.length - 1] - CITY.ROADS[0] + CITY.ROAD_WIDTH + 60;
  let ri = 0;
  for (const r of CITY.ROADS) {
    m4.makeScale(span, 1, CITY.ROAD_WIDTH);
    m4.setPosition(r, 0.03, 0);
    roads.setMatrixAt(ri++, m4);
    m4.makeScale(CITY.ROAD_WIDTH, 1, span);
    m4.setPosition(0, 0.03, r);
    roads.setMatrixAt(ri++, m4);
  }
  group.add(roads);

  const dashGeo = new THREE.BoxGeometry(3.2, 0.02, 0.5);
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.dash });
  const dashPerRoad = Math.floor(span / 9);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, roadCount * dashPerRoad);
  let di = 0;
  for (const r of CITY.ROADS) {
    for (let k = 0; k < dashPerRoad; k++) {
      const along = -span / 2 + k * 9 + 4;
      m4.makeScale(1, 1, 1);
      m4.setPosition(r, 0.07, along);
      dashes.setMatrixAt(di++, m4);
      m4.makeRotationY(Math.PI / 2);
      m4.setPosition(along, 0.07, r);
      dashes.setMatrixAt(di++, m4);
    }
  }
  dashes.count = di;
  group.add(dashes);

  // Buildings: three height classes, each one InstancedMesh with its own
  // facade texture. Downtown (near the centre) gets the tall class.
  const facades = [
    makeFacadeTexture('#cbb9a0', 0.25, rng),
    makeFacadeTexture('#a8b8c4', 0.35, rng),
    makeFacadeTexture('#9fb4c8', 0.45, rng),
  ];
  // Taller buildings repeat the facade vertically so windows stay
  // floor-sized instead of stretching into huge slabs.
  facades[1].wrapT = THREE.RepeatWrapping;
  facades[1].repeat.y = 1.5;
  facades[2].wrapT = THREE.RepeatWrapping;
  facades[2].repeat.y = 2.5;
  const placements = [[], [], []];
  const blockCentres = [];
  for (let ix = 0; ix < CITY.ROADS.length - 1; ix++) {
    for (let iz = 0; iz < CITY.ROADS.length - 1; iz++) {
      const x0 = CITY.ROADS[ix] + CITY.ROAD_WIDTH / 2 + 3;
      const x1 = CITY.ROADS[ix + 1] - CITY.ROAD_WIDTH / 2 - 3;
      const z0 = CITY.ROADS[iz] + CITY.ROAD_WIDTH / 2 + 3;
      const z1 = CITY.ROADS[iz + 1] - CITY.ROAD_WIDTH / 2 - 3;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      blockCentres.push({ cx, cz, x0, x1, z0, z1, ix, iz });
    }
  }

  // Two special blocks: a park and an open-air parking lot (no buildings).
  const parkBlock = blockCentres.find((b) => b.ix === 1 && b.iz === 4);
  const lotBlock = blockCentres.find((b) => b.ix === 4 && b.iz === 2);
  for (const b of blockCentres) {
    // Sidewalk slab for every block.
    box(b.x1 - b.x0 + 4, 0.24, b.z1 - b.z0 + 4, PALETTE.sidewalk, b.cx, 0.12, b.cz, group);
    if (b === parkBlock) {
      box(b.x1 - b.x0, 0.3, b.z1 - b.z0, PALETTE.park, b.cx, 0.15, b.cz, group);
      continue;
    }
    if (b === lotBlock) continue; // parking lot, cars live in vehicles.js
    const downtown = Math.abs(b.cx) < 70 && Math.abs(b.cz) < 70;
    const count = rng.int(1, 2);
    for (let k = 0; k < count; k++) {
      const w = rng.range(10, 18);
      const d = rng.range(10, 18);
      const h = downtown ? rng.range(26, 46) : rng.range(8, 24);
      const bx = rng.range(b.x0 + w / 2, b.x1 - w / 2);
      const bz = rng.range(b.z0 + d / 2, b.z1 - d / 2);
      const cls = h > 26 ? 2 : h > 15 ? 1 : 0;
      placements[cls].push({ x: bx, z: bz, w, d, h });
      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
    }
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const tint = new THREE.Color();
  placements.forEach((list, cls) => {
    if (list.length === 0) return;
    const mat = new THREE.MeshLambertMaterial({ map: facades[cls] });
    const mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach((p, i) => {
      m4.makeScale(p.w, p.h, p.d);
      m4.setPosition(p.x, p.h / 2 + 0.24, p.z);
      mesh.setMatrixAt(i, m4);
      tint.setHSL(rng.range(0, 1), 0.12, rng.range(0.55, 0.8));
      mesh.setColorAt(i, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  });

  // The Marina Hotel: one tall landmark tower on the beachfront block.
  const hotel = box(20, 52, 16, 0xe8dcc0, 186, 26.2, 87, group);
  hotel.material = new THREE.MeshLambertMaterial({ map: facades[2], color: 0xffffff });
  colliders.push({ minX: 176, maxX: 196, minZ: 79, maxZ: 95 });

  // Palm trees: instanced trunks + fronds along the beach and the park.
  const palmSpots = [];
  for (let z = -200; z <= 200; z += 26) {
    palmSpots.push({ x: CITY.SAND_X + 8 + rng.range(-2, 2), z: z + rng.range(-6, 6) });
    if (rng.chance(0.4)) palmSpots.push({ x: 192 + rng.range(-2, 2), z: z + rng.range(-4, 4) });
  }
  for (let i = 0; i < 10; i++) {
    palmSpots.push({
      x: rng.range(parkBlock.x0 + 4, parkBlock.x1 - 4),
      z: rng.range(parkBlock.z0 + 4, parkBlock.z1 - 4),
    });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.ConeGeometry(0.9, 4.4, 4);
  frondGeo.rotateX(Math.PI / 2.4);
  frondGeo.translate(0, 6.4, 1.4);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 5);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  palmSpots.forEach((p, i) => {
    v.set(p.x, 3, p.z);
    q.identity();
    m4.compose(v, q, s);
    trunks.setMatrixAt(i, m4);
    for (let f = 0; f < 5; f++) {
      e.set(0, (f / 5) * Math.PI * 2 + rng.next(), 0);
      q.setFromEuler(e);
      v.set(p.x, 0, p.z);
      m4.compose(v, q, s);
      fronds.setMatrixAt(i * 5 + f, m4);
    }
  });
  group.add(trunks);
  group.add(fronds);

  // Street lamps along every road, instanced.
  const lampSpots = [];
  for (const r of CITY.ROADS) {
    for (let along = -180; along <= 180; along += 58) {
      lampSpots.push({ x: r + CITY.ROAD_WIDTH / 2 + 1.2, z: along });
      lampSpots.push({ x: along, z: r + CITY.ROAD_WIDTH / 2 + 1.2 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c3138 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach((p, i) => {
    v.set(p.x, 2.7, p.z);
    q.identity();
    m4.compose(v, q, s);
    poles.setMatrixAt(i, m4);
    v.set(p.x, 5.5, p.z);
    m4.compose(v, q, s);
    heads.setMatrixAt(i, m4);
  });
  group.add(poles);
  group.add(heads);

  // The pier: wooden deck running out into the sea at z = 58. Low
  // enough that a player standing on it is not sunk to the knees.
  for (let x = 202; x <= 268; x += 6) {
    box(6, 0.24, 8, 0x9a7b52, x, 0.12, 58, group);
  }
  box(2, 1.4, 8, 0x7a5f3e, 268, 0.7, 58, group);

  return {
    colliders,
    collides: makeColliderChecker(colliders),
    resolveCircle: (x, z, radius) => resolveCircleCollision(colliders, x, z, radius),
    parkBlock,
    lotBlock,
  };
}

// A random point on a sidewalk next to a road (for pedestrians).
export function randomSidewalkPoint(rng) {
  const road = CITY.ROADS[Math.floor(rng.next() * CITY.ROADS.length)];
  const along = rng.range(-180, 180);
  const side = rng.chance(0.5) ? 1 : -1;
  if (rng.chance(0.5)) return { x: road + side * (CITY.ROAD_WIDTH / 2 + 2.5), z: along };
  return { x: along, z: road + side * (CITY.ROAD_WIDTH / 2 + 2.5) };
}
