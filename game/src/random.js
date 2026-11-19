// Deterministic random numbers so a ?seed= URL replays the same city,
// traffic layout and pedestrian placement every time.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function nextUint32() {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }
  return {
    next() {
      return nextUint32() / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    chance(p) {
      return this.next() < p;
    },
  };
}
