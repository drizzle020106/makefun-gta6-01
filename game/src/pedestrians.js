// Pedestrians: people walking the sidewalks who scatter when they hear
// a gunshot or see a crash, and who can be knocked down (a crime).
import * as THREE from 'three';
import { randomSidewalkPoint } from './city.js';

const PED_COUNT = 30;
const SHIRTS = [0xd95f4b, 0x4b8ad9, 0x6db84b, 0xe8c84b, 0x9b59b6, 0xe8e8e8, 0x333333, 0xd94b8a];

function buildPersonMesh(shirtColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const legs = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), legs);
  legL.position.set(0, 0.35, -0.14);
  legL.name = 'legL';
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), legs);
  legR.position.set(0, 0.35, 0.14);
  legR.name = 'legR';
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), shirt);
  armL.position.set(0, 1.05, -0.38);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), shirt);
  armR.position.set(0, 1.05, 0.38);
  group.add(armR);
  return group;
}

export function createPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    const p = randomSidewalkPoint(rng);
    const mesh = buildPersonMesh(SHIRTS[i % SHIRTS.length]);
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    peds.push({
      mesh,
      x: p.x,
      z: p.z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.8),
      target: randomSidewalkPoint(rng),
      fleeing: 0, // seconds left of panic
      fleeFrom: null,
      down: false,
      downTimer: 0,
      walkPhase: rng.range(0, Math.PI * 2),
    });
  }

  return {
    peds,
    // A loud bang or a crash at (x, z) scares everyone nearby.
    scare(x, z, radius) {
      for (const ped of peds) {
        if (ped.down) continue;
        const d = Math.hypot(ped.x - x, ped.z - z);
        if (d < radius) {
          ped.fleeing = 4 + Math.random() * 2;
          ped.fleeFrom = { x, z };
        }
      }
    },
    update(dt, playerPos) {
      for (const ped of peds) {
        if (ped.down) {
          ped.downTimer -= dt;
          if (ped.downTimer <= 0) {
            ped.down = false;
            ped.mesh.rotation.x = 0;
            ped.mesh.position.y = 0;
            // Get up and walk away from the player.
            ped.target = randomSidewalkPoint(rng);
          }
          continue;
        }
        let tx;
        let tz;
        let speed = ped.speed;
        if (ped.fleeing > 0) {
          ped.fleeing -= dt;
          const dx = ped.x - ped.fleeFrom.x;
          const dz = ped.z - ped.fleeFrom.z;
          const d = Math.hypot(dx, dz) || 1;
          tx = ped.x + (dx / d) * 20;
          tz = ped.z + (dz / d) * 20;
          speed = 5.5;
        } else {
          tx = ped.target.x;
          tz = ped.target.z;
          if (Math.hypot(tx - ped.x, tz - ped.z) < 2) {
            ped.target = randomSidewalkPoint(rng);
            tx = ped.target.x;
            tz = ped.target.z;
          }
        }
        const dx = tx - ped.x;
        const dz = tz - ped.z;
        const dist = Math.hypot(dx, dz) || 1;
        const targetHeading = Math.atan2(dx, dz);
        let dh = targetHeading - ped.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        ped.heading += dh * Math.min(1, dt * 5);
        ped.x += Math.sin(ped.heading) * speed * dt;
        ped.z += Math.cos(ped.heading) * speed * dt;
        ped.walkPhase += dt * speed * 4;
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
        const swing = Math.sin(ped.walkPhase) * 0.45;
        ped.mesh.getObjectByName('legL').rotation.x = swing;
        ped.mesh.getObjectByName('legR').rotation.x = -swing;
      }
    },
    // Knock a pedestrian down (used by car hits and punches).
    knockDown(ped) {
      if (ped.down) return;
      ped.down = true;
      ped.downTimer = 6;
      ped.fleeing = 0;
      ped.mesh.rotation.x = Math.PI / 2;
      ped.mesh.position.y = 0.25;
    },
  };
}

// A one-off standing character (mission giver / target), not a walker.
export function createStandingPerson(scene, shirtColor, x, z, heading = 0) {
  const mesh = buildPersonMesh(shirtColor);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return mesh;
}
