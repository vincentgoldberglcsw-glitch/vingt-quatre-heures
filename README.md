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

**Alameda free drive (a 34 km loop round the bay, overcast with dark clouds by default):**
- Starts parked at the kerb outside 1611 San Antonio Ave. West, right onto Paru St for ten blocks of craftsman houses, Victorians and corner apartments (yellow crosswalks, stop signs, street blades), left on Central Ave past the Alameda Theatre and the Fuzzy Caterpillar billboard.
- Wilma Chan Way: Out and In Burger on the left (mission style, red tiles, a tower, the burger on a pole; you can pull in), then the ivy-walled overpass down to the Posey Tube portal.
- I-880 north: the Port of Oakland (cranes, container yards, ships), a train alongside, warehouses and the abandoned Bayside Steel Works, downtown Oakland beyond.
- The DETOUR exit before the toll plaza: steer into the right-hand exit lane and you come out in Richmond.
- Burnt-out, smouldering buildings by the toll plaza. The Bay Bridge has traffic (cars, pickups, trucks, motorcycles, horse and buggy) and burning wrecks. The earthquake drops the right-hand lanes: cones, WARNING boards, and the traffic in those lanes goes into the hole. Fall in and you get the kelp forest, the octopus, the manatee and the tanker.
- San Francisco: downtown with the pyramid tower, AI billboards, the giant blinking eyes, a quake with rubble, then Hyde St up Russian Hill behind the cable car. From the top: Coit Tower right, Alcatraz ahead, the Golden Gate left. Down to Fisherman's Wharf and west along the Marina.
- The Golden Gate Bridge (fog), the Marin redwoods with hawks swooping, San Quentin, the Richmond–San Rafael bridge, Richmond and 3060 Shane Dr (lots of wild turkeys), the refinery.
- I-80 south on a viaduct: the Berkeley hills and the campanile on the left, Emeryville, Oakland, then the Webster Tube back to Alameda, Buena Vista Ave, Grand St and home.

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
- `DRIVE` is true for the Alameda free drive (`?mode=drive`). The loop is built by `buildRoute()` (a turtle: S straight, L/R turns, M marks a named point). `Z` holds those marks as track indices (`start`, `paru`, `central`, `wilma`, `tu0`/`tu1`, `detour`, `toll`, `b0`/`b1`, `hyde`, `marina`, `gg0`/`gg1`, `sq`, `rb0`/`rb1`, `shane`, `i80`, `wt1`/`wt0`, `bv`) and scenery is placed relative to them. Static scenery is merged by `bakeStatic()` and culled beyond 3 km; dynamic things (traffic, cable car, train, hawks) live in the extras block near `extrasTick()`.
- URL options for testing: `?auto=1` skips the home screen, `&drive=1` autopilot, `&cam=0..3`, `&wx=sun|overcast|rain|hail|snow`, `&model=k|o|lh|f512|gt40|m1|p904|ghibli|bb`, `&t=<hour>`, `&mode=drive`, `&go=1` (skip the track choice).
- `window.__test` exposes `step(n)`, `autopilot(n)`, `goto(index)`, `startDrive()`, and the game state (`G`, `PL`, `ents`, `Z`) for scripted checks.
- Large edits were made by replacing exact marker strings; always check the browser console after a change, since one stray comment on a shared line can swallow code.
