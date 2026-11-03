// Unit tests: bundle with esbuild and run with node (see package script in README).
import { RigBuilder } from '../src/builder';
import { compileRig, createPose, resetPose, solve, displayList, applyAnimation } from '../src/core';
import { createSM, setInput, advanceSM, type StateMachine } from '../src/state-machine';

let failed = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failed++; };
const near = (a: number, b: number, eps = 0.5) => Math.abs(a - b) <= eps;

// ── 1. two-bone IK reaches a reachable target, both bend directions ──
for (const invertDirection of [false, true]) {
  const b = new RigBuilder(400, 400);
  const root = b.node(0, { x: 100, y: 100 });
  const upper = b.rootBone(root, { length: 50 });
  const lower = b.bone(upper, { length: 50 });
  const target = b.node(0, { x: 150, y: 150 });
  b.ik(lower, target, { invertDirection });
  const rig = compileRig(b.build()), pose = createPose(rig); solve(rig, pose);
  const w = pose.world[lower], tipX = w[0] * 50 + w[4], tipY = w[1] * 50 + w[5];
  ok(near(tipX, 150) && near(tipY, 150), `IK (invert=${invertDirection}) tip reaches target: (${tipX.toFixed(2)}, ${tipY.toFixed(2)})`);
  const elbowY = pose.world[lower][5];
  ok(invertDirection ? elbowY > 100 + 50 * 0.2 || elbowY < 150 : true, `IK (invert=${invertDirection}) elbow at (${pose.world[lower][4].toFixed(1)}, ${elbowY.toFixed(1)})`);
}

// ── 2. skinning: bending the elbow 90° moves the hand end of a skinned arm around the elbow ──
{
  const b = new RigBuilder(400, 400);
  const root = b.node(0, { x: 0, y: 0 });
  const upper = b.rootBone(root, { length: 100 });
  const lower = b.bone(upper, { length: 100 });
  const shape = b.shape(0);
  const path = b.path(shape, [[0, -10], [200, -10], [200, 10], [0, 10]]);
  b.fill(shape, 0xff000000);
  b.skin(path, [upper, lower]);
  const rig = compileRig(b.build()), pose = createPose(rig);
  resetPose(rig, pose); pose.p[lower].rotation = Math.PI / 2; solve(rig, pose);
  const list = displayList(rig, pose);
  const pts = list[0].path.filter(c => c[0] === 0 || c[0] === 1).map(c => [c[1], c[2]]);
  // vertex (200,-10) is ~fully on the lower bone → rotates 90° about the elbow (100,0) → (110, 100)
  ok(near(pts[1][0], 110, 1) && near(pts[1][1], 100, 1), `skin: hand-end vertex → (${pts[1][0].toFixed(1)}, ${pts[1][1].toFixed(1)}) expected (110, 100)`);
  ok(near(pts[0][0], 0, 1) && near(pts[0][1], -10, 1), `skin: shoulder vertex stays → (${pts[0][0].toFixed(1)}, ${pts[0][1].toFixed(1)})`);
}

// ── 3. state machine: trigger starts a 0.5 s blend from "idle" to "jump" ──
{
  const b = new RigBuilder(100, 100);
  const n = b.node(0, { x: 0 });
  b.animation('idle', 60, 60, { [n]: { x: [[0, 0], [60, 10]] } }, 1);
  b.animation('jump', 60, 60, { [n]: { x: [[0, 100], [60, 100]] } });
  const rig = compileRig(b.build()), pose = createPose(rig);
  const sm: StateMachine = { name: 'main', inputs: [{ name: 'go', type: 'trigger' }, { name: 'speed', type: 'number' }], layers: [{
    name: 'body', entry: 'idle', states: [{ name: 'idle', animation: 'idle' }, { name: 'jump', animation: 'jump' }, { name: 'fast', animation: 'idle', speed: 2 }],
    transitions: [{ from: 'idle', to: 'jump', duration: 0.5, conditions: [{ input: 'go' }] }, { from: '*', to: 'fast', conditions: [{ input: 'speed', op: '>', value: 5 }] }] }] };
  const inst = createSM(sm);
  const step = (dt: number) => { resetPose(rig, pose); advanceSM(rig, pose, sm, inst, dt); solve(rig, pose); return pose.p[n].x as number; };
  const x0 = step(0.5);
  ok(near(x0, 5, 0.01), `SM idle at 0.5 s → x = ${x0.toFixed(3)} (expected 5)`);
  setInput(inst, 'go');
  const x1 = step(0.25); // transition fires this frame (mix 0) — idle continues at 0.75 s
  const x2 = step(0.25); // mix 0.5: idle@1.0 s (loops → 0) blended with jump (100)
  ok(near(x1, 7.5, 0.01), `SM transition starts with idle still showing → x = ${x1.toFixed(3)} (expected 7.5)`);
  ok(near(x2, 50, 0.5), `SM halfway through 0.5 s blend → x = ${x2.toFixed(3)} (expected ≈ 50)`);
  const x3 = step(0.3);
  ok(near(x3, 100, 0.01), `SM blend finished → x = ${x3.toFixed(3)} (expected 100)`);
  ok(inst.fired.go === false, 'SM trigger consumed');
  setInput(inst, 'speed', 9); step(0.01);
  ok(sm.layers[0].states[inst.layers[0].state].name === 'fast', `SM any-state transition on number input → ${sm.layers[0].states[inst.layers[0].state].name}`);
}

// ── 4. applyAnimation mix ──
{
  const b = new RigBuilder(10, 10); const n = b.node(0, { x: 0 });
  b.animation('a', 60, 60, { [n]: { x: [[0, 40]] } });
  const rig = compileRig(b.build()), pose = createPose(rig);
  resetPose(rig, pose); applyAnimation(rig, pose, rig.animations[0], 0, 0.25);
  ok(near(pose.p[n].x as number, 10, 1e-6), `applyAnimation mix 0.25 → ${pose.p[n].x}`);
}

// ── 5. blending an unkeyed scale starts from 1, not 0 (regression: mascot collapsed on fly → stand) ──
{
  const b = new RigBuilder(10, 10); const n = b.node(0, {});
  b.animation('s', 60, 60, { [n]: { scaleX: [[0, 1.2]] } });
  const rig = compileRig(b.build()), pose = createPose(rig);
  resetPose(rig, pose); applyAnimation(rig, pose, rig.animations[0], 0, 0.5);
  ok(near(pose.p[n].scaleX as number, 1.1, 1e-6), `blend unkeyed scaleX from default 1 → ${pose.p[n].scaleX}`);
}

// ── 6. discrete (hold-only) properties snap during blends instead of averaging (regression: Solo id averaged) ──
{
  const b = new RigBuilder(10, 10); const n = b.node(0, { activeComponentId: 3 });
  b.animation('h', 60, 60, { [n]: { activeComponentId: [[0, 7, 'hold']] } });
  const rig = compileRig(b.build()), pose = createPose(rig);
  resetPose(rig, pose); applyAnimation(rig, pose, rig.animations[0], 0, 0.3);
  const a = pose.p[n].activeComponentId;
  resetPose(rig, pose); applyAnimation(rig, pose, rig.animations[0], 0, 0.7);
  ok(a === 3 && pose.p[n].activeComponentId === 7, `discrete snap: mix 0.3 → ${a}, mix 0.7 → ${pose.p[n].activeComponentId}`);
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
if (failed) process.exit(1);
