// Solmar — boot and the one game loop. Owns the player, the camera, the
// wanted level, crime, entering/exiting cars, health, saving and the
// title / pause / busted / wasted screens. The world itself lives in
// city.js, vehicles.js, traffic.js, pedestrians.js, police.js and
// missions.js; this file only wires them together.
// ?seed=N fixes the city layout. ?shot=cover|street|chase|mission stages
// a scene for a screenshot and sets window.__shotReady when it is ready.
import * as THREE from 'three';
import { CITY, PLAYER, WANTED, CAR } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_PAUSE, ACTION_MISSION, ACTION_RESTART } from './input.js';
import { buildCity } from './city.js';
import { createCar, spawnParkedCars, CAR_COLORS } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians, createStandingPerson } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud, showScreen } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotKind = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = createRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const city = buildCity(scene, rng);
const parkedCars = spawnParkedCars(scene, rng, city.lotBlock);
const traffic = createTraffic(scene, rng);
const pedestrians = createPedestrians(scene, rng);
const police = createPolice(scene, rng);
const missions = createMissions(scene, rng);
const combat = createCombat(scene, camera);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

// ---- The player -------------------------------------------------------
function buildPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a9d8f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), jacket);
  torso.position.y = 1.06;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.64;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 12),
    new THREE.MeshLambertMaterial({ color: 0xe76f51 }));
  cap.position.y = 1.84;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.72, 0.23), pants);
  legL.position.set(0, 0.36, -0.15);
  legL.name = 'legL';
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.72, 0.23), pants);
  legR.position.set(0, 0.36, 0.15);
  legR.name = 'legR';
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.17), jacket);
  armL.position.set(0, 1.06, -0.4);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.17), jacket);
  armR.position.set(0, 1.06, 0.4);
  group.add(armR);
  return group;
}

const playerMesh = buildPlayerMesh();
scene.add(playerMesh);

const save = loadSave();
const player = {
  x: save?.pos ? save.pos[0] : 10,
  y: 0,
  z: save?.pos ? save.pos[2] : 10,
  heading: 0,
  health: save?.health ?? PLAYER.MAX_HEALTH,
  money: save?.money ?? 0,
  walkPhase: 0,
  moving: false,
};
if (save) missions.state.index = save.missionsDone;

let state = 'title'; // title | play | paused | busted | wasted
let playerCar = null;
let wanted = 0;
let lastCrimeAt = -10;
let coolTimer = 0;
let ramDamageAt = -10;
let shootCooldown = 0;
let saveTimer = 0;
let elapsed = 0;
let framesRendered = 0;
let camYaw = Math.PI;
let camPitch = 0.32;
let camDragOffset = 0;
let autoDrive = false;

// Register every pedestrian as a shootable / punchable target.
for (const ped of pedestrians.peds) {
  combat.register(ped.mesh, 'ped', ped);
}

function addWanted(stars) {
  if (elapsed - lastCrimeAt < 3) return;
  lastCrimeAt = elapsed;
  coolTimer = 0;
  wanted = Math.min(WANTED.MAX_STARS, wanted + stars);
  police.syncToWanted(wanted, player.x, player.z);
  audio.setSirenOn(wanted > 0);
}

function damagePlayer(amount, cause) {
  player.health -= amount;
  hud.setVignette(true);
  setTimeout(() => hud.setVignette(false), 250);
  if (player.health <= 0) {
    player.health = 0;
    wanted = 0;
    police.clearAll();
    audio.setSirenOn(false);
    if (cause === 'busted') {
      state = 'busted';
      player.money = Math.max(0, player.money - 100);
      document.getElementById('busted-info').textContent =
        `The cops caught up with you. You paid a $100 fine and lost the heat. Cash: $${player.money}.`;
      showScreen('busted');
    } else {
      state = 'wasted';
      player.money = Math.max(0, player.money - 150);
      document.getElementById('wasted-info').textContent =
        `You woke up at Solmar General. The hospital bill was $150. Cash: $${player.money}.`;
      showScreen('wasted');
    }
    writeSave({ money: player.money, missionsDone: missions.state.index, playerPos: playerMesh.position, health: player.health });
  }
}

function respawn() {
  player.x = 10;
  player.z = 10;
  player.heading = 0;
  player.health = PLAYER.MAX_HEALTH;
  if (playerCar) {
    playerCar.isPlayerCar = false;
    playerCar = null;
    playerMesh.visible = true;
  }
  playerMesh.position.set(player.x, 0, player.z);
  state = 'play';
  showScreen('none');
  hud.showToast('Back on the streets of Solmar');
}

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  const all = [...parkedCars, ...traffic.cars];
  for (const car of all) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

function enterCar(car) {
  const fromTraffic = traffic.cars.includes(car);
  if (fromTraffic) {
    const i = traffic.cars.indexOf(car);
    traffic.cars.splice(i, 1);
  }
  playerCar = car;
  car.isPlayerCar = true;
  playerMesh.visible = false;
  if (car.owner !== 'player') {
    car.owner = 'player';
    addWanted(1);
    hud.showToast(fromTraffic ? 'You jacked a driver\'s car! ★' : 'You stole a parked car! ★');
  }
  audio.pickup();
}

function exitCar() {
  if (!playerCar) return;
  const car = playerCar;
  playerCar = null;
  const sideX = -Math.cos(car.heading);
  const sideZ = Math.sin(car.heading);
  let px = car.x + sideX * 2.4;
  let pz = car.z + sideZ * 2.4;
  const fixed = city.resolveCircle(px, pz, PLAYER.RADIUS);
  px = fixed.x;
  pz = fixed.z;
  player.x = px;
  player.z = pz;
  player.heading = car.heading;
  playerMesh.visible = true;
  playerMesh.position.set(player.x, 0, player.z);
}

function onShootHit(kind, ref, point) {
  if (kind === 'ped') {
    pedestrians.knockDown(ref);
    addWanted(1);
    hud.showToast('You hit a pedestrian! ★');
  } else if (kind === 'cop') {
    police.footCops.splice(police.footCops.indexOf(ref), 1);
    scene.remove(ref.mesh);
    combat.unregister(ref);
    addWanted(1);
    hud.showToast('You shot a cop! ★');
  } else if (kind === 'guard') {
    if (!ref.alive) return;
    ref.health -= combat.PISTOL_DAMAGE;
    if (ref.health <= 0) {
      ref.alive = false;
      ref.mesh.rotation.x = Math.PI / 2;
      ref.mesh.position.y = 0.25;
      hud.showToast('Guard down!');
    }
  }
}

function onPunchHit(kind, ref, point) {
  if (kind === 'ped') {
    pedestrians.knockDown(ref);
    addWanted(1);
    hud.showToast('You punched a pedestrian! ★');
  } else if (kind === 'cop') {
    police.footCops.splice(police.footCops.indexOf(ref), 1);
    scene.remove(ref.mesh);
    combat.unregister(ref);
    addWanted(1);
    hud.showToast('You knocked out a cop! ★');
  } else if (kind === 'guard') {
    if (!ref.alive) return;
    ref.health -= combat.PISTOL_DAMAGE;
    if (ref.health <= 0) {
      ref.alive = false;
      ref.mesh.rotation.x = Math.PI / 2;
      ref.mesh.position.y = 0.25;
      hud.showToast('Guard down!');
    }
  }
}

// ---- Per-frame update ---------------------------------------------------
function update(dt) {
  elapsed += dt;
  shootCooldown = Math.max(0, shootCooldown - dt);

  // Camera orbit from mouse drag.
  const drag = input.takeDrag();
  camYaw += drag.dx * 0.005;
  camPitch = Math.max(-0.1, Math.min(0.9, camPitch + drag.dy * 0.003));
  camDragOffset = camDragOffset * (1 - Math.min(1, dt * 2)) + drag.dx * 0.002;

  // Pause / resume.
  if (input.takeAction(ACTION_PAUSE)) {
    if (state === 'play') {
      state = 'paused';
      document.getElementById('pause-info').textContent =
        `Cash $${player.money} · Jobs done ${missions.state.index}/3 · Health ${Math.round(player.health)}`;
      showScreen('pause');
      writeSave({ money: player.money, missionsDone: missions.state.index, playerPos: playerMesh.position, health: player.health });
    } else if (state === 'paused') {
      state = 'play';
      showScreen('none');
    }
  }
  if (state !== 'play') return;

  // Start / abandon a job.
  if (input.takeAction(ACTION_MISSION)) {
    if (missions.state.active) {
      missions.fail();
      hud.showToast('Job abandoned');
    } else if (missions.isDone()) {
      missions.state.index = 0;
      hud.showToast('Jobs reset — start again from the pier');
    } else {
      const start = missions.nextStart();
      const d = Math.hypot(player.x - start.x, player.z - start.z);
      if (d < 12) {
        const def = missions.start();
        audio.missionStart();
        hud.showToast(`${def.title}: ${def.intro}`, 4200);
      } else {
        hud.showToast(`Get to the green marker first (${Math.round(d)}m away)`);
      }
    }
  }
  if (input.takeAction(ACTION_RESTART) && missions.state.active) {
    missions.fail();
    hud.showToast('Job abandoned');
  }

  // Enter / exit a car.
  if (input.takeAction(ACTION_ENTER_CAR)) {
    if (playerCar) exitCar();
    else {
      const car = nearestCar(5);
      if (car) enterCar(car);
    }
  }

  // Shooting (on foot only) and punching.
  if (!playerCar && input.isMouseDown() && shootCooldown <= 0) {
    shootCooldown = 0.28;
    audio.gunshot();
    combat.shoot(onShootHit);
    addWanted(1); // firing a gun in public is a crime
    pedestrians.scare(player.x, player.z, 45);
  }
  if (!playerCar && input.takeAction(ACTION_PUNCH)) {
    audio.punch();
    combat.punch({ x: player.x, z: player.z }, player.heading, onPunchHit);
    pedestrians.scare(player.x, player.z, 15);
  }

  // ---- Movement ----
  const axis = input.moveAxis();
  if (playerCar) {
    const throttle = autoDrive ? 0.55 : axis.z * -1;
    const steer = axis.x;
    const hit = playerCar.drive(dt, { throttle, steer }, city.collides);
    // Staged auto-drive (screenshots) cruises slowly so the car stays
    // in the city for the picture instead of running to the map edge.
    if (autoDrive && playerCar.speed > 15) playerCar.speed = 15;
    if (hit && elapsed - ramDamageAt > 1) {
      ramDamageAt = elapsed;
      audio.crash();
      pedestrians.scare(playerCar.x, playerCar.z, 25);
    }
    // Running over a pedestrian.
    for (const ped of pedestrians.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - playerCar.x, ped.z - playerCar.z) < 2.2 && Math.abs(playerCar.speed) > 3) {
        pedestrians.knockDown(ped);
        addWanted(1);
        audio.crash();
        hud.showToast('You ran someone over! ★');
        playerCar.speed *= 0.6;
      }
    }
    // Shoving traffic cars aside.
    for (const car of traffic.cars) {
      const d = Math.hypot(car.x - playerCar.x, car.z - playerCar.z);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d) / 2;
        car.x += ((car.x - playerCar.x) / d) * push;
        car.z += ((car.z - playerCar.z) / d) * push;
        car.speed *= 0.85;
        playerCar.speed *= 0.96;
      }
    }
    player.x = playerCar.x;
    player.z = playerCar.z;
  } else {
    const speed = input.isRunning() ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let mx = fx * -axis.z + rx * axis.x;
    let mz = fz * -axis.z + rz * axis.x;
    const len = Math.hypot(mx, mz);
    player.moving = len > 0.01;
    if (player.moving) {
      mx /= len;
      mz /= len;
      const nx = player.x + mx * speed * dt;
      const nz = player.z + mz * speed * dt;
      const fixed = city.resolveCircle(nx, nz, PLAYER.RADIUS);
      // Don't walk through cars.
      let blocked = false;
      for (const car of [...parkedCars, ...traffic.cars]) {
        if (Math.hypot(fixed.x - car.x, fixed.z - car.z) < 2.0) { blocked = true; break; }
      }
      if (!blocked) {
        player.x = fixed.x;
        player.z = fixed.z;
      }
      player.heading = Math.atan2(mx, mz);
      player.walkPhase += dt * speed * 1.6;
    }
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    const swing = player.moving ? Math.sin(player.walkPhase) * 0.5 : 0;
    playerMesh.getObjectByName('legL').rotation.x = swing;
    playerMesh.getObjectByName('legR').rotation.x = -swing;
    // Traffic cars can hit the player on foot.
    for (const car of traffic.cars) {
      if (Math.hypot(car.x - player.x, car.z - player.z) < 1.9 && Math.abs(car.speed) > 2 && elapsed - ramDamageAt > 1) {
        ramDamageAt = elapsed;
        damagePlayer(12, 'hit');
        audio.crash();
        hud.showToast('Hit by a car!');
      }
    }
  }

  // ---- Missions ----
  const event = missions.update(dt, { x: player.x, z: player.z }, !!playerCar);
  if (event) {
    if (event.type === 'complete') {
      player.money += event.reward;
      audio.cash();
      hud.showToast(`Job complete: ${event.title}! +$${event.reward}`, 3600);
      writeSave({ money: player.money, missionsDone: missions.state.index, playerPos: playerMesh.position, health: player.health });
    } else if (event.type === 'objective') {
      audio.pickup();
      hud.showToast(event.text, 3200);
      if (event.wanted) {
        wanted = Math.max(wanted, event.wanted);
        police.syncToWanted(wanted, player.x, player.z);
        audio.setSirenOn(true);
      }
    } else if (event.type === 'failed') {
      hud.showToast(event.reason, 3600);
    }
  }
  missions.updateGuards(dt, { x: player.x, z: player.z }, (guard) => {
    if (Math.random() < 0.45) {
      audio.gunshot();
      damagePlayer(5, 'shot');
    }
  });
  // Register fresh guards as combat targets.
  for (const g of missions.state.guards) {
    if (!g._registered) {
      g._registered = true;
      combat.register(g.mesh, 'guard', g);
    }
  }

  // ---- Wanted decay ----
  if (wanted > 0) {
    let near = false;
    for (const car of police.copCars) {
      if (Math.hypot(car.x - player.x, car.z - player.z) < 70) { near = true; break; }
    }
    if (!near) {
      for (const cop of police.footCops) {
        if (Math.hypot(cop.x - player.x, cop.z - player.z) < 50) { near = true; break; }
      }
    }
    if (near) coolTimer = 0;
    else {
      coolTimer += dt;
      if (coolTimer > WANTED.COOL_DOWN) {
        coolTimer = 0;
        wanted -= 1;
        police.syncToWanted(wanted, player.x, player.z);
        if (wanted === 0) audio.setSirenOn(false);
        hud.showToast(wanted > 0 ? `Heat dropping… ${wanted}★ left` : 'You lost the cops!');
      }
    }
  }

  // ---- Police ----
  police.syncToWanted(wanted, player.x, player.z);
  const policeResult = police.update(dt, wanted, { x: player.x, z: player.z }, playerCar, city.collides);
  if (policeResult.rammed && elapsed - ramDamageAt > 1) {
    ramDamageAt = elapsed;
    damagePlayer(4, 'ram');
    audio.crash();
  }
  if (policeResult.busted) {
    damagePlayer(player.health, 'busted');
  }
  // Register fresh foot cops as combat targets.
  for (const cop of police.footCops) {
    if (!cop._registered) {
      cop._registered = true;
      combat.register(cop.mesh, 'cop', cop);
    }
  }
  combat.prune();

  // ---- World life ----
  traffic.update(dt, { x: player.x, z: player.z }, playerCar, city.collides);
  pedestrians.update(dt, { x: player.x, z: player.z });
  missions.animateBeacon(elapsed);
  combat.update(dt);

  // Slow health regen while clean.
  if (wanted === 0 && player.health < PLAYER.MAX_HEALTH) {
    player.health = Math.min(PLAYER.MAX_HEALTH, player.health + dt * 1.5);
  }

  // ---- Camera ----
  if (playerCar) {
    const targetYaw = playerCar.heading + Math.PI + camDragOffset;
    let dy = targetYaw - camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    camYaw += dy * Math.min(1, dt * 2.5);
    const dist = 10.5;
    const cx = playerCar.x + Math.sin(camYaw) * dist;
    const cz = playerCar.z + Math.cos(camYaw) * dist;
    camera.position.set(cx, 4.6, cz);
    camera.lookAt(playerCar.x, 1.6, playerCar.z);
  } else {
    const dist = 6.8;
    const cx = player.x + Math.sin(camYaw) * dist;
    const cz = player.z + Math.cos(camYaw) * dist;
    const cy = 2.2 + Math.sin(camPitch) * 4.5;
    camera.position.set(cx, cy, cz);
    camera.lookAt(player.x, 1.5, player.z);
  }

  // ---- HUD + audio ----
  hud.update({
    objective: missions.objectiveText(),
    stars: wanted,
    money: player.money,
    health: player.health,
    driving: !!playerCar,
    speedKmh: playerCar ? Math.abs(playerCar.speed) * 3.6 : 0,
    minimap: {
      player: { x: player.x, z: player.z, heading: playerCar ? playerCar.heading : player.heading },
      traffic: traffic.cars,
      cops: [...police.copCars, ...police.footCops],
      blip: missions.blip(),
      time: elapsed,
    },
  });
  hud.setSpeedVisible(!!playerCar);
  hud.setCrosshairVisible(!playerCar);
  audio.setEngine(playerCar ? Math.abs(playerCar.speed) / CAR.MAX_SPEED : 0, !!playerCar);

  // ---- Autosave ----
  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    writeSave({ money: player.money, missionsDone: missions.state.index, playerPos: playerMesh.position, health: player.health });
  }
}

// ---- Screens & buttons --------------------------------------------------
document.getElementById('start-btn').addEventListener('click', () => {
  audio.unlock();
  state = 'play';
  showScreen('none');
  hud.showToast(save ? 'Welcome back to Solmar' : 'Welcome to Solmar — follow the green marker', 3600);
});
document.getElementById('resume-btn').addEventListener('click', () => {
  state = 'play';
  showScreen('none');
});
document.getElementById('restart-btn').addEventListener('click', () => {
  clearSave();
  window.location.reload();
});
document.getElementById('busted-btn').addEventListener('click', respawn);
document.getElementById('wasted-btn').addEventListener('click', respawn);

// ---- Shot mode: stage a scene, then flag it ready ----------------------
let shotReady = false;
if (shotKind) {
  state = 'play';
  showScreen('none');
  audio.unlock();
  const api = {
    player,
    playerMesh,
    missions,
    police,
    traffic,
    parkedCars,
    pedestrians,
    setWanted(n) {
      wanted = n;
      police.syncToWanted(wanted, player.x, player.z);
      audio.setSirenOn(wanted > 0);
    },
    setCamYaw(yaw) { camYaw = yaw; },
    setCamPitch(pitch) { camPitch = pitch; },
    setAutoDrive(on) { autoDrive = on; },
    putPlayerInCar(car) {
      playerCar = car;
      car.isPlayerCar = true;
      car.owner = 'player';
      playerMesh.visible = false;
    },
    placePlayerOnFoot(x, z, heading) {
      player.x = x;
      player.z = z;
      player.heading = heading;
      playerMesh.position.set(x, 0, z);
      playerMesh.rotation.y = heading;
    },
    startMission(i) {
      missions.state.index = i;
      return missions.start();
    },
  };
  stageShot(shotKind, api, rng);
}

// ---- Main loop ------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  if (state === 'title') {
    // Slow orbit around downtown behind the title screen.
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.05) * 120, 55, Math.cos(t * 0.05) * 120);
    camera.lookAt(0, 10, 0);
    traffic.update(STEP, { x: 0, z: 0 }, null, city.collides);
    pedestrians.update(STEP, { x: 0, z: 0 });
    missions.animateBeacon(t);
  } else if (state === 'play') {
    let acc = frameDt;
    while (acc > 0) {
      const step = Math.min(STEP, acc);
      update(step);
      acc -= step;
    }
  }
  renderer.render(scene, camera);
  framesRendered += 1;
  if (shotKind && !shotReady && framesRendered > 12) {
    shotReady = true;
    window.__shotReady = true;
  }
  // Debug handle for the automated playtest.
  window.__game = {
    state,
    wanted,
    money: player.money,
    health: player.health,
    inCar: !!playerCar,
    playerPos: { x: player.x, z: player.z },
    missionsDone: missions.state.index,
    missionActive: missions.state.active,
    copCars: police.copCars.length,
    footCops: police.footCops.length,
  };
  window.__debug = {
    teleport(x, z) {
      if (playerCar) exitCar();
      player.x = x;
      player.z = z;
      playerMesh.position.set(x, 0, z);
    },
    parkedCars: parkedCars.map((c) => ({ x: c.x, z: c.z })),
  };
}
requestAnimationFrame(frame);
