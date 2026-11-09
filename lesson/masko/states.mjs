// Every prompt the lesson clip set is generated from, and the machine that links them.
//
//   node masko/states.mjs --print     writes masko/PROMPTS.md for review
//   node masko/states.mjs idle        prints one state's full prompt
//
// This file is the single source of truth. The markdown is generated from it, so the prompt you
// read in review is byte-for-byte the prompt that gets sent.
//
// Three blocks go in front of every performance, and each one exists because something broke
// without it:
//
//   IDENTITY  idle v2 passed every motion check with the mouth a dark gaping hole and both teeth
//             gone. The TEETH rule lived in masko_poses.mjs and was never carried into the video
//             prompt, so nothing protected the face once it started moving.
//   MOTION    idle v3 locked the face and the model went conservative everywhere — it held the
//             home pose for the last 1.6 s of 5 s. Saying "keep moving" is not enough; it has to
//             say the pace does not slacken AT THE END, which is exactly where it dies.
//   FRAME     a clip that drifts in scale or position cannot be keyed and composited against a
//             fixed layout, and nothing downstream can fix it.

const IDENTITY = `
IDENTITY — this never changes, not for one frame:
A round purple bat-pup study mascot. Large pointed triangular ears. Round thin gold-rimmed
glasses over big dark almond eyes, each with a SINGLE small white highlight dot. A small dark
rounded snout. A short red
ribbed knitted scarf with fringed ends. THE POINTER STICK IS SMALL. Measured off the reference it is a SHORT slim plain wooden rod only
about a QUARTER of the character's height, roughly as long as one of its arms. It is NOT a staff,
NOT a cane, NOT a pole and NOT a wand, and it NEVER reaches above the shoulder or past the head.
It is GRIPPED firmly, the paw closed into a fist around it, and WHICH END is gripped depends on
where the rod is going:
AT REST the paw holds the TOP of the rod, low at hip level, and the rod hangs DOWN and outward
with its tip near the ground.
POINTING the paw holds the BOTTOM of the rod, raised to about waist height, and the rod rises UP
and to the viewer's RIGHT at a clear diagonal, about sixty degrees above horizontal, tip up beside
the head.
Either way it is the SAME short rod. It never gets longer, never gets thinner and never reaches
above the top of the head.
Flat 2D vector cartoon: thick dark purple outlines, flat fills, soft lighter highlights, no
gradients, no texture, no shading.

THE MOUTH. The user supplied two references after the fifth pass, ref/mouth_open.png and
ref/mouth_closed.png, and those two states are the only correct ones.
THE TEETH ARE THE SAME IN BOTH. There are EXACTLY TWO of them and never any other number.
Each is a small, pure WHITE, BLUNT tile shaped like a little rounded rectangle, as wide as it is
tall, hanging straight DOWN from the UPPER LIP — one to the left of centre and one to the right.
THE TWO TEETH ARE ALWAYS SEPARATE, WITH A CLEAR GAP BETWEEN THEM, and that gap always shows the
dark interior behind. They are NOT fangs, NOT pointed, NOT triangular. They never sit on the lower
jaw and never float.
THEY NEVER MERGE INTO A ROW. There is never a continuous band, strip, wall, arc or row of white
across the mouth. There is never a full toothy grin. There are never upper AND lower rows. There
are never more than two teeth and there is never a single wide white shape. If the white in the
mouth is not two small separate tiles with dark between and around them, it is WRONG.
And the mouth is never drawn without them: an open mouth with no teeth at all is WRONG too.
CLOSED: a single simple dark curved smile line drawn straight on the face, with the two blunt
teeth hanging just below it. No cavity, no opening.
OPEN: a wide rounded cavity filled with DARK PURPLE, about #32085A — it is NOT red, NOT dark red,
NOT brown and NOT black. A single PINK HEART-SHAPED TONGUE, about #F06E8C, sits in the bottom of
the cavity. The same two white blunt teeth hang DOWN from the top edge, in the same places and at
the same size as when closed — the mouth opens BELOW them.
It must read as the SAME mouth in both states, and it must be in one of those two states or
moving between them at every moment of the clip.
THE EYES. Each eye is ONE single SOLID DARK PURPLE almond shape, wider than it is tall, with
exactly ONE small round WHITE HIGHLIGHT DOT near its upper inner corner. That is the whole eye.
There is NO white of the eye, NO sclera, NO white area around the dark shape, NO visible iris, NO
ring, NO second highlight, NO eyelashes and NO eyebrows drawn above them. The eye NEVER becomes a
big round glossy cartoon eye, and a white crescent NEVER appears under or beside the dark shape.
Both eyes stay the SAME size and shape throughout — they never grow, widen, round off or get
glossier. A blink closes them to a curved line and reopens them unchanged; a happy squeeze curves
them upward. Neither ever shows any white.
BECAUSE THE EYE HAS NO WHITE IN IT, IT CANNOT SHOW A DIRECTION OF GAZE. When the mascot looks
somewhere, the HEAD turns or dips to aim the face. The dark eye shape may slide a little within
its socket, but no white ever appears to sell the look.
The pale diagonal streak across each lens belongs to the GLASSES, not to the eye, and sits on top
of it.
The glasses stay round, gold-rimmed and level on the
face, with the white highlight on the lenses. The ears keep their pointed triangular bat shape —
never floppy, never rounded, never dog-like.
The expression stays warm and friendly throughout: never startled, never frowning, never
surprised, never angry, never sad, never blank.

ADD NOTHING. The character has exactly the parts in the reference and no others.
It has NO WINGS and no wing membranes. No cape, no cloak, no hood, no second scarf, no extra
fabric, no tail, and no shapes of any kind behind or attached to the arms, the back or the
shoulders — not at any point, and not because it is jumping or celebrating.
THE SHORT RED SCARF IS THE ONLY LOOSE PART ON THE WHOLE CHARACTER. It is the only thing that
hangs, drapes, flows or trails, and so it is the only thing that gets to move that way. Nothing
else appears behind the body while it moves.
The body is ONE flat purple all over: no lighter belly patch, no chest marking, no tummy oval, no
two-tone shading on the torso.
The ears, the head, the eyes and the glasses all stay THE SAME SIZE throughout. Parts rotate and
move; they never grow, stretch or change proportion.

AND TWO MORE THE MODEL BREAKS UNLESS TOLD NOT TO. Both happened:
The ears NEVER droop, flop, fold, sag or round off. Not when wincing, not when sad, not ever. They
are rigid pointed triangles and they only ever TILT as one piece.
The teeth are visible on EVERY frame the mouth is open. An open mouth is a SMILE with both blunt
teeth sitting along the upper lip — never a round hole, never a plain oval, never an open mouth
with the teeth missing.`.trim();

const MOTION = `
MOTION — this matters as much as the drawing:
Something is moving in EVERY frame, from the first frame to the last. The motion never pauses,
never settles and never slows down toward the end — the final second must be exactly as alive as
the first. Do not hold a pose. Do not ease to a stop. Do not come to rest. There is no moment
anywhere in the clip where the whole character is still at once.
The parts move at different rates and out of phase with each other, so no single beat dominates
and no two things start or stop together.
Keep every movement SMALL. This plays at about the size of a thumbnail beside the question, so it
has to read as quiet presence, never as a performance competing with the lesson.`.trim();

const FRAME = `
FRAME — fixed:
The camera does not move: no zoom, no pan, no push in, no shake. The character stays the SAME
size for the whole clip and stays centred, feet on the same invisible ground line.
Flat solid chroma-key green (#09ae4f) filling the frame edge to edge — no gradient, no vignette,
no ground shadow, no cast shadow.
Nothing else is in frame: no confetti, no sparkles, no stars, no motion lines, no text, no logo,
no scenery, no props.`.trim();

// WHERE A CLIP ENDS IS THE WHOLE DESIGN, and this is the second time it has changed.
//
// It used to be that every clip began and ended on `idle`, so a reaction always came home. The
// Eddy Interactions file (Rive 2601980) does something better and it is worth copying exactly: a
// reaction does NOT come home. It flows straight into an idle OF ITS OWN and stays there.
//
// Eddy has `Correct answer` -> `Correct answer idle`, `Incorrect answer` -> `Incorrect answer
// idle`, both on exitTime 100%, both looping forever. The character stays pleased, or stays
// sheepish, for as long as the child sits there. Nothing returns to neutral on its own.
//
// That is right, and returning home was wrong, because the mood belongs to the QUESTION, not to
// the clip. A child who just got it wrong is still in that moment until they try again. Sending
// the mascot back to neutral two seconds later throws away the one thing the reaction was for.
//
// So `home` becomes `from` and `to`. A loop has from === to, as before. A one-shot now ENDS
// somewhere else, and what it ends in is a loop, which is why this is not the old edge model: you
// can be left in a MOOD, which is the point, but never in a POSE, because something is always
// looping wherever you land.
//
// One state is ours and has no Eddy equivalent. Eddy only reacts; this mascot also gives the
// child their DIRECTIONS, which is `narrate`. It sits beside `idle` rather than inside the mood
// chain: giving directions is the mascot being a teacher, not being pleased or sorry.
export const STATES = {
  idle: {
    kind: 'loop',
    from: 'idle',
    to: 'idle',
    fires: 'the default — anything other than a voice line or a reaction',
    means: 'I have asked, and I am here with you while you work it out',
    // This is the state the lesson spends nearly all of its time in, so it carries both halves of
    // what used to be two states: present and patient, AND paying attention to the work. The
    // attention is a beat in the cycle, not a posture — see the note above `STATES`.
    performance: `
PERFORMANCE — idle:
The mascot has just asked the question and is with the child while they work it out. It is
present, patient and paying attention. It is not performing, and it is not asleep.
All of this runs continuously and overlapping, never one thing at a time:
- the head TURNS to look left, then turns to look right, then back toward the middle. A real turn,
  far enough that the silhouette of the head and ears visibly changes — not a tilt, not a wobble.
- TWICE in the clip the mascot gives its attention to the work: the head dips, the shoulders lean
  in just slightly, and the FACE aims down toward where the child is working — then it comes back
  up to centre. These are the beats that point the child at the question. The lean is small and it
  always returns; the mascot does not stay hunched forward.
- the body rises and falls with slow steady breathing the whole time.
- the SHORT stick stays gripped at its top in the low paw at hip level, its tip on the ground; it
  shifts a few degrees with the body and nothing more. It is never raised and never swings out.
- the free paw shifts its position and the fingers flex a little.
- the scarf ends trail and settle behind each body movement, always arriving a beat late.
- the ears turn forward on the glances down, and give small independent twitches at odd moments.
- the white highlight on the glasses slides across the lens as the head turns and dips.
- one slow blink early in the clip and one more near the end.
THE MOUTH STAYS CLOSED in the soft friendly smile for the entire clip, with the two blunt teeth
showing below the lip line. It may purse or shift very slightly. It never opens.
The body stays square and front-facing throughout — it does NOT turn to the side, and the head is
never laid over.`,
  },

  narrate: {
    kind: 'loop',
    from: 'narrating',
    to: 'narrating',
    fires: 'a voice line is playing — tiled for as long as the line lasts',
    means: 'I am telling you something',
    // Pinned to `idle`, not to the open-mouthed `narrate` pose. A mouth caught mid-word is a bad
    // frame to join a loop on: it is one specific shape, and the tile would stutter on it. The
    // closed smile is the rest position of speech, so a sentence can be cut anywhere.
    performance: `
PERFORMANCE — narrate:
The mascot is speaking to the child, explaining the question warmly and clearly.
THE MOUTH MOVES THE WHOLE TIME, the way a mouth moves through a sentence: many small openings and
closings in a steady rhythm, never one long hold. It must open and close at least eight separate
times across the clip.
Every time it opens, EVERY SINGLE TIME, the open mouth must contain all three of these at once:
the DARK PURPLE cavity (about #32085A, never red, never brown, never a flat black hole), the PINK
HEART-SHAPED TONGUE sitting in the bottom of it, and the TWO SEPARATE BLUNT WHITE TEETH hanging
from the upper lip with dark cavity visible between and around them.
If any one of those three is missing from a frame, that frame is wrong. In particular the teeth
must never fuse into a single white band across the mouth and the mouth must never become a plain
toothy grin — which is the specific way this keeps going wrong. It never opens wider than about half the height of the snout. It returns all
the way to the closed smile several times during the clip, and it is CLOSED on the first and the
last frame.
Under the speech, continuously:
- small nods of the head on the stressed words, made from the tilted position and returning to it.
- the free paw makes small open explaining gestures, moving through the whole clip.
- THE HAND IS WORKING THE STICK, because the mascot is teaching with it. The paw grips the rod's
  LOWER end and stays raised at about waist height; the rod stays up at its diagonal, pointing up
  and to the viewer's RIGHT at roughly sixty degrees, and the hand gives it small deliberate
  movements — short taps, a small sweep along, a little lift and settle — as if indicating the
  words one after another. It always comes back to about the same diagonal.
  It does NOT drop to the ground, does NOT go vertical, does NOT swing across the body, does NOT
  get longer and the grip NEVER leaves the rod: the paw is closed around it in every single frame.
- THE HEAD STAYS TILTED toward the stick, and the dark almond eyes stay shifted a little that way
  too, looking at what is being pointed at. That is where the teaching is happening. The eyes do
  not change shape and no white of the eye ever appears.
- the scarf ends trail behind the nods.
- one blink, closing to a curved line and reopening unchanged. No eyebrows anywhere.
The mascot glances out at the child once or twice, then back to the stick. The head does that,
not the eyes.`,
  },

  yes: {
    kind: 'one-shot',
    from: 'idle',
    to: 'pleased',
    fires: 'correct answer — every one of them',
    means: 'nice one',
    // It used to come back to `idle`. It now lands in `pleased` and leaves it running, so the
    // celebration does not evaporate two seconds after the child earned it.
    performance: `
PERFORMANCE — yes:
A big joyful celebration for a correct answer, which SETTLES INTO BEING PLEASED and stays there.
Beat one: the mascot crouches very slightly, then JUMPS with both feet clearly off the ground, the
free paw thrown up high, the SHORT stick staying gripped low at hip level and NOT raised, the ears up, the scarf ends flying outward. The
mouth is WIDE OPEN CHEERING — an open SMILE with the corners well up, both blunt teeth clearly
visible along the upper lip, the pink heart tongue in the bottom, the inside DARK PURPLE about #32085A. The eyes are happy
upward curves showing no white.
Beat two: it comes down and lands with a soft springy squash.
Beat three — and the clip MUST end here: it rises back up onto the balls of its feet, still
delighted, the free paw staying HALF RAISED about shoulder height rather than dropping all the way
down, the chest up, the mouth settling into a big CLOSED proud smile with the corners well up and
both blunt teeth below the lip, the eyes still happy. It does NOT return to the plain relaxed
standing pose and it does NOT drop its paw to its side.
The landing is cushioned, never a hard stop, and the breathing, the scarf and the stick keep
moving through the last frame — it never freezes.
NO confetti, NO stars, NO sparkles, NO motion lines, NO wings. The character only.`,
  },

  oops: {
    kind: 'one-shot',
    from: 'idle',
    to: 'sheepish',
    fires: 'wrong answer',
    means: 'that one hurt',
    // This used to carry its own recovery, because nothing else would: split in two, a dropped
    // second half left the child sitting in the bad beat. Under the mood model the recovery is not
    // a clip at all — `sheepish` is where the child sits, so `sheepish` is what has to be kind.
    // That is better than it sounds. A two-second scripted recovery rushed the child through the
    // moment; a warm held loop lets them take as long as they need.
    performance: `
PERFORMANCE — oops:
A sympathetic wince that SETTLES INTO SITTING WITH THE CHILD and stays there.
Beat one: the shoulders pull in, the head dips, the face aims down, and the scarf ends fall heavy and
straight. The mouth stays CLOSED throughout, with both blunt teeth showing below the lip. This is
sympathy — feeling it WITH the child — never disappointment, never judgement, never scolding.
The ears tilt BACKWARD as one rigid piece and KEEP their pointed triangular shape. They do not
droop. They do not flop. They do not round off. They do not fold.
Beat two — and the clip MUST end here: the head comes back up LEVEL and front-facing, aimed at the
child again, the shoulders still a little in, and the closed mouth softens from flat into a small KIND sympathetic smile. It does NOT
straighten fully, does NOT raise its paw in a gesture, and does NOT return to the plain relaxed
standing pose — it stays gently hunched and connected.
Keep breathing, the scarf and the stick moving through the last frame — it never freezes.
This reaction is never loud and the mouth never opens.`,
  },

  // The two moods. These are where the lesson actually WAITS, so they matter more than the
  // reactions that lead into them: the reaction lasts two seconds and the mood lasts as long as
  // the child does.
  pleased: {
    kind: 'loop',
    from: 'pleased',
    to: 'pleased',
    fires: 'after `yes`, and holds until the child moves on',
    means: 'you got that, and I am still pleased about it',
    performance: `
PERFORMANCE — pleased:
The mascot is STILL pleased about the answer the child just got right, and it stays that way. The
big cheer already happened; this is the glow afterwards. It is a held mood, not a performance —
it must be able to run for half a minute without becoming annoying.
Throughout, continuously and overlapping:
- a light springy bounce on the balls of the feet, smaller than a jump, never leaving the ground.
- the free paw stays HALF RAISED at about shoulder height and sways there; it never drops to the
  side and it never pumps.
- the chest stays up and the shoulders stay open.
- the head gives small proud tilts side to side, and once in the clip it looks over at the child
  as if checking they saw.
- the ears stay up and give small twitches.
- the scarf ends bounce and settle a beat behind the body.
- the SHORT stick, gripped at its top in the low paw, rides the bounce without leaving the
  ground or rising above hip level.
- the white highlight on the glasses shifts with the head.
- two blinks, spaced apart, both happy curved squeezes rather than flat blinks.
THE MOUTH STAYS CLOSED in a big proud smile with the corners well up and both blunt teeth showing
below the lip. It does NOT hang open — a mouth held open for a whole loop reads as manic.`,
  },

  sheepish: {
    kind: 'loop',
    from: 'sheepish',
    to: 'sheepish',
    fires: 'after `oops`, and holds until the child tries again',
    means: 'that one hurt, and I am right here',
    // The most important clip in the set. The child sits here after getting something wrong, for
    // as long as it takes them to go again, so whatever this loop says is what the app says about
    // being wrong.
    performance: `
PERFORMANCE — sheepish:
The mascot felt that wrong answer WITH the child and is still sitting there with them. It is a held
mood that has to stay kind for as long as it runs — half a minute if the child needs it.
It is NOT sad. It is NOT sulking. It is NOT disappointed and it is NEVER scolding. The whole read
is "that one hurt, and I am right here" — company, not pity.
Throughout, continuously and overlapping:
- the shoulders stay a little drawn in, and the head stays LEVEL and front-facing, aimed at the
  child the whole time. The head is never bowed and the eyes never change shape to show a gaze.
- slow, soft breathing lifts and drops the shoulders.
- the free paw makes a small patient open gesture, low and unhurried, returning and repeating.
- once in the clip the head tips gently toward the work, as if to say "shall we look again".
- the ears tilt BACKWARD as one rigid piece and stay pointed triangles. They do not droop, flop,
  fold or round off at any point.
- the scarf ends hang heavier than in idle and sway slowly.
- the SHORT stick stays gripped at its top in the low paw at hip level, tip on the ground, leaning
  only very slightly with the breathing.
- the white highlight on the glasses shifts slightly.
- two slow blinks, soft and unhurried.
THE MOUTH STAYS CLOSED the whole clip, in a small kind sympathetic smile — not a frown, which held
for this long reads as sulking, and not a grin. Both blunt teeth show below the lip.`,
  },
};

export const PREAMBLE = [IDENTITY, MOTION, FRAME].join('\n\n');

export const prompt = name =>
  `${PREAMBLE}\n\n${STATES[name].performance.trim()}`;

// Every state change the app can make. Copied from how Eddy wires it, with `narrate` added.
//
// `auto` is Eddy's exitTime 100%: the reaction finishes and flows into its mood with nothing
// firing it. Those two are the ONLY automatic transitions. Everything else waits for the app, and
// nothing ever leaves a mood by itself.
//
// `cut` where the two clips share a frame, `blend` where they do not. Eddy blends all fifteen of
// its transitions over 100 ms cubic, which at 60 fps is six frames — the same six the loop closer
// arrived at on its own. So: blend, 6 frames, and match the early-exit behaviour too, which means
// an answer landing mid-narration cuts straight into the reaction without waiting for the line.
export const EDGES = [
  // giving directions
  ['idle',     'narrate',  'speak()',          'cut'],
  ['narrate',  'idle',     'speechEnd()',      'cut'],

  // answering
  ['idle',     'yes',      'answerCorrect()',  'cut'],
  ['idle',     'oops',     'answerWrong()',    'cut'],
  ['narrate',  'yes',      'answerCorrect()',  'cut'],   // early exit, mid-sentence
  ['narrate',  'oops',     'answerWrong()',    'cut'],   // early exit, mid-sentence

  // the reaction flows into its mood and is left running
  ['yes',      'pleased',  'auto',             'cut'],
  ['oops',     'sheepish', 'auto',             'cut'],

  // and only the child's next move takes it out again
  ['pleased',  'narrate',  'nextQuestion()',   'blend'],
  ['pleased',  'idle',     'nextQuestion()',   'blend'],
  ['sheepish', 'idle',     'retry()',          'blend'],
  ['sheepish', 'narrate',  'hint()',           'blend'],
];

if (process.argv[2] === '--print') {
  const fs = await import('node:fs');
  let md = `<!-- generated by masko/states.mjs --print — do not edit by hand -->\n`;
  md += `# Every prompt, in full\n\n`;
  md += `The three blocks below go in front of EVERY state. They are the whole prompt apart from\n`;
  md += `the performance, and each one is there because a clip failed without it.\n\n`;
  md += `## The preamble (identical for all six)\n\n\`\`\`\n${PREAMBLE}\n\`\`\`\n\n`;
  md += `## The performances\n\nEach one is appended to the preamble above.\n`;
  for (const [name, s] of Object.entries(STATES)) {
    md += `\n### \`${name}\` — ${s.means}\n\n`;
    md += s.from === s.to
    ? `**${s.kind}**, start frame = end frame = \`${s.from}.png\`. Fires: ${s.fires}.\n\n`
    : `**${s.kind}**, starts on \`${s.from}.png\` and ENDS on \`${s.to}.png\`, which is where \`${s.to}\` picks it up. Fires: ${s.fires}.\n\n`;
    md += `\`\`\`\n${s.performance.trim()}\n\`\`\`\n`;
  }
  fs.writeFileSync(new URL('./PROMPTS.md', import.meta.url), md);
  console.log(`wrote masko/PROMPTS.md  (${Object.keys(STATES).length} states, ` +
    `preamble ${PREAMBLE.length} chars)`);
  for (const [n, s] of Object.entries(STATES)) {
    console.log(`  ${n.padEnd(9)} ${s.kind.padEnd(9)} ${s.from.padEnd(9)} -> ${s.to.padEnd(9)} ` +
      `${prompt(n).length} chars`);
  }
} else if (process.argv[2]) {
  console.log(prompt(process.argv[2]));
}
