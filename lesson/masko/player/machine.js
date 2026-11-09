// The lesson mascot's state machine. No dependencies, no DOM, no video — just the rules.
//
// Everything about WHICH clip plays and HOW it is joined to the last one lives here, so it can be
// unit-tested, and so the renderer (a <video> pair on the web, expo-video or Skia in the app) is
// only a renderer.
//
// The shape is copied from the Eddy Interactions Rive file: a reaction does not come home, it flows
// into an idle OF ITS OWN and stays there until the child moves on. See masko/EDDY.md.

/**
 * Each clip declares the pose it STARTS on and the pose it ENDS on. That one fact decides
 * everything else: two clips that meet on the same pose can be cut between, and two that do not
 * need a blend. Nothing here is hand-written per transition.
 */
export const CLIPS = {
  idle:     { kind: 'loop',     from: 'idle',      to: 'idle'     },
  narrate:  { kind: 'loop',     from: 'narrating', to: 'narrating' },
  pleased:  { kind: 'loop',     from: 'pleased',   to: 'pleased'  },
  sheepish: { kind: 'loop',     from: 'sheepish',  to: 'sheepish' },
  yes:      { kind: 'one-shot', from: 'idle',      to: 'pleased'  },
  oops:     { kind: 'one-shot', from: 'idle',      to: 'sheepish' },
};

/**
 * What the app can ask for, and where it lands. `null` means "ignored in this state" — the machine
 * never throws on an event it cannot use, because a lesson will fire `speechEnd` after a reaction
 * has already interrupted the line.
 */
const ROUTES = {
  idle:     { speak: 'narrate', answerCorrect: 'yes', answerWrong: 'oops' },
  narrate:  { speechEnd: 'idle', answerCorrect: 'yes', answerWrong: 'oops' },
  // A mood is left only when the child does something. Nothing times out of it.
  //
  // An ANSWER is honoured from every state, including from inside a mood. Driving the demo caught
  // this: with `answerWrong` missing from `pleased`, a wrong answer landing before the app had sent
  // `nextQuestion` left the mascot sitting there looking delighted. That is the worst failure in
  // the whole set, and it was a missing table entry. Eddy's file wires every reaction from every
  // state for the same reason — the lesson is not required to be well behaved.
  pleased:  { nextQuestion: 'narrate', speak: 'narrate', idle: 'idle',
              answerCorrect: 'yes', answerWrong: 'oops' },
  sheepish: { retry: 'idle', hint: 'narrate', nextQuestion: 'narrate', speak: 'narrate',
              answerCorrect: 'yes', answerWrong: 'oops' },
  // During a reaction the next answer can still land, and it wins immediately.
  yes:      { answerWrong: 'oops', answerCorrect: 'yes', speak: 'narrate', nextQuestion: 'narrate' },
  oops:     { answerCorrect: 'yes', answerWrong: 'oops', speak: 'narrate', retry: 'idle' },
};

/** Where a one-shot goes on its own when it finishes. Eddy's `exitTime 100%`. */
const AUTO = { yes: 'pleased', oops: 'sheepish' };

export const BLEND_FRAMES = 4;   // what loopclose.py settled on for a dissolve inside a loop
export const FPS = 24;

/** Milliseconds to blend between two clips: zero when they meet on the same pose. */
export function joinMs(fromClip, toClip) {
  const a = CLIPS[fromClip], b = CLIPS[toClip];
  if (!a || !b) return 0;
  return a.to === b.from ? 0 : Math.round((BLEND_FRAMES / FPS) * 1000);
}

export class MascotMachine {
  /** @param {(clip: string, joinMs: number, prev: string|null) => void} onPlay */
  constructor(onPlay, start = 'idle') {
    this.onPlay = onPlay;
    this.current = null;
    this.go(start);
  }

  /** Fire an app event. Returns the clip now playing, or null if the event did not apply. */
  send(event) {
    const next = ROUTES[this.current]?.[event];
    if (!next) return null;
    this.go(next);
    return next;
  }

  /** Tell the machine a one-shot reached its end. Loops never call this. */
  ended() {
    const next = AUTO[this.current];
    if (!next) return null;
    this.go(next);
    return next;
  }

  go(clip) {
    if (!CLIPS[clip]) throw new Error(`no clip "${clip}"`);
    const prev = this.current;
    const ms = prev ? joinMs(prev, clip) : 0;
    this.current = clip;
    this.onPlay(clip, ms, prev);
  }

  get isLoop() { return CLIPS[this.current].kind === 'loop'; }
}

/** Every transition the machine can make, for docs and tests. */
export function transitions() {
  const out = [];
  for (const [from, routes] of Object.entries(ROUTES))
    for (const [event, to] of Object.entries(routes))
      out.push({ from, event, to, joinMs: joinMs(from, to) });
  for (const [from, to] of Object.entries(AUTO))
    out.push({ from, event: 'auto (clip ends)', to, joinMs: joinMs(from, to) });
  return out;
}
