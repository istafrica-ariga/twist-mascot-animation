// State machines — Rive's concept (layers · states · inputs · transitions with blend time · any-state), our format.
import type { Rig, Pose } from './types';
import { applyAnimation } from './core';

export type InputType = 'bool' | 'number' | 'trigger';
export interface SMInput { name: string; type: InputType; value?: number | boolean }
export interface SMCondition { input: string; op?: '==' | '!=' | '>' | '<' | '>=' | '<='; value?: number | boolean } // trigger: { input }
export interface SMState { name: string; animation: string | null; speed?: number; loop?: boolean }
export interface SMTransition { from: string | '*'; to: string; duration?: number; exitTime?: number; conditions?: SMCondition[] }
export interface SMLayer { name: string; entry: string; states: SMState[]; transitions: SMTransition[] }
export interface StateMachine { name: string; inputs: SMInput[]; layers: SMLayer[] }

interface LayerRun { state: number; time: number; from: number; fromTime: number; mix: number; mixDur: number }
export interface SMInstance { values: Record<string, number | boolean>; fired: Record<string, boolean>; layers: LayerRun[]; events: string[] }

export function createSM(sm: StateMachine): SMInstance {
  'worklet';
  const values: Record<string, number | boolean> = {};
  for (const i of sm.inputs) values[i.name] = i.value ?? (i.type === 'number' ? 0 : false);
  return { values, fired: {}, events: [], layers: sm.layers.map(l => ({ state: Math.max(0, l.states.findIndex(s => s.name === l.entry)), time: 0, from: -1, fromTime: 0, mix: 1, mixDur: 0 })) };
}
/** Set a bool / number input, or fire a trigger (value omitted). */
export function setInput(inst: SMInstance, name: string, value?: number | boolean) {
  'worklet';
  if (value === undefined) inst.fired[name] = true; else inst.values[name] = value;
}

function animOf(rig: Rig, name: string | null) {
  'worklet';
  if (name == null) return null;
  for (const a of rig.animations) if (a.name === name) return a;
  return null;
}
function localTime(rig: Rig, st: { animation: string | null; loop?: boolean }, t: number) {
  'worklet';
  const a = animOf(rig, st.animation); if (!a) return t;
  const D = a.duration / a.fps, loop = st.loop ?? a.loop === 1;
  if (a.loop === 2 && st.loop === undefined) { const k = Math.floor(t / D); const r = t - k * D; return k % 2 ? D - r : r; }
  return loop ? t % D : Math.min(t, D);
}
function holds(inst: SMInstance, c: SMCondition) {
  'worklet';
  if (inst.fired[c.input]) return true;
  const v = inst.values[c.input];
  if (c.value === undefined) return v === true;
  const a = typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? 0), b = typeof c.value === 'boolean' ? (c.value ? 1 : 0) : c.value;
  switch (c.op ?? '==') { case '!=': return a !== b; case '>': return a > b; case '<': return a < b; case '>=': return a >= b; case '<=': return a <= b; default: return a === b; }
}

/** Advance by dt seconds and pose the rig (call resetPose first, solve after). */
export function advanceSM(rig: Rig, pose: Pose, sm: StateMachine, inst: SMInstance, dt: number) {
  'worklet';
  sm.layers.forEach((layer, li) => {
    const run = inst.layers[li];
    const cur = layer.states[run.state];
    run.time += dt * (cur.speed ?? 1);
    if (run.from >= 0) { run.fromTime += dt * (layer.states[run.from].speed ?? 1); run.mix = run.mixDur > 0 ? Math.min(1, run.mix + dt / run.mixDur) : 1; if (run.mix >= 1) run.from = -1; }
    // transitions: first whose conditions hold (and exit time reached)
    for (const tr of layer.transitions) {
      if (tr.from !== '*' && tr.from !== cur.name) continue;
      if (tr.from === '*' && tr.to === cur.name) continue;
      if (tr.exitTime != null) { const a = animOf(rig, cur.animation); if (a && run.time < tr.exitTime * a.duration / a.fps) continue; }
      if (!(tr.conditions || []).every(c => holds(inst, c))) continue;
      const to = layer.states.findIndex(s => s.name === tr.to); if (to < 0) continue;
      for (const c of tr.conditions || []) if (inst.fired[c.input]) inst.fired[c.input] = false; // consume triggers
      run.from = run.state; run.fromTime = run.time; run.state = to; run.time = 0;
      run.mixDur = tr.duration ?? 0; run.mix = run.mixDur > 0 ? 0 : 1; if (run.mix >= 1) run.from = -1;
      inst.events.push(`${layer.name}:${tr.to}`);
      break;
    }
    if (run.from >= 0) { const f = layer.states[run.from], fa = animOf(rig, f.animation); if (fa) applyAnimation(rig, pose, fa, localTime(rig, f, run.fromTime), 1); }
    const s = layer.states[run.state], a = animOf(rig, s.animation);
    if (a) applyAnimation(rig, pose, a, localTime(rig, s, run.time), run.from >= 0 ? run.mix : 1);
  });
  for (const k in inst.fired) inst.fired[k] = false;
}
