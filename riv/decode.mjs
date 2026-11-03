// node riv/decode.mjs <file.riv> [--json out.json]
// Decodes a Rive runtime file into its object list, using the type/property schema extracted from
// rive-runtime's generated headers (include/rive/generated/**/*_base.hpp + core_registry.hpp).
//
// Wire format (rive-runtime src/file.cpp + runtime_header.hpp):
//   "RIVE" · varuint major · varuint minor · varuint fileId
//   property ToC: varuint keys until 0, then 2-bit field ids packed 4 per uint32 (0 uint, 1 string, 2 double, 3 color)
//   objects: varuint typeKey, then (varuint propertyKey, value)* until propertyKey 0
//   values: uint/id = varuint · int = zigzag varuint · double = float32 LE · color = uint32 LE
//           bool = 1 byte · string/bytes = varuint length + bytes
import fs from 'node:fs';
import path from 'node:path';

// Vendored in ext/ so this doesn't depend on a checkout outside the project; RIVE_GEN still overrides.
const GEN = process.env.RIVE_GEN || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../ext/rive-runtime/include/rive/generated');

export function loadSchema(gen = GEN) {
  const types = {}, props = {}, classes = {};
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('_base.hpp') ? [path.join(d, e.name)] : []);
  for (const f of walk(gen)) {
    const src = fs.readFileSync(f, 'utf8');
    const cls = src.match(/class (\w+)Base\s*:\s*public\s+(\w+)/);
    if (!cls) continue;
    const name = cls[1], parent = cls[2];
    const tk = src.match(/static const uint16_t typeKey = (\d+);/);
    classes[name] = { parent, typeKey: tk ? +tk[1] : null, props: {} };
    if (tk) types[+tk[1]] = name;
    for (const m of src.matchAll(/static const uint16_t (\w+)PropertyKey = (\d+);/g)) {
      classes[name].props[m[1]] = +m[2];
      props[+m[2]] = { name: m[1], cls: name, type: null };
    }
  }
  // field types from CoreRegistry::propertyFieldId
  const reg = fs.readFileSync(path.join(gen, 'core_registry.hpp'), 'utf8');
  const body = reg.slice(reg.indexOf('static int propertyFieldId(int propertyKey)'));
  let pending = [];
  for (const line of body.split('\n')) {
    const c = line.match(/case (\w+)Base::(\w+)PropertyKey:/);
    if (c) { pending.push([c[1], c[2]]); continue; }
    const r = line.match(/return Core(\w+)Type::id;/);
    if (r) {
      for (const [cl, pn] of pending) { const k = classes[cl]?.props[pn]; if (k != null) props[k].type = r[1].toLowerCase(); }
      pending = [];
      if (Object.values(props).every(p => p.type)) break;
    }
    if (/^\s*default:/.test(line) || /^\s*}\s*$/.test(line) && pending.length === 0 && body.indexOf(line) > 2000) {}
  }
  return { types, props, classes };
}

export function decode(buf, schema) {
  let pos = 0;
  const u8 = () => buf[pos++];
  const varuint = () => { let r = 0n, s = 0n, b; do { b = buf[pos++]; r |= BigInt(b & 0x7f) << s; s += 7n; } while (b & 0x80); return Number(r); };
  const u32 = () => { const v = buf.readUInt32LE(pos); pos += 4; return v; };
  const f32 = () => { const v = buf.readFloatLE(pos); pos += 4; return v; };
  const bytes = () => { const n = varuint(); const b = buf.subarray(pos, pos + n); pos += n; return b; };
  if (buf.toString('latin1', 0, 4) !== 'RIVE') throw new Error('not a .riv');
  pos = 4;
  const header = { major: varuint(), minor: varuint(), fileId: varuint() };
  const tocKeys = []; for (let k = varuint(); k !== 0; k = varuint()) tocKeys.push(k);
  const toc = {}; let cur = 0, bit = 8;
  for (const k of tocKeys) { if (bit === 8) { cur = u32(); bit = 0; } toc[k] = ['uint', 'string', 'double', 'color'][(cur >> bit) & 3]; bit += 2; }
  const read = t => {
    switch (t) {
      case 'uint': case 'id': return varuint();
      case 'int': { const v = varuint(); return (v >>> 1) ^ -(v & 1); }
      case 'double': return f32();
      case 'color': return u32();
      case 'bool': return u8() === 1;
      case 'string': return bytes().toString('utf8');
      case 'bytes': return bytes();
      default: throw new Error('unknown field type ' + t);
    }
  };
  const objects = [];
  while (pos < buf.length) {
    const typeKey = varuint();
    const o = { i: objects.length, typeKey, type: schema.types[typeKey] || `?${typeKey}`, p: {} };
    for (let k = varuint(); k !== 0; k = varuint()) {
      const def = schema.props[k];
      const t = def?.type || toc[k];
      if (!t) throw new Error(`no field type for property ${k} at byte ${pos} (object ${o.type})`);
      o.p[def ? def.name : `?${k}`] = read(t);
    }
    objects.push(o);
  }
  return { header, toc, objects };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const schema = loadSchema();
  const { header, objects } = decode(fs.readFileSync(file), schema);
  const counts = {};
  for (const o of objects) counts[o.type] = (counts[o.type] || 0) + 1;
  console.log(`Rive ${header.major}.${header.minor}, ${objects.length} objects`);
  console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${String(n).padStart(6)}  ${t}`).join('\n'));
  const j = process.argv.indexOf('--json');
  if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(objects, (k, v) => v?.type === 'Buffer' || v instanceof Uint8Array ? `<${v.length ?? v.data?.length} bytes>` : v, 1));
}
