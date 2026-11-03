// Encoder for Rive runtime files — the inverse of decode.mjs, same schema (rive-runtime generated headers).
// encode({ header, objects }, schema) → Buffer.  `objects` = [{ type, p: { propName: value, … } }] in file order.
import fs from 'node:fs';
import { loadSchema, decode } from './decode.mjs';

export function encode({ header, objects }, schema) {
  const keyOf = {}; // class → prop name → key (walk the inheritance chain)
  const propKey = (type, name) => {
    if (name.startsWith('?')) return +name.slice(1);
    for (let t = type; t; t = schema.classes[t]?.parent) { const k = schema.classes[t]?.props[name]; if (k != null) return k; }
    throw new Error(`${type} has no property ${name}`);
  };
  const typeKey = Object.fromEntries(Object.entries(schema.types).map(([k, v]) => [v, +k]));
  const out = [];
  const varuint = n => { let v = BigInt(n); do { let b = Number(v & 0x7fn); v >>= 7n; if (v) b |= 0x80; out.push(b); } while (v); };
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); out.push(...b); };
  const f32 = n => { const b = Buffer.alloc(4); b.writeFloatLE(n); out.push(...b); };
  const write = (t, v) => {
    switch (t) {
      case 'uint': case 'id': return varuint(v);
      case 'int': return varuint(((v << 1) ^ (v >> 31)) >>> 0);
      case 'double': return f32(v);
      case 'color': return u32(v);
      case 'bool': return out.push(v ? 1 : 0);
      case 'string': { const b = Buffer.from(v, 'utf8'); varuint(b.length); return out.push(...b); }
      case 'bytes': { varuint(v.length); for (const x of v) out.push(x); return; }
    }
  };
  // property table of contents: every key used, with its 2-bit field id
  const used = new Map();
  const fid = t => ({ uint: 0, id: 0, int: 0, bool: 0, string: 1, bytes: 1, double: 2, color: 3 })[t];
  const resolved = objects.map(o => ({ tk: typeKey[o.type] ?? +o.type.slice(1), props: Object.entries(o.p).map(([n, v]) => {
    const k = propKey(o.type, n), t = schema.props[k]?.type ?? header.toc?.[k];
    used.set(k, fid(t)); return [k, t, v];
  }) }));
  out.push(...Buffer.from('RIVE')); varuint(header.major); varuint(header.minor); varuint(header.fileId ?? 0);
  const keys = [...used.keys()];
  for (const k of keys) varuint(k); varuint(0);
  for (let i = 0; i < keys.length; i += 4) { let w = 0; for (let j = 0; j < 4 && i + j < keys.length; j++) w |= used.get(keys[i + j]) << (j * 2); u32(w); }
  for (const o of resolved) { varuint(o.tk); for (const [k, t, v] of o.props) { varuint(k); write(t, v); } varuint(0); }
  return Buffer.from(out);
}

if (import.meta.url === `file://${process.argv[1]}`) { // round-trip test: decode → encode → decode, compare objects
  const schema = loadSchema();
  const src = fs.readFileSync(process.argv[2]);
  const a = decode(src, schema);
  const buf = encode(a, schema);
  const b = decode(buf, schema);
  const same = JSON.stringify(a.objects.map(o => [o.type, o.p])) === JSON.stringify(b.objects.map(o => [o.type, o.p]));
  console.log(`objects identical after round trip: ${same} · ${src.length} → ${buf.length} bytes · byte-identical: ${Buffer.compare(src, buf) === 0}`);
  if (process.argv[3]) fs.writeFileSync(process.argv[3], buf);
}
