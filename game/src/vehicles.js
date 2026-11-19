// Cars: a shared low-poly car factory, the player's arcade driving
// physics, and the parked cars scattered around Solmar (stealable).
import * as THREE from 'three';
import { CAR, CITY } from './config.js';

export const CAR_COLORS = [
  0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3fae6a, 0xe8e8e8, 0x22262c,
  0x8a4fbf, 0xe87a2e, 0x4fc2c2, 0xc2c2c2,
];

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });

// Build one low-poly car. Returns { group, wheels[] }.
export function buildCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 2.0), paint);
  body.position.y = 0.72;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.75, 1.8),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xffffff : 0x1c2733 }),
  );
  cabin.position.set(-0.2, 1.45, 0);
  group.add(cabin);
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    bar.position.set(-0.2, 1.95, 0);
    bar.name = 'lightbar';
    group.add(bar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(4.42, 0.3, 2.02),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    stripe.position.y = 0.95;
    group.add(stripe);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const z of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.4), headMat);
    head.position.set(2.22, 0.75, z);
    group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    tail.position.set(-2.22, 0.75, z);
    group.add(tail);
  }
  const wheels = [];
  for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    // Axle along X (across the car): rotation.z tips the cylinder's
    // axis from Y to X, and spinning is rotation.x around that axle.
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  return { group, wheels };
}

// One drivable car: position, heading, speed and arcade handling.
export function createCar(color, x, z, heading, isPolice = false) {
  const { group, wheels } = buildCarMesh(color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    group,
    wheels,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    isPolice,
    isPlayerCar: false,
    // Drive it one step. input: { throttle -1..1, steer -1..1 }.
    // Returns true when it hit a building (for the crash sound).
    drive(dt, input, collides) {
      const forward = input.throttle;
      if (forward > 0) this.speed += CAR.ACCEL * forward * dt;
      else if (forward < 0) this.speed += CAR.BRAKE * forward * dt; // braking / reversing
      else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
      const max = forward < 0 && this.speed < 0 ? -CAR.REVERSE_MAX : CAR.MAX_SPEED;
      this.speed = Math.max(-CAR.REVERSE_MAX, Math.min(max, this.speed));
      const steerTarget = input.steer * CAR.TURN_RATE * Math.min(1, Math.abs(this.speed) / 8);
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
      this.heading += this.steer * dt * Math.sign(this.speed || 1) * -1;
      const nx = this.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.z + Math.cos(this.heading) * this.speed * dt;
      let hit = false;
      if (collides(nx, nz, CAR.RADIUS)) {
        hit = true;
        this.speed *= -0.25; // bounce off the wall
      } else {
        this.x = nx;
        this.z = nz;
      }
      this.sync();
      return hit;
    },
    sync() {
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = this.heading;
      for (const wheel of this.wheels) {
        wheel.userData.spin = (wheel.userData.spin || 0) + this.speed * 0.016;
        wheel.rotation.x = wheel.userData.spin;
      }
    },
  };
}

// Parked cars on side streets and in the parking lot. Some are free to
// take; taking one that has an owner standing nearby counts as stealing.
export function spawnParkedCars(scene, rng, lotBlock) {
  const cars = [];
  const spots = [];
  // Along the kerb of a few quiet streets.
  for (let i = 0; i < 14; i++) {
    const road = CITY.ROADS[Math.floor(rng.next() * CITY.ROADS.length)];
    const along = rng.range(-170, 170);
    const side = rng.chance(0.5) ? 1 : -1;
    const vertical = rng.chance(0.5);
    if (vertical) spots.push({ x: road + side * (CITY.ROAD_WIDTH / 2 - 1.6), z: along, heading: 0 });
    else spots.push({ x: along, z: road + side * (CITY.ROAD_WIDTH / 2 - 1.6), heading: Math.PI / 2 });
  }
  // Rows in the parking lot.
  if (lotBlock) {
    for (let i = 0; i < 6; i++) {
      spots.push({
        x: lotBlock.cx - 12 + (i % 3) * 12,
        z: lotBlock.cz - 8 + Math.floor(i / 3) * 14,
        heading: Math.PI / 2,
      });
    }
  }
  for (const s of spots) {
    const car = createCar(CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)], s.x, s.z, s.heading);
    scene.add(car.group);
    cars.push(car);
  }
  return cars;
}
