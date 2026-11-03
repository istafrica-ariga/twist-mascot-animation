// Adapter: decoded .riv → engine model. Used to validate our engine against the official Rive runtime on a real
// production rig (the user's study_screen_animation.riv). The engine itself never touches the .riv format.
import fs from 'node:fs';
import { loadSchema, decode } from '../riv/decode.mjs';

export function modelFromRiv(file, artboardIndex = 0) {
  const schema = loadSchema();
  const { objects } = decode(fs.readFileSync(file), schema);
  const isA = (t, base) => { for (; t; t = schema.classes[t]?.parent) if (t === base) return true; return false; };
  const starts = objects.map((o, i) => o.type === 'Artboard' ? i : -1).filter(i => i >= 0);
  const a0 = starts[artboardIndex], a1 = starts[artboardIndex + 1] ?? objects.length;
  const range = objects.slice(a0, a1);
  const firstAnim = range.findIndex(o => o.type === 'LinearAnimation' || o.type === 'StateMachine');
  // artboard object index = position in the artboard's object list (data-binding contexts aren't in it)
  const list = range.slice(0, firstAnim < 0 ? range.length : firstAnim).filter(o => o.type !== 'DataBindContext');
  const components = list.map((o, i) => ({
    type: o.type, parent: i === 0 ? null : (o.p.parentId ?? 0), p: { ...o.p },
    is: { transform: isA(o.type, 'TransformComponent'), path: isA(o.type, 'Path'), vertex: isA(o.type, 'PathVertex'), drawable: isA(o.type, 'Drawable') },
  }));
  const interpolators = {};
  list.forEach((o, i) => { if (/Interpolator$/.test(o.type)) interpolators[i] = { type: o.type, p: o.p }; });

  const animations = [];
  let anim = null, kp = null;
  for (const o of range.slice(firstAnim < 0 ? range.length : firstAnim)) {
    if (o.type === 'LinearAnimation') { anim = { name: o.p.name, fps: o.p.fps ?? 60, duration: o.p.duration ?? 60, loop: o.p.loopValue ?? 0, keyed: [] }; animations.push(anim); continue; }
    if (o.type === 'StateMachine') { anim = null; continue; }
    if (!anim) continue;
    if (o.type === 'KeyedObject') { anim.keyed.push({ objectId: o.p.objectId ?? 0, props: [] }); continue; }
    if (o.type === 'KeyedProperty') {
      kp = { key: o.p.propertyKey, name: schema.props[o.p.propertyKey]?.name, frames: [], valueKey: 'value' };
      anim.keyed.at(-1).props.push(kp); continue;
    }
    if (o.type.startsWith('KeyFrame') && kp) {
      const hold = /KeyFrame(Id|Uint|Bool|String)/.test(o.type);
      if (o.type === 'KeyFrameColor') kp.color = true; // colour keyframes store their colour in `value`
      kp.frames.push({ frame: o.p.frame ?? 0, interpolationType: hold ? 0 : (o.p.interpolationType ?? 0), interpolatorId: o.p.interpolatorId,
        value: o.p.value ?? 0 });
    }
  }
  const ab = list[0].p;
  return { width: ab.width, height: ab.height, components, animations, interpolators };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = modelFromRiv(process.argv[2]);
  fs.writeFileSync(process.argv[3], JSON.stringify(m));
  console.log(`${m.components.length} components, ${m.animations.length} animations → ${process.argv[3]}`);
}
