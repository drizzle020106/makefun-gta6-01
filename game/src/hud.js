// The HUD: DOM readouts (stars, money, health, speed, objective) and a
// live top-down minimap drawn on a canvas every frame.
import { CITY } from './config.js';

export function createHud() {
  const el = {
    objective: document.getElementById('objective'),
    stars: document.getElementById('stars'),
    money: document.getElementById('money'),
    healthfill: document.getElementById('healthfill'),
    speed: document.getElementById('speed'),
    crosshair: document.getElementById('crosshair'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
    vignette: document.getElementById('vignette'),
    minimap: document.getElementById('minimap'),
  };
  const mapCtx = el.minimap.getContext('2d');
  const MAP_SIZE = 190;
  const HALF = CITY.WORLD_HALF + 40;
  let toastTimer = null;

  function toMap(x, z) {
    return [
      ((x + HALF) / (HALF * 2)) * MAP_SIZE,
      ((z + HALF) / (HALF * 2)) * MAP_SIZE,
    ];
  }

  function drawMinimap(data) {
    const g = mapCtx;
    g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Sea on the east.
    g.fillStyle = '#2e7cb5';
    const [seaX] = toMap(CITY.SEA_X, 0);
    g.fillRect(seaX, 0, MAP_SIZE - seaX, MAP_SIZE);
    // Sand.
    g.fillStyle = '#e6d49b';
    const [sandX] = toMap(CITY.SAND_X, 0);
    g.fillRect(sandX, 0, seaX - sandX, MAP_SIZE);
    // Roads.
    g.strokeStyle = '#3a3f46';
    g.lineWidth = 4;
    for (const r of CITY.ROADS) {
      const [rx] = toMap(r, 0);
      const [, rz] = toMap(0, r);
      g.beginPath(); g.moveTo(rx, 0); g.lineTo(rx, MAP_SIZE); g.stroke();
      g.beginPath(); g.moveTo(0, rz); g.lineTo(MAP_SIZE, rz); g.stroke();
    }
    // Mission blip (pulsing).
    if (data.blip) {
      const [bx, by] = toMap(data.blip.x, data.blip.z);
      const pulse = 4 + Math.sin(data.time * 5) * 2;
      g.fillStyle = data.blip.color;
      g.beginPath(); g.arc(bx, by, pulse + 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(bx, by, pulse + 2, 0, Math.PI * 2); g.stroke();
    }
    // Traffic dots.
    g.fillStyle = '#ffffff';
    for (const c of data.traffic) {
      const [cx, cy] = toMap(c.x, c.z);
      g.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Police dots.
    g.fillStyle = '#ff4040';
    for (const c of data.cops) {
      const [cx, cy] = toMap(c.x, c.z);
      g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const [px, py] = toMap(data.player.x, data.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(Math.PI - data.player.heading);
    g.fillStyle = '#ffd23e';
    g.strokeStyle = '#000';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  return {
    showToast(text, ms = 2600) {
      el.toast.textContent = text;
      el.toast.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.toast.style.opacity = '0'; }, ms);
    },
    setVignette(on) {
      el.vignette.style.opacity = on ? '1' : '0';
    },
    setCrosshairVisible(on) {
      el.crosshair.style.display = on ? 'block' : 'none';
    },
    setSpeedVisible(on) {
      el.speed.classList.toggle('hidden', !on);
    },
    setHintVisible(on) {
      el.hint.style.display = on ? 'block' : 'none';
    },
    update(state) {
      el.objective.textContent = state.objective;
      el.stars.textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
      el.money.textContent = `$${Math.round(state.money).toLocaleString('en-US')}`;
      el.healthfill.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
      if (state.driving) {
        el.speed.innerHTML = `${Math.round(state.speedKmh)}<small>km/h</small>`;
      }
      drawMinimap(state.minimap);
    },
  };
}

// Show exactly one overlay screen; 'none' hides them all.
export function showScreen(name) {
  for (const id of ['title-screen', 'pause-screen', 'busted-screen', 'wasted-screen']) {
    document.getElementById(id).classList.toggle('hidden', id !== `${name}-screen`);
  }
}
