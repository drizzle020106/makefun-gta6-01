// Combat: the pistol (mouse aim, raycast, tracer) and the punch
// (close-range shove that knocks a person down). Targets register
// themselves; this module only aims, hits and draws the tracer.
import * as THREE from 'three';

const PISTOL_RANGE = 90;
const PISTOL_DAMAGE = 34;
const PUNCH_RANGE = 2.6;

export function createCombat(scene, camera) {
  const raycaster = new THREE.Raycaster();
  const targets = []; // { mesh, kind, ref, alive() }
  const tracers = [];

  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, tracerMat.clone());
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  }

  return {
    // Drop targets whose mesh left the scene (despawned cops, cleared guards).
    prune() {
      for (let i = targets.length - 1; i >= 0; i--) {
        if (!targets[i].mesh.parent) targets.splice(i, 1);
      }
    },
    register(mesh, kind, ref) {
      targets.push({ mesh, kind, ref });
    },
    unregister(ref) {
      const i = targets.findIndex((t) => t.ref === ref);
      if (i !== -1) targets.splice(i, 1);
    },
    // Fire from the camera centre. onHit(kind, ref, point) decides the
    // effect (knock a ped down, wound a guard, ...). Returns the hit.
    shoot(onHit) {
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      raycaster.far = PISTOL_RANGE;
      const meshes = targets.map((t) => t.mesh);
      const hits = raycaster.intersectObjects(meshes, true);
      const from = camera.position.clone();
      if (hits.length === 0) {
        const to = from.clone().add(raycaster.ray.direction.clone().multiplyScalar(60));
        addTracer(from, to);
        return { hit: false };
      }
      const hit = hits[0];
      let obj = hit.object;
      let entry = null;
      while (obj) {
        entry = targets.find((t) => t.mesh === obj);
        if (entry) break;
        obj = obj.parent;
      }
      const to = hit.point.clone();
      addTracer(from, to);
      if (!entry) return { hit: true, point: to, kind: 'world' };
      onHit(entry.kind, entry.ref, to);
      return { hit: true, point: to, kind: entry.kind };
    },
    // A punch at the nearest person in front of the player.
    punch(playerPos, heading, onHit) {
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      let best = null;
      let bestD = PUNCH_RANGE;
      for (const t of targets) {
        if (t.kind === 'guard' && t.ref && t.ref.alive === false) continue;
        const m = t.mesh.position;
        const dx = m.x - playerPos.x;
        const dz = m.z - playerPos.z;
        const d = Math.hypot(dx, dz);
        if (d > bestD) continue;
        const facing = (dx * fx + dz * fz) / (d || 1);
        if (facing < 0.3) continue;
        best = t;
        bestD = d;
      }
      if (!best) return null;
      onHit(best.kind, best.ref, best.mesh.position.clone());
      return { kind: best.kind, ref: best.ref };
    },
    update(dt) {
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) {
          scene.remove(t.line);
          t.line.geometry.dispose();
          t.line.material.dispose();
          tracers.splice(i, 1);
        }
      }
    },
    PISTOL_DAMAGE,
  };
}
