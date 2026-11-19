# Solmar — Open World Crime Game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/competitions/gta6-01)
[![rank](https://make.fun/badge/gta6-01/drizzle020106/makefun-gta6-01/rank.svg)](https://make.fun/competitions/gta6-01)
[![reward](https://make.fun/badge/gta6-01/drizzle020106/makefun-gta6-01/reward.svg)](https://make.fun/competitions/gta6-01)

An original open-world crime game for the **gta6-01 "Make GTA 6"** bounty. You are Rae Calder, a courier who just rolled into **Solmar**, a sunny modern seaside city of your own — no Rockstar places, characters, or story here. Walk the streets, steal a car, outrun the cops, and finish three original jobs.

## How to play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open http://localhost:8080). No network needed — everything is local.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, run (Shift), drive |
| Mouse drag | Look around |
| E | Enter / exit the nearest car |
| Left click | Shoot the pistol (on foot) |
| F | Punch |
| M | Start the next job (stand near the green marker) |
| P / Esc | Pause |

## The city

A street grid with downtown towers, a beach and sea to the east, a pier, a park, palm trees, and street lamps — all geometry and textures generated in code, no image or audio files.

## Systems

- **Driving** — arcade handling, parked cars and other drivers' cars can be stolen (that's a crime).
- **Traffic & pedestrians** — AI cars drive the grid, brake for traffic, and turn at intersections; pedestrians walk the sidewalks and flee from gunshots and crashes.
- **Wanted level 1–5★** — stealing, hitting pedestrians, and shooting raise the heat. Police cars chase and ram; foot cops chase and try to bust you. Stay out of sight and the stars fade.
- **Three jobs** — *Sunrise Delivery* (pier parcel to the Marina Hotel, on the clock), *Getaway Driver* (pick up Dana, lose the cops, reach the safehouse), and *The Collector's Key* (grab a briefcase from a guarded parking lot, return it to the museum). Each pays cash.
- **Combat** — pistol with tracer fire, punches, armed guards who shoot back.
- **HUD** — live minimap, wanted stars, cash, health, speedometer, objective tracker.
- **Save** — cash, job progress, and position auto-save to localStorage.

## Tech

- three.js (vendored `game/vendor/three.module.min.js`), plain ES modules, no build step.
- All art is procedural (geometry + canvas textures); all sound is synthesized with WebAudio.
- Source is split by system: `game/src/city.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `missions.js`, `combat.js`, `hud.js`, `audio.js`, `save.js`, `input.js`, `config.js`, `random.js`, `main.js`, `shots.js`.

## License

MIT — see [LICENSE](LICENSE).
