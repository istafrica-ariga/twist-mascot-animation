// node riv/analyze.mjs <file.riv> > report.txt
// Rebuilds the artboard hierarchy (parentId = index into the artboard's component list), skin bindings,
// solos, animations (what they key) and state machines from a decoded .riv.
import fs from 'node:fs';
import { loadSchema, decode } from './decode.mjs';

const schema = loadSchema();
const { objects } = decode(fs.readFileSync(process.argv[2]), schema);
const isA = (type, base) => { for (let t = type; t; t = schema.classes[t]?.parent) if (t === base) return true; return false; };
const f = v => typeof v === 'number' ? +v.toFixed(2) : v;
const out = [];

const artboards = [];
let ab = null, anim = null, sm = null, layer = null;
for (const o of objects) {
  if (o.type === 'Artboard') { ab = { o, comps: [o], anims: [], sms: [] }; artboards.push(ab); continue; }
  if (!ab) continue;
  if (o.type === 'LinearAnimation') { anim = { o, keyed: [] }; ab.anims.push(anim); continue; }
  if (o.type === 'StateMachine') { sm = { o, inputs: [], layers: [], listeners: [] }; ab.sms.push(sm); anim = null; continue; }
  if (anim && o.type === 'KeyedObject') { anim.keyed.push({ objectId: o.p.objectId, props: [] }); continue; }
  if (anim && o.type === 'KeyedProperty') { anim.keyed.at(-1)?.props.push({ key: o.p.propertyKey, frames: 0 }); continue; }
  if (anim && o.type.startsWith('KeyFrame')) { const kp = anim.keyed.at(-1)?.props.at(-1); if (kp) kp.frames++; continue; }
  if (sm) {
    if (o.type.startsWith('StateMachine') && o.type !== 'StateMachineLayer' && !o.type.startsWith('StateMachineListener')) { sm.inputs.push(o); continue; }
    if (o.type === 'StateMachineLayer') { layer = { o, states: [] }; sm.layers.push(layer); continue; }
    if (/State$/.test(o.type)) { layer?.states.push({ o, transitions: [] }); continue; }
    if (o.type === 'StateTransition') { layer?.states.at(-1)?.transitions.push({ o, conds: [] }); continue; }
    if (/Condition|Comparator/.test(o.type)) { layer?.states.at(-1)?.transitions.at(-1)?.conds.push(o); continue; }
    if (o.type.startsWith('StateMachineListener') || o.type.startsWith('Listener')) { sm.listeners.push(o); continue; }
  }
  if (isA(o.type, 'Component')) ab.comps.push(o);
}

for (const a of artboards) {
  const { comps } = a;
  const name = c => c ? `${c.p.name ?? ''}`.trim() || `<${c.type}>` : '?';
  const kids = new Map();
  comps.forEach((c, i) => { if (i === 0) return; const p = c.p.parentId ?? 0; (kids.get(p) || kids.set(p, []).get(p)).push(i); });
  out.push(`\n=== ARTBOARD "${a.o.p.name}" ${f(a.o.p.width)}×${f(a.o.p.height)}  (${comps.length} components)`);
  const SKIP = new Set(['CubicDetachedVertex', 'StraightVertex', 'CubicMirroredVertex', 'CubicAsymmetricVertex', 'CubicWeight', 'Weight', 'GradientStop']);
  const describe = (c, i) => {
    const bits = [`#${i}`, c.type, JSON.stringify(name(c))];
    const p = c.p;
    if ('x' in p || 'y' in p) bits.push(`@(${f(p.x ?? 0)},${f(p.y ?? 0)})`);
    if (p.rotation) bits.push(`rot ${f(p.rotation * 180 / Math.PI)}°`);
    if (p.length) bits.push(`len ${f(p.length)}`);
    if (p.scaleX != null && p.scaleX !== 1 || p.scaleY != null && p.scaleY !== 1) bits.push(`scale ${f(p.scaleX ?? 1)},${f(p.scaleY ?? 1)}`);
    if (p.opacity != null && p.opacity !== 1) bits.push(`opacity ${f(p.opacity)}`);
    if (p.colorValue != null) bits.push('#' + (p.colorValue >>> 0).toString(16).padStart(8, '0'));
    if (p.thickness) bits.push(`thick ${f(p.thickness)}`);
    if (c.type === 'Solo') bits.push(`active=#${p.activeComponentId} ${JSON.stringify(name(comps[p.activeComponentId]))}`);
    if (c.type === 'Tendon') bits.push(`→ bone #${p.boneId} ${JSON.stringify(name(comps[p.boneId]))}`);
    if (c.type === 'ClippingShape') bits.push(`source #${p.sourceId} ${JSON.stringify(name(comps[p.sourceId]))}`);
    if (c.type === 'PointsPath') {
      const vs = (kids.get(i) || []).map(j => comps[j]);
      const weighted = vs.filter(v => (kids.get(comps.indexOf(v)) || []).some(k => /Weight/.test(comps[k].type))).length;
      bits.push(`${vs.length} vertices${weighted ? `, ${weighted} weighted` : ''}${p.isClosed ? ', closed' : ''}`);
    }
    return bits.join('  ');
  };
  const tree = (i, d) => {
    for (const j of kids.get(i) || []) {
      const c = comps[j];
      if (SKIP.has(c.type)) continue;
      out.push('  '.repeat(d) + describe(c, j));
      tree(j, d + 1);
    }
  };
  tree(0, 1);

  out.push(`\n--- ${a.anims.length} animations`);
  for (const an of a.anims) {
    const p = an.o.p, fps = p.fps ?? 60, dur = p.duration ?? 60;
    const targets = an.keyed.map(k => `${name(comps[k.objectId])}[${k.props.map(pp => `${schema.props[pp.key]?.name ?? pp.key}×${pp.frames}`).join(',')}]`);
    out.push(`  "${p.name}"  ${dur}f @${fps}fps = ${f(dur / fps)}s  loop=${['oneShot', 'loop', 'pingPong'][p.loopValue ?? 0]}  keys ${an.keyed.length} objects`);
    out.push('     ' + targets.slice(0, 40).join('  ') + (targets.length > 40 ? `  …+${targets.length - 40}` : ''));
  }
  out.push(`\n--- ${a.sms.length} state machines`);
  for (const s of a.sms) {
    out.push(`  SM "${s.o.p.name}"  inputs: ${s.inputs.map(i => `${i.type.replace('StateMachine', '')} "${i.p.name}"`).join(', ') || '—'}  listeners: ${s.listeners.length}`);
    for (const l of s.layers) {
      out.push(`    layer "${l.o.p.name ?? ''}"`);
      l.states.forEach((st, si) => {
        const label = st.o.type === 'AnimationState' ? `"${a.anims[st.o.p.animationId]?.o.p.name}"` : st.o.type;
        out.push(`      [${si}] ${label}` + st.transitions.map(t => `\n          → [${t.o.p.stateToId}] ${t.o.p.duration ? `blend ${t.o.p.duration}ms ` : ''}${t.conds.map(c => c.type.replace('Transition', '') + (c.p.inputId != null ? `(${s.inputs[c.p.inputId]?.p.name})` : '') + (c.p.value != null ? `=${c.p.value}` : '')).join(' ')}`).join(''));
      });
    }
  }
}
console.log(out.join('\n'));
