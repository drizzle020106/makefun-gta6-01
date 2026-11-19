// Save / load through localStorage: money, mission progress and where
// the player was standing. Wanted level is never saved — a fresh session
// starts clean.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: Number.isFinite(data.money) ? data.money : 0,
      missionsDone: Number.isInteger(data.missionsDone) ? data.missionsDone : 0,
      pos: Array.isArray(data.pos) && data.pos.length === 3 ? data.pos : null,
      health: Number.isFinite(data.health) ? data.health : 100,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: Math.round(state.money),
      missionsDone: state.missionsDone,
      pos: [state.playerPos.x, state.playerPos.y, state.playerPos.z],
      health: Math.round(state.health),
    }));
  } catch {
    // Storage full or blocked: the game keeps running unsaved.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
