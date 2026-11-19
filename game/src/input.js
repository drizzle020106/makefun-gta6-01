// Keyboard + mouse input. Movement keys are read every frame as a held
// set; one-shot actions (enter car, punch, shoot, pause) are consumed
// once by the game loop through takeAction().
export const ACTION_ENTER_CAR = 'enterCar';
export const ACTION_PUNCH = 'punch';
export const ACTION_SHOOT = 'shoot';
export const ACTION_PAUSE = 'pause';
export const ACTION_MISSION = 'mission';
export const ACTION_RESTART = 'restart';

export function createInput(canvas) {
  const keys = new Set();
  const queue = [];
  let mouseDown = false;
  let mouseDownRight = false;
  // Camera orbit deltas accumulated from mouse drags (pointer lock is
  // avoided so the game also works inside a headless test browser).
  let dragDX = 0;
  let dragDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function enqueue(action) {
    if (!queue.includes(action)) queue.push(action);
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') enqueue(ACTION_ENTER_CAR);
    if (event.code === 'KeyF') enqueue(ACTION_PUNCH);
    if (event.code === 'KeyM') enqueue(ACTION_MISSION);
    if (event.code === 'KeyR') enqueue(ACTION_RESTART);
    if (event.code === 'Escape' || event.code === 'KeyP') enqueue(ACTION_PAUSE);
    if (event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
    if (event.button === 2) mouseDownRight = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      mouseDown = false;
      dragging = false;
    }
    if (event.button === 2) mouseDownRight = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    dragDX += event.clientX - lastX;
    dragDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    isDown(code) {
      return keys.has(code);
    },
    // WASD / arrows as a -1..1 pair, forward is -Z of the camera yaw.
    moveAxis() {
      let x = 0;
      let z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, z };
    },
    isRunning() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    isMouseDown() {
      return mouseDown;
    },
    isRightMouseDown() {
      return mouseDownRight;
    },
    takeAction(action) {
      const i = queue.indexOf(action);
      if (i === -1) return false;
      queue.splice(i, 1);
      return true;
    },
    takeDrag() {
      const d = { dx: dragDX, dy: dragDY };
      dragDX = 0;
      dragDY = 0;
      return d;
    },
  };
}
