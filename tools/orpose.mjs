// Generate a mascot pose through OpenRouter, conditioned on the same reference images Masko uses.
//   node tools/orpose.mjs "celebrating, both paws raised" [model]
// Reproduces Masko's "identity": there is no stored model — it is just sending the references every call.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) { console.error('OPENROUTER_API_KEY is not set'); process.exit(1); }

const POSE = process.argv[2] || 'celebrating, both paws raised above the head, mouth open in a cheer';
const MODEL = process.argv[3] || 'google/gemini-3-pro-image';
const SP = '/private/tmp/claude-501/-Users-ariga-Documents/61691007-1362-4343-a7b7-94ea428fda32/scratchpad/masko';
const REFS = [`${SP}/pose_3.png`, `${SP}/pose_2.png`];     // standing, flying

const dataUri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

// The character brief we gave Masko, verbatim, so the comparison is like for like.
const CHARACTER =
  'Flat 2D vector cartoon mascot for the Twist app. Lavender-purple bat-pup with large pointed ears, ' +
  'big dark eyes with white highlights, two white fangs, pink tongue, pink cheek blush. Wears a red ' +
  'superhero cape with a gold medallion at the collar. Thick dark purple outlines, flat fills, no ' +
  'gradients or texture.';

const prompt =
  `${CHARACTER}\n\n` +
  `The two reference images show the same character: standing with both paws at the chest, and flying ` +
  `with one fist raised and the cape flared.\n\n` +
  `Draw this exact character in a NEW pose: ${POSE}.\n\n` +
  `Keep the design identical to the references — same proportions, same colours, same face, same cape ` +
  `and medallion. Do not restyle it. Full body, front-facing, centred, on ${process.env.OR_BG || 'a plain white background'}. ` +
  `No text, no logo, no shadow on a floor, no scenery.`;

const body = {
  model: MODEL,
  modalities: ['image', 'text'],
  messages: [{
    role: 'user',
    content: [
      ...REFS.map(f => ({ type: 'image_url', image_url: { url: dataUri(f) } })),
      { type: 'text', text: prompt },
    ],
  }],
};

const t0 = Date.now();
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const json = await res.json();
if (!res.ok) { console.error('HTTP', res.status, JSON.stringify(json).slice(0, 600)); process.exit(1); }

const msg = json.choices?.[0]?.message ?? {};
const images = msg.images ?? [];
if (!images.length) {
  console.error('no image returned. text was:', String(msg.content).slice(0, 400));
  console.error('finish_reason:', json.choices?.[0]?.finish_reason);
  process.exit(1);
}

const outDir = path.join(ROOT, 'out/openrouter');
fs.mkdirSync(outDir, { recursive: true });
const slug = POSE.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40).replace(/_$/, '');
const files = [];
images.forEach((im, i) => {
  const url = im.image_url?.url || im.url || '';
  const b64 = url.split(',')[1];
  if (!b64) return;
  const f = path.join(outDir, `${slug}${images.length > 1 ? '_' + i : ''}.png`);
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  files.push(f);
});

const u = json.usage ?? {};
console.log(`model        ${MODEL}`);
console.log(`time         ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`tokens       prompt ${u.prompt_tokens ?? '?'}, completion ${u.completion_tokens ?? '?'}`);
if (u.cost != null) console.log(`cost         $${Number(u.cost).toFixed(4)}  (OpenRouter's own accounting)`);
files.forEach(f => console.log(`wrote        ${f}  ${(fs.statSync(f).size / 1024).toFixed(0)} KB`));
