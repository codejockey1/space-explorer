# Space Explorer

First-person browser spaceflight through a dual-scale solar system (Vite + Three.js).

## Run

```bash
npm install
npm run dev
```

## Features

- **True AU-accurate** scale by default (Earth opening view with Sun, Moon, Death Star); toggle **playable** compressed orbits with `M` (preserves nearby body)
- Sun, 8 planets, major moons, dwarf planets, Vesta/Eros/Halley, ~10 craft with procedural models, plus Death Star near Earth
- Keplerian orbits + axial spin driven by a **time accelerator** (`1×`–`1000×`, pause, reverse, date jump in pause menu)
- Target search, cycle, in-view / nearest pick; colored throbbing beacon; range + relative speed HUD
- Approach with flybys, soft abort, arrival **orbit hold**
- Labels, minimap, orbit lines, ecliptic grid, sun glare, atmospheres, Earth night lights, far impostors
- Mouse look (click canvas), gamepad, light thruster/approach audio
- Pause menu: save/load session, bookmarks, help toggle

## Controls

| Key | Action |
| --- | --- |
| W / S | Thrust forward / back |
| A / D | Strafe |
| R / F | Ascend / descend |
| Arrow keys / mouse | Look (click canvas for pointer lock) |
| Q / E | Roll |
| Shift | Boost |
| `/` | Searchable target picker |
| T / Y | Next / previous target |
| V / N | Pick in view / nearest |
| G | Approach target |
| H | Toggle orbit hold |
| I | Kiosk mode (random approach + orbit every 2 min) |
| O | Orbit lines |
| L | Labels |
| `;` | Minimap |
| U | Local-up toward target |
| K | Bookmark view |
| Esc | Abort approach / close UI / pause menu |
| `[` / `]` | Slower / faster time |
| P | Pause time |
| `\` | Reverse time |
| M | Toggle playable ↔ true scale |

Gamepad: left stick move, right stick look, triggers boost, bumpers roll.

## Assets & attribution

- Planet maps: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), via Wikimedia Commons
- Major moon maps: [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) (public domain / NASA)
- Earth night lights: three.js examples / NASA city lights mosaic
- Death Star: [Sebastian Sosnowski](https://sketchfab.com/3d-models/death-star-star-wars-3d5f01485e9e4e8b9d995d7764341afe) (CC BY-NC-ND 4.0) — see `public/models/deathstar/ATTRIBUTION.txt`
- Orbits use approximate J2000 mean elements for visualization (not navigation-grade ephemerides)
- Star Wars / Death Star are trademarks of Lucasfilm Ltd. / Disney
