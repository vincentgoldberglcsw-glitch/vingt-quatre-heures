# Vingt-Quatre Heures

A 3D browser driving game in the style of the 1971 film *Le Mans*, with two tracks: the Le Mans circuit, and a 34 km drive from a house in Alameda round San Francisco Bay and home again. Graphics use Three.js r165 from a CDN; textures, models and sounds are generated in code. There is no build step: the site is static files.

The original single-file version of the game is kept, untouched and playable, in `classic/` (on the site: `/classic/`).

## How to run

- **On the web:** open the site. Any static host works; pushing to `main` on GitHub redeploys the Vercel site.
- **On this Windows PC:** double-click `play.bat`. It starts `serve.ps1`, a small local web server on port 8765, and opens the game.
- The game must be served over http, not opened as a file, because it loads its code as modules.

## What changed in the rebuild (November 2026)

**Driving.** The car is now a simulated machine (`js/sim/vehicle.js`), not a point that slides:
- Four tyres, each with its own load, slip ratio and slip angle. Grip comes from Pacejka "Magic Formula" curves with a friction circle, so braking and cornering share the same grip, and a locked or spinning wheel has less of it.
- Weight transfer: braking loads the front tyres, accelerating the rear, cornering the outside. Downforce grows with the square of speed (a 917K corners at about 1.2 g at 50 km/h and 1.9 g at 250 km/h).
- Engine torque curve, five gears with a shift time, a clutch that slips for the launch, engine braking, a limited-slip differential, rear-wheel drive. Each car has its own weight, power, drag and gearing, set so it still reaches the top speed listed on the title screen.
- Brakes per wheel, which can lock. Two wheels on the grass pull the car round.
- Driver aids (H switches them off): ABS, traction control, and steering help that keeps the front tyres just under their peak and unwinds lock when the tail slides. With the aids off it drives as a 1970 car did.
- The body rolls, dives and squats on its springs. Rivals' corner speeds come from the same tyre model, so the race stays fair.
- The tyre curves and the torque curve are tabulated once during loading; the physics runs at 480 steps a second without allocating memory.

**The land.** The hills are the real ones (`js/world/terrain.js`). `assets/bay-dem.png` is the surveyed height of the land round the bay (USGS data via the public Terrain Tiles set on AWS; `tools/fetch-elevation.ps1` rebuilds it). The game's map is a compressed sketch of the real one, so the survey is fitted to it through 29 named points on the route. Where the real ground is flat the game is flat (Alameda is, to within a few metres); where it rises - San Francisco, the Marin headlands, the hills behind Richmond, Berkeley and Oakland - it rises, with grass, woodland and houses on it. The skyline behind everything is the true horizon from wherever the car is, redrawn as you drive. Ground near the road and under anything already built is kept level.

**Loading.** A loading screen appears at once and the world is built in named stages behind it. The hills are raised tile by tile (640 m squares, nearest first) in a few milliseconds a frame. After the first visit the engine, code and map data are kept on the device (`sw.js`), so the game starts faster and works offline.

**Corners.** Every junction on the Alameda loop has roughly twice the radius it had (tightest corner in town 51 m, was 30 m; in the city 54 m, was 31 m), with the tubes, bridges and coastlines left where they were.

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
- Marina Blvd: a long, sweeping left off the foot of Hyde St, cows grazing in a field on the left, and on the right a dark grey sea that breaks over the wall and washes across the road (it drags the car and shoves it sideways), leaving fish, squid and kelp behind.
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
| H | driver aids on/off (ABS, traction control, steering help) |
| R | put the car back on the road |
| Esc | back to the home screen |

## Changes on 15 November 2026

- **Home screen:** *Les 24 Heures du Mans* (The 24 Hours of Le Mans) and *Alameda* (Around the Bay and Back). Classic cars carry no race numbers.
- **Weather and time:** the Alameda drive is slightly overcast by default, with darker cloud rolling over now and then; the day runs a third as fast (dusk about 20 minutes in).
- **Bugs fixed:** the Bay Bridge earthquake now opens a real hole onto the water and drops the car straight through it ("THE BRIDGE GAVE WAY"); traffic caught in it recovers its speed; the manatee scene no longer goes black (its camera could end up inside a bridge pier).
- **Driving:** the turns onto Paru St and Central Ave are crossroads (both streets carry on, the junction is paved and open on the outside of the turn). In town and the city the car can drive up the kerb and along the pavement; street trees, shop-front planters and benches are solid.
- **McQueen:** shorter (about 1.66 m), stands with his weight on one leg, sways, glances about, smokes at irregular moments; the helmet under his arm has a visor.
- **Alameda:** a neighbourhood of plain houses fills the blocks behind Paru to the shore; a supermarket ("Safemart", a lookalike, with a car park you can drive into) on the left of Paru after Encinal; the Central Ave shops are all different; crows on the poles and wires take off as you pass; more trees on Wilma Chan Way; a new face on the Fuzzy Caterpillar sign; about one parked car in seven is an angular stainless pickup.
- **Freeways and bridges:** newspapers blow about in the tubes; ducks with ducklings cross I-880 now and then; I-880 and San Rafael bridge traffic is lighter and quicker; street lamps with pools of light along I-880, I-80 and the San Rafael bridge; old-fashioned billboards (old-time candy, a robot lollipop, a roller rink, a drive-in, a tyre shop); a refinery with gas flares at the Richmond end of the San Rafael bridge, and oil tankers at anchor.

## Still to do

1. Make the classic cars look like the real cars. They are all built from one smooth racing-car body, so they have no proper roofline, windows, bumpers or lights. They need their own body builder. (Assessed at about 2 to 3 hours; paused by the owner.)
2. The owner's list, not yet done: an earthquake on the San Rafael bridge with a falling deck panel you can drop through; crashing off that bridge into a whirlpool that pulls you down; better visuals for Richmond. The supermarket was built without the owner's photo; it should be checked against it.
3. Extend San Francisco with a steep street of Victorian houses, then a drop to the wharf.
4. An option to board a ferry to Alcatraz.
5. More Le Mans ad boards, once the owner supplies the images.
6. Nothing in the game's sound has been checked by ear. The engine note now follows the real revs and gear changes, but the sound itself is the old synthesiser.
7. The road's own height profile is still hand-made (the climbs onto the bridges, Hyde Street and so on); only the land beside it comes from the survey.
8. The world's models are still built in code. Imported 3D models (buildings from OpenStreetMap, Blender-made cars) would be the next step up in looks.
9. Manual gears, and a steering wheel with force feedback.

## Notes for whoever works on this next

- Files: `index.html` (page, styles, loading screen), `js/game.js` (the game: world, cars, weather, sound, interface, main loop), `js/sim/vehicle.js` (driving model), `js/world/terrain.js` (survey, hills, horizon), `js/boot.js` (loading stages), `sw.js` (offline copy), `vercel.json` (cache headers), `classic/index.html` (the original).
- `js/game.js` is dense. Section markers, in order: TRACK, VEGETATION, CROWD, STRUCTURES, FREE DRIVE WORLD, CARS, McQUEEN, SKY + LIGHT, WEATHER, PARTICLES / WRECKS, AUDIO, GAME, TIME OF DAY, POST, UI + INPUT, RUNNING START + INTRO MONTAGE, LOOP. Each `await BOOT.step(...)` line is a loading stage.
- The player's car: `playerUpdate()` hands the car's speed to `stepVehicle()` in the car's own frame each time and takes back position, heading and speed, so walls, bumps and other cars can still push it between steps. `window.__test.VS` is the live vehicle state; `__test.dyn()` the current car's numbers.
- The track is a closed spline sampled into `P[]` (points), `T[]` (tangents), `Nn[]` (left normals), about 2 m apart. `H[]` is road height and `XW[]` extra half-width (free drive only). `off(i, lateral, heightAboveRoad)` and `at(s, lateral, heightAboveRoad)` place things; `ribbon(...)` builds strips along the road and accepts functions for offsets and heights.
- `DRIVE` is true for the Alameda free drive (`?mode=drive`). The loop is built by `buildRoute()` (a turtle: S straight, L/R turns, M marks a named point). `Z` holds those marks as track indices (`start`, `paru`, `central`, `wilma`, `tu0`/`tu1`, `detour`, `toll`, `b0`/`b1`, `hyde`, `marina`, `gg0`/`gg1`, `sq`, `rb0`/`rb1`, `shane`, `i80`, `wt1`/`wt0`, `bv`) and scenery is placed relative to them. Static scenery is merged by `bakeStatic()` and culled beyond 3 km; dynamic things (traffic, cable car, train, hawks) live in the extras block near `extrasTick()`.
- URL options for testing: `?auto=1` skips the home screen, `&drive=1` autopilot, `&cam=0..3`, `&wx=sun|overcast|rain|hail|snow`, `&model=k|o|lh|f512|gt40|m1|p904|ghibli|bb`, `&t=<hour>`, `&mode=drive`, `&go=1` (skip the track choice).
- `window.__test` exposes `step(n)`, `autopilot(n)`, `goto(index)`, `startDrive()`, and the game state (`G`, `PL`, `ents`, `Z`) for scripted checks.
- Large edits were made by replacing exact marker strings; always check the browser console after a change, since one stray comment on a shared line can swallow code.
- Marina Blvd (`MAR`, `marinaTick()`): the turn radius is `MR`; Hyde St and the Marina straight are each shortened by `MR-60` so the Golden Gate does not move, and the Marina is georeferenced at the old corner. `marinaTick` runs per frame, not in `sim()`, so scripted tests call `__MAR.tick(1/60)` after each `__test.autopilot(1)` (and set `__MAR.hold=true` to stop the frame loop moving the waves). `PL.wash` (0..1) is the wave on the car, read in `playerUpdate()`.
- Alameda corners (`PR`, `CR`, `WR`, `HR1`..`HR3` next to `MR`): Paru St and Grand St stay where they were (the straights before them are shortened to suit), Central Ave moves north as `CR` grows and `lead()` trims Central and Wilma Chan Way so the Posey Tube does not move. The Paru crossroads (`JN`), the neighbourhood grid (`US`) and the grass `bare` list read `PR`/`CR`, so change the constants, not the numbers.
- Jump points (`JUMPS`, `jumpTo()`, `?from=bb|sf|gg|i80`, keys 3-6 / H on the home screen): the drive starts stopped in the right-hand lane, and `pe.dist` is counted from the house so `driveHome()` still finishes the drive. `__test.jumpTo('sf')` does the same after `__test.startDrive()`.
