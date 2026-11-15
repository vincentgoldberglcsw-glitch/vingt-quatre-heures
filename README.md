# Vingt-Quatre Heures

A 3D browser driving game in the style of the 1971 film *Le Mans*. Everything is in one file, `index.html`: no art or sound files, no build step. Graphics use Three.js r165 loaded from a CDN; all textures, models and sounds are generated in code.

## How to run

- **On the web:** open the site (any static host works; `index.html` is the whole game).
- **On this Windows PC:** double-click `play.bat`. It starts `serve.ps1`, a small local web server on port 8765, and opens the game.
- The game must be served over http, not opened as a file, because it loads Three.js as a module.

## What is in the game

**Home screen:** choose a track (1 Le Mans, 2 Alameda), then the car class (V switches racing / classic), the car (left/right), colours (A/D), weather (up/down) and steering sensitivity ([ and ]). Enter starts.

**Le Mans (3-lap race, 24 hours of light):**
- Running start with drivers jumping in, and a film-style intro montage with a heartbeat.
- Seven rivals kept close to the player; "you're in the lead" notices; chequered-flag finish.
- Potholes, a tyre-arch bridge, ad boards (cigarettes, wine, bread), a faint French announcer.
- Wild turkeys on the track, and an old man with a cane who crosses now and then.
- Crashes only at high speed, with crumpling bodywork, fire, and an "oh no" voice.

**Alameda free drive:**
- Starts at 1611 San Antonio Avenue: houses, shops, telephone poles with crows, turkeys, blowing leaves, jazz radio.
- The Fuzzy Caterpillar School billboard, then Out and In Burger on a hill (you can pull in).
- A jump into the tube, which fills with black smoke.
- A long viaduct 25 m up with a view of Emeryville and the Berkeley hills; you can fall off it.
- Toll plaza, a climb onto the Bay Bridge with sun flare and howling wind, fog banks, flocks of birds.
- An earthquake drops half the bridge deck. Fall in and you get the underwater kelp forest, the octopus, the manatee with its pipe, and the tanker.
- San Francisco: a steep hill with a Golden Gate view, a second earthquake with rubble, Fisherman's Wharf, Coit Tower, Alcatraz, AI billboards.

**Cars:**
- Racing: Porsche 917 (1969), 917K, 917LH, Ferrari 512 S, Ford GT40 Spyder.
- Classic: BMW M1, Porsche 904, Maserati Ghibli, Ferrari 512 BB.
- Each has three colour schemes.

**Weather:** sun (a heatwave: melting tyres, wildfires), overcast, rain (with lightning), hail, snow. Each changes grip.

## Controls

| Key | Action |
|---|---|
| Arrows or WASD | steer, accelerate, brake |
| Space | brake |
| X | reverse |
| C | camera (chase, cockpit, helicopter, trackside) |
| T | weather |
| [ and ] | steering sensitivity |
| N | announcer on/off |
| M | music on/off (off by default) |
| P | pause |
| R | put the car back on the road |
| Esc | back to the home screen |

## Still to do

1. Make the classic cars look like the real cars. They are all built from one smooth racing-car body, so they have no proper roofline, windows, bumpers or lights. They need their own body builder.
2. Extend San Francisco with a steep street of Victorian houses, then a drop to the wharf.
3. An option to board a ferry to Alcatraz.
4. More Le Mans ad boards, once the owner supplies the images.
5. Nothing in the game's sound has been checked by ear. The cockpit dials are shared by all cars.

## Notes for whoever works on this next

- `index.html` is about 265 KB of dense JavaScript in one module. Section markers, in order: TRACK, VEGETATION, CROWD, STRUCTURES, FREE DRIVE WORLD, CARS, McQUEEN, SKY + LIGHT, WEATHER, PARTICLES / WRECKS, AUDIO, GAME, TIME OF DAY, POST, UI + INPUT, RUNNING START + INTRO MONTAGE, LOOP.
- The track is a closed spline sampled into `P[]` (points), `T[]` (tangents), `Nn[]` (left normals), about 2 m apart. `H[]` is road height and `XW[]` extra half-width (free drive only). `off(i, lateral, heightAboveRoad)` and `at(s, lateral, heightAboveRoad)` place things; `ribbon(...)` builds strips along the road and accepts functions for offsets and heights.
- `DRIVE` is true for the Alameda free drive (`?mode=drive`). `Z` holds the zone boundaries (`tu0`, `tu1` tube; `b0`-`b1` first bridge; `b1`-`b2` city; `b2`-`b3` second bridge). Most free-drive scenery is placed relative to those.
- URL options for testing: `?auto=1` skips the home screen, `&drive=1` autopilot, `&cam=0..3`, `&wx=sun|overcast|rain|hail|snow`, `&model=k|o|lh|f512|gt40|m1|p904|ghibli|bb`, `&t=<hour>`, `&mode=drive`, `&go=1` (skip the track choice).
- `window.__test` exposes `step(n)`, `autopilot(n)`, `goto(index)`, `startDrive()`, and the game state (`G`, `PL`, `ents`, `Z`) for scripted checks.
- Large edits were made by replacing exact marker strings; always check the browser console after a change, since one stray comment on a shared line can swallow code.
