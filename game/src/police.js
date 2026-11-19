// The wanted system: stars 1–5, police cars that chase and ram, foot
// cops that chase and try to bust the player, and the cool-down that
// lets a star fade when the player stays out of sight.
import * as THREE from 'three';
import { WANTED, CITY } from './config.js';
import { createCar } from './vehicles.js';

export function createPolice(scene, rng) {
  const copCars = [];
  const footCops = [];
  let bustHold = 0;

  function spawnCopCarNear(px, pz) {
    const road = CITY.ROADS[Math.floor(rng.next() * CITY.ROADS.length)];
    const along = rng.range(-160, 160);
    const vertical = rng.chance(0.5);
    const x = vertical ? road : along;
    const z = vertical ? along : road;
    // Don't spawn on top of the player.
    if (Math.hypot(x - px, z - pz) < 40) return null;
    const car = createCar(0x1a1a1a, x, z, Math.atan2(px - x, pz - z), true);
    car.isPolice = true;
    car.cruise = 20;
    scene.add(car.group);
    copCars.push(car);
    return car;
  }

  function spawnFootCopNear(px, pz) {
    const x = px + rng.range(-25, 25);
    const z = pz + rng.range(-25, 25);
    const group = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.34), navy);
    torso.position.y = 1.05;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.y = 1.65;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10), navy);
    cap.position.y = 1.85;
    group.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), navy);
    legL.position.set(0, 0.35, -0.14);
    legL.name = 'legL';
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), navy);
    legR.position.set(0, 0.35, 0.14);
    legR.name = 'legR';
    group.add(legR);
    group.position.set(x, 0, z);
    scene.add(group);
    const cop = { mesh: group, x, z, heading: 0, speed: 6.2, walkPhase: 0 };
    footCops.push(cop);
    return cop;
  }

  function removeCop(car) {
    scene.remove(car.group);
    const i = copCars.indexOf(car);
    if (i !== -1) copCars.splice(i, 1);
  }

  function removeFootCop(cop) {
    scene.remove(cop.mesh);
    const i = footCops.indexOf(cop);
    if (i !== -1) footCops.splice(i, 1);
  }

  return {
    copCars,
    footCops,
    // Match the on-duty force to the wanted level.
    syncToWanted(stars, px, pz) {
      const wantCars = WANTED.COP_CARS[stars];
      const wantFoot = WANTED.FOOT_COPS[stars];
      while (copCars.length < wantCars) {
        if (!spawnCopCarNear(px, pz)) break;
      }
      while (copCars.length > wantCars) removeCop(copCars[copCars.length - 1]);
      while (footCops.length < wantFoot) spawnFootCopNear(px, pz);
      while (footCops.length > wantFoot) removeFootCop(footCops[footCops.length - 1]);
    },
    // Chase the player. Returns 'busted' when a foot cop holds the player,
    // or an object describing rams the player car took this frame.
    update(dt, stars, player, playerCar, collides) {
      const result = { busted: false, rammed: false };
      if (stars === 0) return result;
      const copSpeed = WANTED.COP_CAR_SPEED[stars];
      for (const car of copCars) {
        const tx = playerCar ? playerCar.x : player.x;
        const tz = playerCar ? playerCar.z : player.z;
        const dx = tx - car.x;
        const dz = tz - car.z;
        const dist = Math.hypot(dx, dz) || 1;
        const targetHeading = Math.atan2(dx, dz);
        let dh = targetHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        car.heading += dh * Math.min(1, dt * 2.2);
        car.speed += (copSpeed - car.speed) * Math.min(1, dt * 1.2);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        if (!collides(nx, nz, 1.6)) {
          car.x = nx;
          car.z = nz;
        } else {
          car.speed *= 0.5;
        }
        car.sync();
        // Ram: touching the player's car shoves it and hurts the player.
        // One shove per cop per 0.8 s — a ram is a hit, not a snowplow.
        car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
        if (playerCar && dist < 4.6 && car.ramCooldown <= 0) {
          car.ramCooldown = 0.8;
          result.rammed = true;
          playerCar.speed *= 0.92;
          playerCar.x += (dx / dist) * -1.0;
          playerCar.z += (dz / dist) * -1.0;
        }
        // Flash the light bar.
        const bar = car.group.getObjectByName('lightbar');
        if (bar) bar.material.color.setHex(Math.floor(performance.now() / 250) % 2 ? 0xff2a2a : 0x2a5bff);
      }
      let anyClose = false;
      for (const cop of footCops) {
        const dx = player.x - cop.x;
        const dz = player.z - cop.z;
        const dist = Math.hypot(dx, dz) || 1;
        const targetHeading = Math.atan2(dx, dz);
        let dh = targetHeading - cop.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        cop.heading += dh * Math.min(1, dt * 6);
        // Cops on foot only chase a player on foot, and slower than a car.
        if (!playerCar) {
          cop.x += Math.sin(cop.heading) * cop.speed * dt;
          cop.z += Math.cos(cop.heading) * cop.speed * dt;
        }
        cop.walkPhase += dt * 8;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
        const swing = Math.sin(cop.walkPhase) * 0.5;
        cop.mesh.getObjectByName('legL').rotation.x = swing;
        cop.mesh.getObjectByName('legR').rotation.x = -swing;
        if (!playerCar && dist < WANTED.BUST_RADIUS) anyClose = true;
      }
      if (anyClose) {
        bustHold += dt;
        if (bustHold >= WANTED.BUST_HOLD_SECONDS) {
          bustHold = 0;
          result.busted = true;
        }
      } else {
        bustHold = Math.max(0, bustHold - dt * 2);
      }
      return result;
    },
    clearAll() {
      while (copCars.length) removeCop(copCars[0]);
      while (footCops.length) removeFootCop(footCops[0]);
      bustHold = 0;
    },
  };
}
