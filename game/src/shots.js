// Screenshot staging for ?shot=cover|street|chase|mission.
// Each scene puts the player, the traffic, the police and the mission
// beacon exactly where the picture needs them, using the same live game
// systems — no fake renders, the shot is the game running.
import { CAR_COLORS } from './vehicles.js';

export function stageShot(kind, api, rng) {
  const { player, missions, police, traffic, parkedCars } = api;

  if (kind === 'cover') {
    // Driving down the main north–south avenue with traffic and
    // pedestrians around, HUD + minimap on screen.
    const car = parkedCars.find((c) => Math.abs(c.x) < 6 && c.z > -70 && c.z < -10)
      || parkedCars[0];
    car.x = 0;
    car.z = -50;
    car.heading = 0;
    car.speed = 14;
    car.sync();
    api.putPlayerInCar(car);
    api.setAutoDrive(true);
    api.setCamYaw(Math.PI);
    api.setCamPitch(0.25);
  } else if (kind === 'street') {
    // On foot ON the pier deck, job 1 beacon glowing at the pier end,
    // the sea beyond it.
    api.placePlayerOnFoot(222, 58, Math.PI / 2);
    api.setCamYaw(-Math.PI / 2);
    api.setCamPitch(0.3);
    api.startMission(0);
  } else if (kind === 'chase') {
    // Three stars, two police cars closing in behind the player's car.
    const car = parkedCars[0];
    car.x = 0;
    car.z = -40;
    car.heading = 0;
    car.speed = 20;
    car.sync();
    api.putPlayerInCar(car);
    api.setAutoDrive(true);
    api.setCamYaw(Math.PI);
    api.setCamPitch(0.22);
    api.setWanted(3);
    // Put the spawned cop cars ahead, oncoming, so they are in frame
    // and closing in when the picture is taken.
    police.copCars.forEach((cop, i) => {
      cop.x = 5 - i * 10;
      cop.z = -15 - i * 18;
      cop.heading = Math.PI;
      cop.speed = 24;
      cop.sync();
    });
  } else if (kind === 'mission') {
    // Job 3: the briefcase in the parking lot, guards on watch, the
    // player on foot closing in with the pistol out.
    api.placePlayerOnFoot(78, -18, Math.atan2(87 - 78, -29 - (-18)));
    api.setCamYaw(-0.68);
    api.setCamPitch(0.28);
    api.startMission(2);
  } else {
    // Unknown shot: just stand in the city.
    api.placePlayerOnFoot(0, 0, 0);
  }
  // Make sure the HUD reads cleanly in every shot.
  player.money = 1250;
  player.health = 100;
}
