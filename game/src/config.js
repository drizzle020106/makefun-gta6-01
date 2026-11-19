// Solmar — shared tuning constants for the whole open world.
// Every number that shapes how the city feels lives here so a balance
// change never means hunting through gameplay code.
export const CITY = {
  // Road centre lines, both directions. Blocks sit between them.
  ROADS: [-174, -116, -58, 0, 58, 116, 174],
  ROAD_WIDTH: 14,
  BLOCK: 44,
  // East edge: sand starts here, the sea starts a little further out.
  SAND_X: 200,
  SEA_X: 244,
  WORLD_HALF: 320,
};

export const PLAYER = {
  WALK_SPEED: 5.2,
  RUN_SPEED: 8.5,
  RADIUS: 0.55,
  MAX_HEALTH: 100,
};

export const CAR = {
  ACCEL: 24,
  BRAKE: 34,
  REVERSE_MAX: 10,
  MAX_SPEED: 38,
  TURN_RATE: 1.9,
  RADIUS: 1.6,
  LENGTH: 4.4,
};

export const WANTED = {
  MAX_STARS: 5,
  // Seconds with no police nearby and no new crime before one star fades.
  COOL_DOWN: 18,
  // How many police cars / foot cops are out per star level.
  COP_CARS: [0, 1, 2, 3, 4, 5],
  FOOT_COPS: [0, 0, 1, 2, 3, 4],
  COP_CAR_SPEED: [0, 26, 29, 32, 35, 38],
  // How close a cop must get to start a bust (on foot, seconds held).
  BUST_HOLD_SECONDS: 1.6,
  BUST_RADIUS: 2.2,
};

export const MISSIONS = {
  REWARDS: [150, 300, 500],
  DELIVERY_TIME_LIMIT: 180,
};

export const SAVE_KEY = 'solmar-save-v1';
