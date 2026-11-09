// Generate the lesson mascot in a new costume, conditioned on its own rendered poses.
//
//   node lesson/costume.mjs "<costume description>" [pose] [slug]
//
// The references are frames rendered straight out of the Rive file, so the model is being shown
// the exact character the app ships rather than a description of it. That is the same trick the
// splash pipeline used, and it is why identity holds.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) { console.error('OPENROUTER_API_KEY is not set'); process.exit(1); }

const COSTUME = process.argv[2] || 'a red knitted scarf and a pencil behind one ear';
const POSE = process.argv[3] || 'standing upright, both paws relaxed at its sides, friendly closed smile';
const SLUG = process.argv[4] || 'costume';
const MODEL = 'google/gemini-3-pro-image';

const REFS = [`${ROOT}/lesson/poses/idle_big.png`, `${ROOT}/lesson/poses/celeb_big.png`];
const dataUri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

const CHARACTER =
  'Flat 2D vector cartoon mascot: a round purple bat-pup with large pointed ears, big dark ' +
  'almond eyes with white highlights, a small dark rounded snout, two small white fangs, a pink ' +
  'heart-shaped tongue, a lighter lavender belly patch and short chunky limbs with small claw ' +
  'marks. Thick dark purple outlines, flat fills, soft lighter highlights, no gradients, no texture.';

const prompt =
  `${CHARACTER}\n\n` +
  `The two reference images show this exact character wearing a black graduation cap.\n\n` +
  `Draw the SAME character, but **remove the graduation cap completely** — no cap, no tassel, ` +
  `nothing on its head. Instead give it: ${COSTUME}.\n\n` +
  `Pose: ${POSE}.\n\n` +
  `Keep everything else identical to the references — same proportions, same purple, same face, ` +
  `same ears, same belly patch, same outline weight. Do not restyle it, do not age it up, do not ` +
  `change the head shape now that the cap is gone. Full body, front-facing, centred, on a plain ` +
  `white background. No text, no logo, no floor shadow, no scenery.`;

const body = {
  model: MODEL,
  modalities: ['image', 'text'],
  messages: [{
    role: 'user',
    content: [...REFS.map(f => ({ type: 'image_url', image_url: { url: dataUri(f) } })),
      { type: 'text', text: prompt }],
  }],
};

const t0 = Date.now();
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const json = await res.json();
if (!res.ok) { console.error('HTTP', res.status, JSON.stringify(json).slice(0, 500)); process.exit(1); }

const images = json.choices?.[0]?.message?.images ?? [];
if (!images.length) {
  console.error('no image. text:', String(json.choices?.[0]?.message?.content).slice(0, 300));
  process.exit(1);
}

const outDir = `${ROOT}/lesson/costume`;
fs.mkdirSync(outDir, { recursive: true });
const f = `${outDir}/${SLUG}.png`;
fs.writeFileSync(f, Buffer.from((images[0].image_url?.url || '').split(',')[1], 'base64'));

const u = json.usage ?? {};
console.log(`${SLUG.padEnd(16)} ${((Date.now() - t0) / 1000).toFixed(1)}s  ` +
  `${u.cost != null ? '$' + Number(u.cost).toFixed(4) : '?'}  ${(fs.statSync(f).size / 1024).toFixed(0)} KB`);
