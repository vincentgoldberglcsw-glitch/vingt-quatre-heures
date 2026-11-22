// Vehicle dynamics for Vingt-Quatre Heures.
//
// A double-track car: three chassis degrees of freedom (forward speed u, sideways speed v, yaw rate r) plus the spin of each
// of the four wheels. Tyre forces come from Pacejka "Magic Formula" curves with combined slip (friction circle), load
// sensitivity and per-wheel vertical load (static weight, aerodynamic downforce, and weight transfer under braking,
// acceleration and cornering). The engine has a torque curve, a five-speed gearbox with shift time, a slipping clutch for
// the launch, engine braking and a limited-slip differential. Brakes are per wheel and can lock; ABS and traction control
// are driver aids that can be switched off.
//
// Everything expensive is tabulated once by buildTables() during the loading screen (tyre curves, their slopes, the torque
// curve) and the step itself allocates nothing: it reads and writes typed arrays and plain numbers, at 480 Hz.
//
// Axes (body frame): x forward, y left. Yaw is positive turning left, matching the game's heading (forward = (sin h, cos h)
// in world x/z, left = (cos h, -sin h)).

const G0 = 9.81, RHO = 1.2;
const N = 2048, SMAX = 8;        // tyre tables: N samples over normalised slip 0..SMAX (1 = the peak of the curve)
const NT = 256, TMAX = 1.1;      // torque table: NT samples over rpm / redline 0..TMAX
const HZ = 480, VLOW = 1.6;      // physics rate; below VLOW m/s slip is measured against VLOW so it stays finite

// Magic Formula shape factors. C sets how much grip is left when the tyre is fully sliding (x: 71 %, y: 85 %).
const BX = 15.7, CX = 1.5, EX = 0.1, BY = 16.6, CY = 1.35, EY = -0.2;

export const LUT = { fx: new Float32Array(N + 2), fy: new Float32Array(N + 2), dfx: new Float32Array(N + 2), tq: new Float32Array(NT + 2), kPk: 0.11, aPk: 0.14, ready: false };
const magic = (x, B, C, E) => { const bx = B * x; return Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx)))); };

export function buildTables() {
  if (LUT.ready) return LUT;
  const peak = (B, C, E) => { let px = 0, pv = 0; for (let x = 0; x < 1.5; x += 0.0002) { const y = magic(x, B, C, E); if (y > pv) { pv = y; px = x; } } return [px, pv]; };
  const [kp, kv] = peak(BX, CX, EX), [ap, av] = peak(BY, CY, EY);
  LUT.kPk = kp; LUT.aPk = ap;      // slip ratio and tan(slip angle) at which each curve peaks
  for (let i = 0; i <= N + 1; i++) { const s = i / N * SMAX; LUT.fx[i] = magic(s * kp, BX, CX, EX) / kv; LUT.fy[i] = magic(s * ap, BY, CY, EY) / av; }
  for (let i = 0; i <= N; i++) LUT.dfx[i] = (LUT.fx[i + 1] - LUT.fx[i]) * N / SMAX;
  LUT.dfx[N + 1] = LUT.dfx[N];
  // engine: torque as a fraction of peak torque against rpm / redline. A broad curve peaking at 72 % of the redline,
  // falling away hard past it (the limiter).
  for (let i = 0; i <= NT + 1; i++) { const n = i / NT * TMAX; let t = 1 - 1.5 * (n - 0.72) * (n - 0.72); if (n > 1) t *= Math.max(0, 1 - (n - 1) * 30); LUT.tq[i] = Math.max(0, t); }
  LUT.ready = true; return LUT;
}
const look = (a, s) => { const f = (s < SMAX - 0.01 ? s : SMAX - 0.01) * (N / SMAX), i = f | 0; return a[i] + (a[i + 1] - a[i]) * (f - i); };
const torqueAt = n => { const f = (n < 0 ? 0 : n > TMAX ? TMAX : n) * (NT / TMAX), i = f | 0; return LUT.tq[i] + (LUT.tq[i + 1] - LUT.tq[i]) * (f - i); };

// What each car is made of. m: kg with driver and fuel. hp: engine. cla: downforce area. wf: share of weight on the
// front axle. mu: tyre grip (racing slicks of the period against road tyres). h: height of the centre of gravity.
const SPEC = {
  k:      { m: 900,  hp: 620, cla: 1.55, wf: 0.42, mu: 1.45, h: 0.37 },
  o:      { m: 880,  hp: 585, cla: 0.95, wf: 0.43, mu: 1.45, h: 0.37, aeroF: 0.56 },   // 1969 tail: little rear downforce, light at speed
  lh:     { m: 920,  hp: 620, cla: 1.05, wf: 0.42, mu: 1.45, h: 0.37 },
  lhs:    { m: 925,  hp: 620, cla: 0.98, wf: 0.42, mu: 1.43, h: 0.37 },   // bare-aluminium long tail: a little less downforce and grip
  f512:   { m: 940,  hp: 610, cla: 1.45, wf: 0.43, mu: 1.45, h: 0.38 },
  gt40:   { m: 1060, hp: 430, cla: 0.60, wf: 0.44, mu: 1.42, h: 0.40 },
  m1:     { m: 1420, hp: 277, cla: 0.18, wf: 0.44, mu: 1.12, h: 0.47 },
  p904:   { m: 760,  hp: 180, cla: 0.10, wf: 0.44, mu: 1.12, h: 0.44 },
  ghibli: { m: 1650, hp: 330, cla: 0.05, wf: 0.52, mu: 1.08, h: 0.52 },
  bb:     { m: 1580, hp: 360, cla: 0.12, wf: 0.43, mu: 1.12, h: 0.47 },
  lp400:  { m: 1310, hp: 375, cla: 0.08, wf: 0.42, mu: 1.12, h: 0.45, aeroF: 0.62 },   // light, little rear downforce: quick to rotate
  f400:   { m: 1480, hp: 340, cla: 0.06, wf: 0.52, mu: 1.10, h: 0.50 },
  b507:   { m: 1330, hp: 210, cla: 0.04, wf: 0.51, mu: 1.08, h: 0.50 },   // 1950s V8 roadster with its hardtop: soft and even
  p911:   { m: 1075, hp: 210, cla: 0.03, wf: 0.39, mu: 1.12, h: 0.46, aeroF: 0.66 },   // early-70s 911 Carrera: light, the engine hung out behind the rear axle (most of the weight at the back), little rear downforce: turns in eagerly and the tail swings out when you lift or turn in hard
  sherp:  { m: 1400, hp: 160, cla: 0.00, wf: 0.54, mu: 1.30, h: 0.42 },   // Sherp ATV: huge soft tyres with a big footprint (lots of grip), weight low and a touch forward, so it is sure-footed and pushes gently wide rather than spinning
};
export const MU_REF = 1.45;
const GEAR_V = [0.30, 0.46, 0.63, 0.83, 1.07];   // road speed at the redline in each gear, as a share of top speed

// Fixed numbers for one car, derived from its spec and from the top speed and grip the game already lists for it.
export function makeCar(key, M) {
  const s = SPEC[key] || SPEC.k, road = M.cls ? 1 : 0;
  const m = s.m, L = 2.55, a = L * (1 - s.wf), b = L * s.wf, tw = 1.52, R = 0.33, red = 8200, eff = 0.88, crr = 0.015;
  const wRed = red * Math.PI / 30, P = s.hp * 745.7, Tpk = P / (0.882 * wRed);
  const top = M.top, gr = new Float32Array(5); for (let i = 0; i < 5; i++) gr[i] = wRed * R / (GEAR_V[i] * top);
  // drag area is whatever makes the car run out of power exactly at its listed top speed
  const cda = Math.max(0.3, (P * (0.870 / 0.882) * eff / top - crr * m * G0) / (0.5 * RHO * top * top));
  const brakeG = road ? 1.5 : 2.3, bf = 0.62;
  return {
    key, m, L, a, b, tw, R, red, eff, crr, cda, cla: s.cla, aeroF: s.aeroF || 0.42, hcg: s.h, Iz: m * 1.45, mu: s.mu, gk: s.mu / MU_REF,
    Wf: m * G0 * b / L, Wr: m * G0 * a / L, Fz0: m * G0 / 4, kDf: 0.5 * RHO * s.cla / m, ls: 0.10, rsf: 0.6, muR: road ? 1.04 : 1.08,
    Tpk, gr, idle: 1100, launch: 4300, up: red * 0.965, down: 6300, shift: road ? 0.26 : 0.17, Iw: road ? 1.1 : 1.3, Ie: 0.13, lsd: road ? 25 : 70,
    TbF: m * G0 * brakeG * bf * 0.5 * R, TbR: m * G0 * brakeG * (1 - bf) * 0.5 * R, lock: 0.56,
    rollG: road ? 0.0042 : 0.0022, pitchG: road ? 0.0044 : 0.0026,
  };
}
// Lateral acceleration a car can hold at speed v: tyres on its own weight plus downforce. With no car given this is the
// reference racing car, which the track uses to work out how fast each corner can be taken.
export const latCap = (v, C) => C ? C.mu * (G0 + C.kDf * v * v) * 0.94 : MU_REF * (G0 + 0.5 * RHO * 1.5 / 900 * v * v) * 0.94;

export function createVehicle() {
  return { x: 0, z: 0, h: 0, u: 0, v: 0, r: 0, w: new Float32Array(4), fz: new Float32Array(4), sat: new Float32Array(4), kap: new Float32Array(4),
    abs: new Float32Array([1, 1, 1, 1]), tc: 1, thr: 0, brk: 0, delta: 0, steerIn: 0, steerN: 0, gear: 1, shiftT: 0, shiftLock: 0, rpm: 1100,
    ax: 0, ay: 0, axF: 0, ayF: 0, roll: 0, rollV: 0, pitch: 0, pitchV: 0, slip: 0, under: 0, spin: 0, lock: 0, shifted: 0 };
}
export const createInput = () => ({ st: 0, thr: 0, brk: 0, rev: 0, analog: 0 });
export const createEnv = () => ({ mu: new Float32Array([1, 1, 1, 1]), grade: 0, rr: 0, air: 0, aids: 1, sens: 0.5 });
// Put the car at rest, or rolling at speed u with the wheels turning to match.
export function resetVehicle(S, C, u = 0) {
  S.u = u; S.v = 0; S.r = 0; S.w.fill(u / (C ? C.R : 0.33)); S.abs.fill(1); S.tc = 1; S.thr = S.brk = 0; S.delta = S.steerIn = S.steerN = 0; S.shiftT = S.shiftLock = 0;
  S.ax = S.ay = S.axF = S.ayF = S.roll = S.rollV = S.pitch = S.pitchV = 0; S.slip = S.under = S.spin = S.lock = 0;
  S.gear = 1; if (C) { const v = Math.abs(u); for (let g = 0; g < 4; g++) if (v * C.gr[g] / C.R * 9.5493 > C.up * 0.9) S.gear = g + 2; S.rpm = Math.max(C.idle, v * C.gr[S.gear - 1] / C.R * 9.5493); }
}

const FZ = new Float32Array(4);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// Advance the car by dt seconds (one rendered frame), in as many 1/480 s steps as that takes.
// S: state (createVehicle). C: car (makeCar). I: pedals and wheel (createInput). E: road under the wheels (createEnv).
export function stepVehicle(S, C, I, E, dt) {
  if (!(dt > 0)) return;
  const spd = Math.abs(S.u), aids = E.aids ? 1 : 0;

  // ---- pedals: a foot takes time to move; a gamepad trigger is already smooth
  let thrIn = I.thr, revOn = 0;
  if (I.rev && S.u < 1.5) { revOn = 1; thrIn = S.u > -10 ? 0.55 : 0; }
  S.thr += clamp(thrIn - S.thr, -dt * 10, dt * (I.analog ? 12 : 4.5));
  S.brk += clamp(I.brk - S.brk, -dt * 14, dt * (I.analog ? 14 : 6.5));

  // ---- gearbox: automatic, with the drive cut for the length of the shift
  if (S.shiftT > 0) S.shiftT -= dt;
  S.shiftLock -= dt; S.shifted = 0;
  if (revOn) S.gear = -1;
  else if (S.gear < 1) S.gear = 1;
  else if (S.shiftT <= 0 && S.shiftLock <= 0) {
    const g = S.gear, rpmW = Math.abs(0.5 * (S.w[2] + S.w[3]) * C.gr[g - 1]) * 9.5493, slipR = Math.max(S.kap[2], S.kap[3]);
    if (rpmW > C.up && g < 5 && S.thr > 0.3 && slipR < 0.3) { S.gear++; S.shiftT = C.shift; S.shiftLock = 0.45; S.shifted = 1; }
    else if (g > 1 && rpmW * C.gr[g - 2] / C.gr[g - 1] < C.down + (S.brk > 0.2 ? 500 : 0)) { S.gear--; S.shiftT = C.shift * 0.8; S.shiftLock = 0.35; S.shifted = -1; }
  }

  // ---- steering. The front wheels trail towards the way the car is actually travelling (caster), which is what lets a
  // slide be caught. With the aids on, the driver's input is a slip angle on top of that: full lock asks the front tyres
  // for just under their peak, at any speed and in any corner, so a key press never scrubs the fronts. With the aids
  // off the wheel is more direct and the fronts can be over-driven. Below walking pace it is plain steering lock.
  const muAvg = 0.25 * (E.mu[0] + E.mu[1] + E.mu[2] + E.mu[3]);
  const lock = C.lock * (0.45 + 0.55 * E.sens), aPk = Math.atan(LUT.aPk), w = S.u > 0 ? clamp((spd - 3) / 7, 0, 1) : 0;
  const bf = spd > 2 ? clamp(Math.atan2(S.v + C.a * S.r, spd), -0.5, 0.5) : 0;      // direction of travel at the front axle
  const kin = Math.atan(C.L * C.mu * muAvg * (G0 + C.kDf * spd * spd) / Math.max(spd * spd, 1));
  const trail = w * bf * (aids ? 0.85 : 0.5), dMax = (1 - w) * lock + w * (aids ? aPk * 0.9 + kin * 0.15 : Math.min(lock, kin * 0.5 + aPk * 1.35));
  // stability help: when the tail is already sliding out, steering further into the corner is eased off, as a driver would unwind the lock
  const beta = spd > 6 ? Math.atan2(S.v, spd) : 0, rMax = C.mu * muAvg * (G0 + C.kDf * spd * spd) / Math.max(spd, 6);
  let st = I.st;
  if (aids) { if (st * beta < 0) st *= 1 - 0.9 * clamp((Math.abs(beta) - 0.045) / 0.1, 0, 1); if (st * S.r > 0) st *= clamp(1 - (Math.abs(S.r) / rMax - 0.92) * 4, 0, 1); }      // ...and never asked to turn faster than the grip can hold
  const rate = (I.analog ? 5.5 : 1.3 + 3.6 * E.sens) / (1 + spd / 70) * (Math.abs(I.st * dMax) < Math.abs(S.steerIn) ? 1.7 : 1);
  // the caster part follows the car at once (the tyres do that themselves); only the driver's part is limited by how fast hands move
  S.steerIn += clamp(st * dMax - S.steerIn, -rate * dt * (st === I.st ? 1 : 3), rate * dt * (st === I.st ? 1 : 3)); S.steerIn = clamp(S.steerIn, -dMax, dMax);
  S.delta = clamp(trail + S.steerIn, -lock, lock);
  S.steerN = clamp(S.steerIn / dMax, -1, 1);

  let n = Math.ceil(dt * HZ - 1e-6); if (n < 1) n = 1; if (n > 30) n = 30;
  const h = dt / n;
  for (let k = 0; k < n; k++) substep(S, C, I, E, h, aids);

  // ---- what the rest of the game reads
  const g = S.gear, ratio = g > 0 ? C.gr[g - 1] : C.gr[0] * 1.05, rpmW = Math.abs(0.5 * (S.w[2] + S.w[3]) * ratio) * 9.5493;
  const rpmT = S.shiftT > 0 ? Math.max(C.idle, rpmW) : Math.max(rpmW, C.idle + (C.launch - C.idle) * S.thr * (g === 1 || g < 0 ? 1 : 0));
  S.rpm += (Math.min(rpmT, C.red * 1.02) - S.rpm) * Math.min(1, dt * 16);
  let sat = 0; for (let i = 0; i < 4; i++) if (S.fz[i] > 200 && S.sat[i] > sat) sat = S.sat[i];
  const fs = Math.max(S.sat[0], S.sat[1]), rs = Math.max(S.sat[2], S.sat[3]), v2 = Math.hypot(S.u, S.v);
  S.slip = v2 > 2.5 || Math.abs(S.w[2] * C.R) > 4 ? clamp((sat - 0.8) * 9, 0, 14) : 0;
  S.under = fs > 1.25 && fs > rs * 1.15 && v2 > 12 ? 1 : 0;
  S.spin = S.thr > 0.2 && Math.max(S.kap[2], S.kap[3]) > LUT.kPk * 1.6 ? 1 : 0;
  S.lock = v2 > 3 && Math.min(S.kap[0], S.kap[1], S.kap[2], S.kap[3]) < -0.5 ? 1 : 0;
  // the body leans on its springs: roll in corners, dive under braking, squat on the throttle
  const pT = clamp(-S.axF * C.pitchG, -0.06, 0.06), rT = clamp(-S.ayF * C.rollG, -0.07, 0.07);
  S.pitchV += (90 * (pT - S.pitch) - 11 * S.pitchV) * dt; S.pitch += S.pitchV * dt;
  S.rollV += (90 * (rT - S.roll) - 11 * S.rollV) * dt; S.roll += S.rollV * dt;
}

function substep(S, C, I, E, h, aids) {
  const u = S.u, v = S.v, r = S.r, L = C.L, tw = C.tw * 0.5, R = C.R;
  // Ackermann: the inside front wheel turns further than the outside one
  const td = Math.tan(S.delta), dl = Math.atan(L * td / (L - tw * td)), dr = Math.atan(L * td / (L + tw * td));
  // vertical load on each tyre
  if (E.air) FZ.fill(0);
  else {
    const aero = 0.5 * RHO * C.cla * u * u, zf = C.Wf + aero * C.aeroF, zr = C.Wr + aero * (1 - C.aeroF);
    const dx = C.m * S.axF * C.hcg / L, dy = C.m * S.ayF * C.hcg / C.tw;
    FZ[0] = Math.max(0, 0.5 * (zf - dx) - C.rsf * dy); FZ[1] = Math.max(0, 0.5 * (zf - dx) + C.rsf * dy);
    FZ[2] = Math.max(0, 0.5 * (zr + dx) - (1 - C.rsf) * dy); FZ[3] = Math.max(0, 0.5 * (zr + dx) + (1 - C.rsf) * dy);
  }
  // engine and clutch
  const g = S.gear, ratio = g > 0 ? C.gr[g - 1] : -C.gr[0] * 1.05, wr = 0.5 * (S.w[2] + S.w[3]);
  const rpmW = Math.abs(wr * ratio) * 9.5493, bite = C.idle + (C.launch - C.idle) * S.thr, slipping = rpmW < bite, open = S.shiftT > 0;
  const rpmE = slipping ? bite : rpmW, nE = rpmE / C.red;
  let Te = 0;
  if (!open) { Te = S.thr * torqueAt(nE) * C.Tpk; if (!slipping) Te -= (1 - S.thr) * C.Tpk * (0.05 + 0.11 * nE); if (nE > 1.005) Te = -0.25 * C.Tpk; }
  const Tax = Te * ratio * C.eff * S.tc;      // torque at the rear axle
  const IwR = C.Iw + (open || slipping ? 0 : 0.5 * C.Ie * ratio * ratio);
  const kp = LUT.kPk, ap = LUT.aPk;

  let FX = 0, FY = 0, MZ = 0;
  for (let i = 0; i < 4; i++) {
    const front = i < 2, xw = front ? C.a : -C.b, yw = (i & 1) ? -tw : tw, dw = i === 0 ? dl : i === 1 ? dr : 0, cs = Math.cos(dw), sn = Math.sin(dw);
    const vx = u - r * yw, vy = v + r * xw, vl = vx * cs + vy * sn, vt = vy * cs - vx * sn, vref = Math.max(Math.abs(vl), VLOW);
    const fz = FZ[i], Fmax = E.mu[i] * C.mu * (front ? 1 : C.muR) * (1 - C.ls * (fz / C.Fz0 - 1)) * fz;
    const sy = -(vt / vref) / ap, Iw = front ? C.Iw : IwR;
    let w = S.w[i], kap = (w * R - vl) / vref, sx = kap / kp, s = Math.hypot(sx, sy);
    const Fx0 = s > 1e-6 ? Fmax * look(LUT.fx, s) * sx / s : 0;
    const kx = Fmax * Math.max(look(LUT.dfx, s), 0.04 * LUT.dfx[0]) / kp * R / vref;      // how fast the tyre force answers a change in wheel speed
    const Td = front ? 0 : 0.5 * Tax + C.lsd * (S.w[i === 2 ? 3 : 2] - w);
    const Tb = S.brk * (front ? C.TbF : C.TbR) * S.abs[i], Tfree = Td - Fx0 * R, den = Iw + h * R * kx;
    if (Tb > 0) {
      if (Math.abs(w) < 1e-3 && Math.abs(Tfree) <= Tb) w = 0;                            // held by the brake
      else { const sg = w !== 0 ? Math.sign(w) : Math.sign(Tfree), w1 = w + h * (Tfree - sg * Tb) / den; w = w1 * sg < 0 ? 0 : w1; }   // a brake can stop a wheel, not turn it backwards
    } else w += h * Tfree / den;
    S.w[i] = w;
    kap = (w * R - vl) / vref; sx = kap / kp; s = Math.hypot(sx, sy);
    let Fx = 0, Fy = 0; if (s > 1e-6) { Fx = Fmax * look(LUT.fx, s) * sx / s; Fy = Fmax * look(LUT.fy, s) * sy / s; }
    const bx = Fx * cs - Fy * sn, by = Fx * sn + Fy * cs;
    FX += bx; FY += by; MZ += xw * by - yw * bx;
    S.kap[i] = kap; S.sat[i] = s; S.fz[i] = fz;
    if (aids) {
      if (S.brk > 0.05 && Math.abs(vl) > 3) S.abs[i] = clamp(S.abs[i] + h * clamp((kap + kp * 1.15) * 160, -18, 7), 0.05, 1); else S.abs[i] = 1;
    } else S.abs[i] = 1;
  }
  if (aids && S.thr > 0.05) S.tc = clamp(S.tc + h * clamp((kp * 1.15 - Math.max(S.kap[2], S.kap[3])) * 130, -12, 6), 0.1, 1); else S.tc = 1;

  // chassis
  const sgn = clamp(u * 2, -1, 1);
  FX -= 0.5 * RHO * C.cda * u * Math.abs(u) + (C.crr * G0 + E.rr) * C.m * sgn + C.m * G0 * E.grade;
  const ax = FX / C.m, ay = FY / C.m, kf = Math.min(1, h / 0.07);
  S.u += h * (ax + v * r); S.v += h * (ay - u * r); S.r += h * MZ / C.Iz;
  S.ax = ax; S.ay = ay; S.axF += (ax - S.axF) * kf; S.ayF += (ay - S.ayF) * kf;
  // parked: with no throttle a stopped car stays put (handbrake), rather than creeping on its tyres or rolling down a hill
  if (S.thr < 0.02 && !I.rev && Math.abs(S.u) < 0.35 && Math.abs(S.v) < 0.35) { S.u = S.v = S.r = 0; S.w.fill(0); }
  S.h += S.r * h;
  const sh = Math.sin(S.h), ch = Math.cos(S.h);
  S.x += (S.u * sh + S.v * ch) * h; S.z += (S.u * ch - S.v * sh) * h;
}
