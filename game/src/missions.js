// The three story jobs of Solmar. Each has a start point, a chain of
// objectives with a glowing beacon and a minimap blip, and a cash
// reward. All names, people and places are original to this game.
//   1. Sunrise Delivery — courier run from the pier to the Marina Hotel.
//   2. Getaway Driver — pick up Dana at the cafe, lose the cops, reach
//      the safehouse while the heat is on.
//   3. The Collector's Key — grab a briefcase from the parking lot
//      while two armed guards shoot back, return it to the museum.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { createStandingPerson } from './pedestrians.js';

const MISSION_DEFS = [
  {
    id: 0,
    title: 'Sunrise Delivery',
    giver: 'Marina, the pier vendor',
    intro: 'Marina needs a parcel at the Marina Hotel before the sun is high. Pick it up at the end of the pier.',
    steps: [
      { text: 'Pick up the parcel at the end of the pier', x: 266, z: 58 },
      { text: 'Deliver the parcel to the Marina Hotel (east side)', x: 186, z: 100, timer: MISSIONS.DELIVERY_TIME_LIMIT },
    ],
    reward: MISSIONS.REWARDS[0],
  },
  {
    id: 1,
    title: 'Getaway Driver',
    giver: 'Dana, the cafe regular',
    intro: 'Dana borrowed the wrong car and the cops noticed. Pick her up at the Sunrise Cafe, then get her to the safehouse in the old quarter.',
    steps: [
      { text: 'Pick up Dana at the Sunrise Cafe', x: -50, z: -20 },
      { text: 'Get Dana to the safehouse — the cops are coming', x: -160, z: -160, wanted: 2 },
    ],
    reward: MISSIONS.REWARDS[1],
  },
  {
    id: 2,
    title: "The Collector's Key",
    giver: 'Otto, the museum curator',
    intro: "Otto's briefcase is sitting in the parking lot off 4th Street, and two of Marlowe's guards are watching it. Bring it to the museum.",
    steps: [
      { text: 'Take the briefcase from the parking lot (watch the guards)', x: 87, z: -29, guards: true },
      { text: 'Return the briefcase to the Solmar Museum', x: 20, z: 168 },
    ],
    reward: MISSIONS.REWARDS[2],
  },
];

export function createMissions(scene, rng) {
  // The beacon: a glowing column + ring marking the current objective.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc800, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  ring.visible = false;
  scene.add(ring);

  const state = {
    index: 0, // next mission to offer
    active: false,
    step: 0,
    timer: 0,
    danaMesh: null,
    guards: [],
    briefcaseMesh: null,
  };

  function clearGuards() {
    for (const g of state.guards) scene.remove(g.mesh);
    state.guards = [];
    if (state.briefcaseMesh) {
      scene.remove(state.briefcaseMesh);
      state.briefcaseMesh = null;
    }
  }

  function spawnGuards() {
    const spots = [[80, -36], [94, -22]];
    for (const [gx, gz] of spots) {
      const mesh = createStandingPerson(scene, 0x222222, gx, gz, 0);
      const guard = { mesh, x: gx, z: gz, health: 100, alive: true, shootTimer: 0 };
      mesh.userData.guard = guard;
      state.guards.push(guard);
    }
    const caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.25),
      new THREE.MeshLambertMaterial({ color: 0x8a6a2a }),
    );
    caseMesh.position.set(87, 0.5, -29);
    scene.add(caseMesh);
    state.briefcaseMesh = caseMesh;
  }

  function currentDef() {
    return MISSION_DEFS[state.index];
  }

  function currentStep() {
    const def = currentDef();
    return def ? def.steps[state.step] : null;
  }

  function moveBeacon() {
    const step = currentStep();
    if (!step) {
      beacon.visible = false;
      ring.visible = false;
      return;
    }
    beacon.visible = true;
    ring.visible = true;
    beacon.position.set(step.x, 15, step.z);
    ring.position.set(step.x, 0.3, step.z);
  }

  return {
    state,
    defs: MISSION_DEFS,
    currentDef,
    currentStep,
    isDone() {
      return state.index >= MISSION_DEFS.length;
    },
    // Where the next mission starts (for the "press M" prompt + blip).
    nextStart() {
      const def = currentDef();
      if (!def) return null;
      return { x: def.steps[0].x, z: def.steps[0].z, title: def.title };
    },
    start() {
      const def = currentDef();
      if (!def || state.active) return null;
      state.active = true;
      state.step = 0;
      state.timer = 0;
      const step = currentStep();
      if (step.guards) spawnGuards();
      if (def.id === 1) {
        state.danaMesh = createStandingPerson(scene, 0xd94b8a, -50, -20, Math.PI / 2);
      }
      moveBeacon();
      return def;
    },
    // Advance the mission. Returns an event object or null.
    update(dt, playerPos, playerInCar) {
      if (!state.active) return null;
      const def = currentDef();
      const step = currentStep();
      if (!step) return null;
      if (step.timer) {
        state.timer += dt;
        if (state.timer > step.timer) {
          state.active = false;
          clearGuards();
          if (state.danaMesh) {
            scene.remove(state.danaMesh);
            state.danaMesh = null;
          }
          moveBeacon();
          return { type: 'failed', reason: 'Out of time — the hotel gave the parcel to someone else.' };
        }
      }
      const d = Math.hypot(playerPos.x - step.x, playerPos.z - step.z);
      if (d < 4.5) {
        if (def.id === 1 && state.step === 0) {
          // Dana climbs in (or hops on the running board): she rides along.
          if (state.danaMesh) {
            scene.remove(state.danaMesh);
            state.danaMesh = null;
          }
        }
        if (def.id === 2 && state.step === 0) {
          clearGuards();
        }
        state.step += 1;
        state.timer = 0;
        if (state.step >= def.steps.length) {
          state.active = false;
          state.index += 1;
          moveBeacon();
          return { type: 'complete', reward: def.reward, title: def.title };
        }
        const next = currentStep();
        if (next && next.guards) spawnGuards();
        moveBeacon();
        return { type: 'objective', text: next.text, wanted: next.wanted || 0 };
      }
      return null;
    },
    // Guards shoot at the player while the briefcase step is live.
    updateGuards(dt, playerPos, onGuardShot) {
      if (!state.active || state.index !== 2 || state.step !== 0) return;
      for (const g of state.guards) {
        if (!g.alive) continue;
        const d = Math.hypot(playerPos.x - g.x, playerPos.z - g.z);
        g.mesh.lookAt(playerPos.x, 0, playerPos.z);
        if (d < 35) {
          g.shootTimer -= dt;
          if (g.shootTimer <= 0) {
            g.shootTimer = 1.4;
            onGuardShot(g);
          }
        }
      }
    },
    fail() {
      if (!state.active) return;
      state.active = false;
      clearGuards();
      if (state.danaMesh) {
        scene.remove(state.danaMesh);
        state.danaMesh = null;
      }
      moveBeacon();
    },
    animateBeacon(time) {
      if (!beacon.visible) return;
      const s = 1 + Math.sin(time * 3) * 0.15;
      beacon.scale.set(s, 1, s);
      beaconMat.opacity = 0.5 + Math.sin(time * 3) * 0.12;
    },
    // For the minimap: current target, or the next start point.
    blip() {
      if (state.active) {
        const step = currentStep();
        if (step) return { x: step.x, z: step.z, color: '#ffd23e' };
      }
      const start = this.nextStart();
      if (start) return { x: start.x, z: start.z, color: '#7ee081' };
      return null;
    },
    objectiveText() {
      if (state.active) {
        const step = currentStep();
        const def = currentDef();
        let text = `${def.title}: ${step.text}`;
        if (step.timer) text += ` — ${Math.max(0, Math.ceil(step.timer - state.timer))}s left`;
        return text;
      }
      const def = currentDef();
      if (def) return `Next job: ${def.title} — go to the green marker and press M`;
      return 'All jobs done — free roam! Press M to replay the jobs.';
    },
  };
}
