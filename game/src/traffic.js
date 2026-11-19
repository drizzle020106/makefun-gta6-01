// AI traffic: cars that drive the street grid, turn at intersections
// and brake for the car ahead. They keep the city feeling alive and
// give the player something to weave through (or crash into).
import { CITY } from './config.js';
import { createCar, CAR_COLORS } from './vehicles.js';

const TRAFFIC_COUNT = 26;

function randomRoutePoint(rng) {
  const road = CITY.ROADS[Math.floor(rng.next() * CITY.ROADS.length)];
  const along = rng.range(-180, 180);
  const vertical = rng.chance(0.5);
  return vertical
    ? { x: road, z: along, heading: rng.chance(0.5) ? 0 : Math.PI }
    : { x: along, z: road, heading: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
}

export function createTraffic(scene, rng) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const p = randomRoutePoint(rng);
    const car = createCar(CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)], p.x, p.z, p.heading);
    car.speed = rng.range(8, 14);
    car.cruise = rng.range(8, 14);
    // Lane offset: keep right.
    car.lane = rng.chance(0.5) ? 3.2 : -3.2;
    car.nextTurnAt = rng.range(20, 90);
    scene.add(car.group);
    cars.push(car);
  }

  function nearestRoadCoord(value) {
    let best = CITY.ROADS[0];
    let bestD = Math.abs(value - best);
    for (const r of CITY.ROADS) {
      const d = Math.abs(value - r);
      if (d < bestD) {
        best = r;
        bestD = d;
      }
    }
    return best;
  }

  // Is another car close ahead in my lane? Brake if so.
  function carAhead(me) {
    const fx = Math.sin(me.heading);
    const fz = Math.cos(me.heading);
    for (const other of cars) {
      if (other === me) continue;
      const dx = other.x - me.x;
      const dz = other.z - me.z;
      const ahead = dx * fx + dz * fz;
      if (ahead > 0 && ahead < 13 && Math.abs(dx * fz - dz * fx) < 3.4) return true;
    }
    return false;
  }

  return {
    cars,
    update(dt, playerPos, playerCar, collides) {
      for (const car of cars) {
        // Keep traffic near the player: respawn far cars elsewhere.
        const distToPlayer = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
        if (distToPlayer > 240) {
          const p = randomRoutePoint(rng);
          car.x = p.x;
          car.z = p.z;
          car.heading = p.heading;
          car.speed = car.cruise;
        }
        // At an intersection, sometimes turn.
        const onVerticalRoad = Math.abs(car.x - nearestRoadCoord(car.x)) < 1.2;
        const onHorizontalRoad = Math.abs(car.z - nearestRoadCoord(car.z)) < 1.2;
        car.nextTurnAt -= Math.abs(car.speed) * dt;
        if (onVerticalRoad && onHorizontalRoad && car.nextTurnAt <= 0) {
          car.nextTurnAt = rng.range(30, 100);
          const turn = rng.pick([-Math.PI / 2, 0, Math.PI / 2]);
          car.heading += turn;
          // Snap onto the new road's centre line.
          car.x = nearestRoadCoord(car.x);
          car.z = nearestRoadCoord(car.z);
        }
        // Lane keeping: drift back to my lane offset on the current road.
        const vertical = Math.abs(Math.sin(car.heading)) < 0.5;
        if (vertical) {
          const target = nearestRoadCoord(car.x) + car.lane * Math.sign(Math.cos(car.heading));
          car.x += (target - car.x) * Math.min(1, dt * 1.5);
        } else {
          const target = nearestRoadCoord(car.z) + car.lane * Math.sign(-Math.sin(car.heading));
          car.z += (target - car.z) * Math.min(1, dt * 1.5);
        }
        // Speed: cruise, brake for traffic ahead, stop for the player car.
        let targetSpeed = car.cruise;
        if (carAhead(car)) targetSpeed = 0;
        if (playerCar) {
          const d = Math.hypot(playerCar.x - car.x, playerCar.z - car.z);
          if (d < 9) targetSpeed = 0;
        }
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2.5);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        if (!collides(nx, nz, 1.6)) {
          car.x = nx;
          car.z = nz;
        } else {
          car.speed = 0;
        }
        car.sync();
      }
    },
  };
}
