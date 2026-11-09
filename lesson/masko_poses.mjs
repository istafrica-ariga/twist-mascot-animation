// Generate the lesson pose set from the approved costume reference.
//
//   node lesson/masko_poses.mjs [pose ...]        (default: all five)
//
// This is the Masko model built on our own pipeline: poses are the nodes, and clips generated
// between them are the edges. Everything downstream depends on these five being consistent — if
// the character changes size or shifts in frame between two poses, the clip between them will
// jump, and no amount of prompting on the clip fixes it.
//
// So every pose is conditioned on the SAME approved reference, with the framing pinned in words,
// and rendered on flat chroma green for keying later.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) { console.error('OPENROUTER_API_KEY is not set'); process.exit(1); }

// Three references, not one. `approved.png` sets the look; the other two were supplied after the
// fifth pass and are the AUTHORITY on the two things that kept going wrong — the mouth in both of
// its states, and how small the stick actually is.
const REFS = [
  `${ROOT}/lesson/ref/approved.png`,     // 1 - the character
  `${ROOT}/lesson/ref/mouth_open.png`,   // 2 - the mouth OPEN
  `${ROOT}/lesson/ref/mouth_closed.png`, // 3 - the mouth CLOSED, and the resting stick
  `${ROOT}/lesson/ref/pointing_up.png`,  // 4 - POINTING, and the mouth open
];
const OUT = `${ROOT}/lesson/masko/poses`;
const MODEL = 'google/gemini-3-pro-image';

const CHARACTER =
  'A round purple bat-pup study mascot: large pointed ears, big dark almond eyes with white ' +
  'highlights behind round thin gold-rimmed glasses, a small dark rounded snout, ' +
  'a pink heart-shaped tongue, a short red ribbed knitted scarf with fringed ends, and a ' +
  'slim wooden pointer stick held in one paw. Flat 2D vector cartoon, thick dark purple outlines, ' +
  'flat fills, soft lighter highlights, no gradients, no texture.';

// The teeth were wrong in four of the first five poses, and the cause was one word in the line
// above: it used to say "two small white fangs", and the generator drew vampire fangs. The
// reference has nothing of the kind, so the shape is now spelled out and the wrong reading is
// named and forbidden. Worth its own constant because it has to survive every future edit.
// Measured off ref/mouth_open.png and ref/mouth_closed.png. Two things here were wrong before.
// The teeth kept vanishing when the mouth opened, because the rule only ever described the closed
// mouth. And the prompt said the inside of the mouth was "a warm dark red" — it is not. Sampled
// from the reference it is DARK PURPLE, about #32085A, with a pink #F06E8C tongue. Saying red
// pushed every open mouth away from the character.
const MOUTH =
  'THE MOUTH. The second reference image shows it OPEN and the third shows it CLOSED. Those two ' +
  'are the only correct states and both must match them exactly. ' +
  'THE TEETH ARE THE SAME IN BOTH. There are EXACTLY TWO of them and never any other number. ' +
  'Each is a small, pure WHITE, BLUNT tile shaped like a little rounded rectangle, as wide as it is ' +
  'tall, hanging straight DOWN from the UPPER LIP — one to the left of centre and one to the right. ' +
  'THE TWO TEETH ARE ALWAYS SEPARATE, WITH A CLEAR GAP BETWEEN THEM, and that gap always shows the ' +
  'dark interior behind. They are NOT fangs, NOT pointed, NOT triangular. They never sit on the lower ' +
  'jaw and never float. ' +
  'THEY NEVER MERGE INTO A ROW. There is never a continuous band, strip, wall, arc or row of white ' +
  'across the mouth. There is never a full toothy grin. There are never upper AND lower rows. There ' +
  'are never more than two teeth and there is never a single wide white shape. If the white in the ' +
  'mouth is not two small separate tiles with dark between and around them, it is WRONG. ' +
  'And the mouth is never drawn without them: an open mouth with no teeth at all is WRONG too. ' +
  'CLOSED: the mouth is a single simple dark curved smile line drawn straight on the face, and ' +
  'the two blunt teeth hang down just below that line. There is no cavity and no opening. ' +
  'OPEN: the mouth is a wide rounded cavity filled with DARK PURPLE (about #32085A) \u2014 it is ' +
  'NOT red, NOT dark red, NOT brown, NOT black. A single PINK HEART-SHAPED TONGUE (about ' +
  '#F06E8C) sits in the bottom of the cavity. The same two white blunt teeth hang DOWN from the ' +
  'top edge of the cavity, in the same places and at the same size as when it is closed \u2014 the ' +
  'mouth opens BELOW them. ' +
  'The mouth must read as the SAME mouth in both states.';

// Each eye in the reference is ONE solid dark shape with ONE white dot. It has no white of the
// eye at all, which means it cannot show gaze direction the way a normal cartoon eye does — and
// that is what kept breaking `sheepish`. Asked for eyes that 'look UP and OUT from under the
// brows', the generator did the only thing that reads as looking up: it put a white sclera in and
// floated the pupil at the top of it. Big shiny anime eyes, off-model in one stroke.
//
// So the eye is pinned here, and looking somewhere became the HEAD's job in every pose.
const EYES =
  'THE EYES. Each eye is ONE single SOLID DARK PURPLE almond shape, wider than it is tall, with '
  + 'exactly ONE small round WHITE HIGHLIGHT DOT near its upper inner corner. That is the whole '
  + 'eye. '
  + 'There is NO white of the eye, NO sclera, NO white area around the dark shape, NO visible '
  + 'iris, NO ring, NO second highlight, NO eyelashes and NO eyebrows drawn above them. The eye '
  + 'NEVER becomes a big round glossy cartoon eye and a white crescent NEVER appears under or '
  + 'beside the dark shape. '
  + 'Both eyes stay the SAME size and shape as in the first reference image — they do not grow, '
  + 'widen, round off or become glossier in any pose. '
  + 'The pale diagonal streak across each lens belongs to the GLASSES, not to the eye, and sits '
  + 'on top of it.';

const FRAMING =
  'Full body, front-facing, standing on an invisible ground line, centred in a square frame, ' +
  'occupying the SAME proportion of the frame and the SAME position as the reference image — do ' +
  'not zoom in, do not crop, do not move the character up or down. Flat solid chroma-key green ' +
  'background (#09ae4f) filling the entire frame edge to edge, no gradient, no shadow, no ' +
  'vignette, no ground shadow. No text, no logo, no scenery.';

// The stick was measured off ref/mouth_closed.png and every pass so far has drawn it far too big.
// It is a SHORT little rod, not a staff:
//
//   length                25% of the character's height
//   angle                 about 30 degrees out from vertical, leaning down and away
//   the paw grips it      80% of the way down the body \u2014 low, at hip level
//   the tip reaches       101% \u2014 just touching the ground beside the foot
//
// Earlier passes forced it upward because a stick asked to "point down at its side" gets dropped:
// the generator draws it lying across the body with the paw nowhere near it. The missing piece
// was never the direction. It was the SIZE. A short rod gripped low needs no upward angle to read
// as held, which is what made every previous version look like a flagpole.
const GRIP =
  'THE POINTER STICK IS SMALL. Look at the third reference image. It is a SHORT, slim, plain ' +
  'wooden rod only about a QUARTER of the character\'s height \u2014 roughly as long as one of its ' +
  'arms. It is NOT a staff, NOT a cane, NOT a pole, NOT a wand, and it NEVER reaches above the ' +
  'shoulder or past the top of the head. ' +
  'It is GRIPPED in the paw at its TOP end, with the paw visibly closed around it. The paw hangs ' +
  'LOW, down at hip level beside the body. From there the rod leans DOWN and slightly OUTWARD, ' +
  'about thirty degrees off vertical, and its tip just reaches the ground beside the foot. ' +
  'It never lies across the body, never crosses the chest, never floats unheld, and is never ' +
  'raised, waved or carried like a flag.';

const ADDITIONS =
  'ADD NOTHING. The character has exactly the parts in the reference and no others. ' +
  'It has NO WINGS and no wing membranes. It has no cape, no cloak, no hood, no second scarf, no ' +
  'extra fabric, no tail and no shapes of any kind behind or attached to the arms, the back or ' +
  'the shoulders. ' +
  'The short red scarf is the ONLY loose, hanging or trailing part on the whole character — ' +
  'nothing else drapes, flows or trails. ' +
  'The body is ONE flat purple all over: no lighter belly patch, no chest marking, no tummy oval ' +
  'and no two-tone shading anywhere on the torso. ' +
  'Nothing new appears because the character is moving, jumping or celebrating. ' +
  'The INSIDE of each ear is the same purple as the rest of the character, a touch darker at most \u2014 ' +
  'it is never pink, never white, never cream and never a different colour from the body.';

const POSES = {
  idle: 'standing relaxed and still, mouth closed in a soft friendly smile, scarf hanging '
      + 'straight. The SHORT pointer stick is gripped at its top by the LOW paw at hip level, '
      + 'leaning down and slightly outward with its tip just reaching the ground beside the foot, '
      + 'exactly as in the third reference image',
  yes: 'a small happy bounce, free paw raised, the pointer stick lifted upward, mouth open in a '
     + 'wide delighted smile, scarf ends lifting with the movement',
  yes_big: 'a big joyful jump with both feet off the ground, free paw thrown up high, pointer '
         + 'stick raised, mouth wide open cheering, scarf ends flying outward. NO confetti, NO '
         + 'stars, NO sparkles — the character only, nothing floating around it',
  oops: 'a sympathetic wince — shoulders pulled in, eyes looking down, mouth a small closed '
      + 'frown, the pointer stick still gripped but tipped back over the shoulder, scarf ends '
      + 'hanging heavy and straight down. '
      + 'The ears KEEP their pointed triangular bat shape exactly as in the reference and simply '
      + 'tilt backward slightly — they must NOT become floppy, rounded or dog-like',
  go_on: 'encouraging — standing up straight again, warm reassuring smile, the pointer stick '
       + 'held forward and slightly up as if pointing at the question to say "try this bit", '
       + 'free paw open in a gentle gesture',
  // The two poses the lesson actually spends most of its time in. Both are held for an unknown
  // length — narration runs as long as the sentence does — so both are built as seamless loops,
  // and a loop can only be seamless if its first and last frame are this one drawing.
  narrate: 'speaking to the child — mouth OPEN in mid-speech showing the two blunt teeth and the '
         + 'heart tongue, looking straight out at the viewer, one paw raised in a small open '
         + 'explaining gesture, the pointer stick held upright in the other paw, scarf still',
  // The two moods the lesson actually waits in. Both are the END frame of a reaction and the
  // start-and-end frame of the loop that carries on from it, so the pose has to work as a HELD
  // position, not as a moment caught mid-gesture.
  // The paw height is doing the work. Rendered at the 45 px the lesson screen actually uses,
  // the first `pleased` and `sheepish` were indistinguishable — both had the free paw out to the
  // side at shoulder height, and at that size a raised paw IS the silhouette. So the three
  // anchors are separated deliberately: idle keeps its paw DOWN, pleased puts it HIGH, and
  // sheepish keeps it LOW and out with the ears swept back.
  pleased: 'still pleased after getting something right — up on the balls of its feet with the '
         + 'chest lifted and the shoulders open. '
         + 'THE FREE PAW IS RAISED HIGH, up beside the head at about ear height, open and happy, '
         + 'clearly well ABOVE the shoulder — not out to the side at shoulder height and not '
         + 'down by the body. At thumbnail size this raised paw is what says the pose, so it must '
         + 'be unmistakably high in the silhouette. '
         + 'The SHORT pointer stick stays gripped at its top in the other paw, which stays LOW at '
         + 'hip level \u2014 the stick itself is not raised, not lifted and not waved; only the free paw '
         + 'goes up. '
         + 'Ears UP and forward, mouth CLOSED in a big '
         + 'proud smile with the corners well up, eyes happy, scarf ends lifted a little as if '
         + 'still settling',
  // Seventh roll, and the lesson is to stop describing a MOOD and start describing a DIFFERENCE.
  //
  // Every attempt to say what sheepish FEELS like pulled something off-model. "Sad" sat it on the
  // floor with folded ears. "Eyes looking up from under the brows" put a white sclera in and gave
  // it big glossy anime eyes — the reference eye is a solid dark shape with no white in it and
  // literally cannot show a direction of gaze. Taking the gaze back out tipped the whole head down
  // to the floor and grew eyebrows instead.
  //
  // So it is now defined as the reference PLUS THREE CHANGES and nothing else. The mood is carried
  // by the ears, the paw, and in the clip by slow heavy motion. Not by the face.
  sheepish: 'EXACTLY the same as the first reference image — the same standing stance, the same '
          + 'height and proportions, the same LEVEL FRONT-FACING head, the same face, the same '
          + 'eyes, the same closed smile with the two blunt teeth, the same short stick gripped '
          + 'low — with THREE CHANGES and nothing else whatsoever: '
          + '(1) THE EARS are swept BACKWARD about thirty degrees from where the reference has '
          + 'them, so the outline of the head is visibly different. They ROTATE as one rigid piece '
          + 'and nothing else: same size, same length, same width, same pointed triangular shape. '
          + 'They must NOT grow, stretch, lengthen, droop, flop, fold, sag, curl or round off. '
          + '(2) THE FREE PAW is held out LOW and a little away from the body, the pad turned up '
          + 'in a small open patient gesture. It is never raised above the shoulder. '
          + '(3) THE SHOULDERS are drawn in very slightly. '
          + 'The HEAD STAYS LEVEL and front-facing exactly as in the reference: it is NOT tipped '
          + 'down, NOT bowed, NOT turned, and the top of the skull is NOT shown. The glasses sit '
          + 'in the same place on the face. NO eyebrows are drawn anywhere. '
          + 'Everything not listed above is the reference, unchanged',
  // Measured off ref/lesson_screen.png. The mascot sits top-left at 69 x 75 px and the narrated
  // text sits in the speech bubble immediately to its right, at the same height. From the paw the
  // whole text block spans a 34 degree cone and the highlighted words sit at +7 to +13 degrees, so
  // a stick held at about +10 degrees aims at them no matter what the sentence says. The direction
  // is fixed by the LAYOUT, not by the text, which is the only reason one angle can work.
  //
  // This is the ONE pose where the stick leaves its resting position. Everywhere else it hangs low
  // with the tip on the ground; here it is raised to point, because that is what the screen shows
  // the mascot doing while it reads.
  // Third roll. Pushed on "almost flat" the generator stopped drawing OUR character and reached
  // for a different illustration entirely — bat wings, bigger ears, bigger head, a long level
  // wand. Asked for a pointing pose it drew the stick at +64 degrees, pointing at the ceiling.
  //
  // So describe it as a ROTATION OF THE REFERENCE and nothing else, the same way `sheepish` only
  // worked once it became "the reference plus three changes". The paw barely moves: measured on
  // the real screen the text sits in a cone from a paw at about 60% down the body, which is where
  // the reference already holds it. Only the ROD turns.
  // Measured off the user's own pointing drawing, ref/pointing.png, which settles two things I had
  // wrong.
  //
  // THE ANGLE IS +63 DEGREES, not the +10 I calculated. I derived +10 from the screen geometry by
  // assuming the rod should literally aim along the sight-line to the text. Their drawing treats
  // it as a GESTURE toward the text instead, and that is the design call, not mine. The very first
  // generation came back at +64 and I rejected it as too steep. It was right.
  //
  // AND THE GRIP MOVES TO THE OTHER END. At rest the paw holds the TOP of the rod and it hangs
  // down. Pointing, the paw holds the BOTTOM and the rod goes up. Every prompt so far said
  // "gripped at its top end" even for the pointing pose, which is impossible for an upward rod.
  narrating: 'Copy the POSE in the FOURTH reference image exactly — the one where the mascot is '
           + 'POINTING — while keeping every detail of the character from the first image. '
           + 'The paw on the viewer\'s RIGHT is raised to about waist height and grips the stick '
           + 'near its LOWER end, the paw closed into a fist around it. From that grip the SHORT '
           + 'rod rises UP and to the RIGHT at a clear diagonal, about sixty degrees above '
           + 'horizontal, tip up beside the head. It is the SAME short rod as in the third image, '
           + 'the same length and the same thickness — it does not get longer or thinner, and it '
           + 'does not reach above the top of the head. '
           + 'The other paw hangs relaxed at the side. '
           + 'The MOUTH IS CLOSED in the soft friendly smile with the two blunt teeth below the lip '
           + 'line, as in the third image. '
           + 'The HEAD IS TILTED slightly toward the stick, and the dark almond eyes are shifted a '
           + 'little toward that side too, as if looking at what the stick is pointing at. The '
           + 'eyes do NOT change shape and NO white of the eye appears. '
           + 'The body stays square and front-facing, feet flat on the ground line. Nothing else '
           + 'changes from the first reference image',

  watching: 'standing square and front-facing exactly as in the reference, leaning forward just '
          + 'slightly from the waist, EYES looking down toward the work while the head itself '
          + 'stays upright and level — tilt the head no more than a few degrees, do NOT turn the '
          + 'body to the side and do NOT lay the head over. Mouth closed in a small interested '
          + 'smile, the pointer stick gripped and resting against the shoulder',
};

const dataUri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const refUris = REFS.map(dataUri);

async function one(name) {
  const prompt =
    `${CHARACTER}\n\n` +
    `THE FIRST REFERENCE IMAGE IS THE CHARACTER. Everything about how it is drawn comes from `
    + `that one image and nothing else: the proportions, the round body, the size and shape of `
    + `the ears, the purple colour, the flat fur with no texture or tufts, the plain red scarf, `
    + `the glasses and the face. Copy it exactly.\n\n`
    + `The other images are the SAME character. The second shows the mouth OPEN, the third shows `
    + `it CLOSED with the stick at rest, and the fourth shows the mascot POINTING with the `
    + `stick while its mouth is open. Take the mouth and the stick from those. Take NOTHING `
    + `ELSE from them. Do not `
    + `change the colour, the proportions, the ears, the scarf or the fur because of them.\n\n`
    + `Draw the SAME character in a new pose.\n\n` +
    `Pose: ${POSES[name]}.\n\n${MOUTH}\n\n${EYES}\n\n${GRIP}\n\n${ADDITIONS}\n\n` +
    `Keep the design identical to the reference — same proportions, same purple, same face, same ` +
    `glasses, same scarf, same stick, same outline weight. Do not restyle it.\n\n${FRAMING}`;

  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      modalities: ['image', 'text'],
      messages: [{
        role: 'user',
        content: [...refUris.map(url => ({ type: 'image_url', image_url: { url } })),
          { type: 'text', text: prompt }],
      }],
    }),
  });
  const json = await res.json();
  if (!res.ok) return { name, error: `HTTP ${res.status} ${JSON.stringify(json).slice(0, 200)}` };
  const img = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!img) return { name, error: 'no image returned' };
  fs.mkdirSync(OUT, { recursive: true });
  const f = `${OUT}/${name}.png`;
  fs.writeFileSync(f, Buffer.from(img.split(',')[1], 'base64'));
  return { name, f, s: (Date.now() - t0) / 1000, cost: json.usage?.cost };
}

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(POSES);
const results = await Promise.all(want.map(one));

let total = 0;
for (const r of results) {
  if (r.error) { console.error(`${r.name.padEnd(9)} FAILED  ${r.error}`); continue; }
  total += r.cost || 0;
  console.log(`${r.name.padEnd(9)} ${r.s.toFixed(1)}s  $${(r.cost ?? 0).toFixed(4)}  ` +
    `${(fs.statSync(r.f).size / 1024).toFixed(0)} KB`);
}
console.log(`\ntotal $${total.toFixed(4)}`);
