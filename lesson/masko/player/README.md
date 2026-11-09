# The player

Three files. `machine.js` is the rules, `dom.js` renders them with video, `demo.html` is a harness
with the same test buttons the Eddy Interactions file has.

```
machine.js   the state machine — no DOM, no video, no dependencies
dom.js       two stacked <video> layers, crossfade, format pick
demo.html    click the events and watch it
```

**Live:** https://istafrica-ariga.github.io/twist-mascot-animation/

Run it locally:

```bash
python3 -m http.server 8745 --directory /Users/ariga/Documents/mascot/lesson
# then open http://localhost:8745/masko/player/demo.html
```

## The one idea

Every clip declares the pose it **starts** on and the pose it **ends** on:

| clip | kind | from | to |
|---|---|---|---|
| `idle` | loop | idle | idle |
| `narrate` | loop | narrating | narrating |
| `pleased` | loop | pleased | pleased |
| `sheepish` | loop | sheepish | sheepish |
| `yes` | one-shot | idle | **pleased** |
| `oops` | one-shot | idle | **sheepish** |

From that one fact the machine derives every join: clips that meet on the same pose are **cut**
between, clips that do not get a **167 ms** crossfade (4 frames at 24 fps, which is what
`loopclose.py` settled on for a dissolve inside a loop). Nothing is hand-written per transition.

27 transitions, 4 of them hard cuts: `idle → yes`, `idle → oops`, and the two automatic flows
`yes → pleased` and `oops → sheepish`.

## Events

```js
import { mountMascot } from './dom.js';
const mascot = mountMascot(document.getElementById('stage'));

mascot.speak();          // a voice line starts   -> narrate
mascot.speechEnd();      // the line finished     -> idle
mascot.answerCorrect();  // -> yes, then it flows into pleased on its own
mascot.answerWrong();    // -> oops, then sheepish
mascot.nextQuestion();   // leaves a mood         -> narrate
mascot.retry();          // the child goes again  -> idle
mascot.hint();           // -> narrate, out of sheepish
```

**An answer is honoured from every state**, including from inside a mood. That is deliberate and it
was a bug first: with `answerWrong` missing from `pleased`, a wrong answer arriving before the app
had sent `nextQuestion` left the mascot sitting there looking delighted. Driving the demo found it;
reading the table had not. Eddy's file wires every reaction from every state for the same reason —
the lesson is not obliged to be well behaved.

Nothing times out of a mood. The mascot stays pleased, or stays sheepish, until the child does
something.

## Formats

Both are shipped, and the browser is asked which it can take rather than being sniffed:

| | file | plays on |
|---|---|---|
| HEVC + alpha | `masko/clips/*.mov` | Safari, iOS, macOS |
| VP9 + alpha | `masko/web/*.webm` | Chrome, Edge, Firefox, Android |

## Dropping it into the Expo app

`machine.js` goes in as-is — it has no dependencies and no DOM. `dom.js` does not; it needs a React
Native equivalent, and there is a real decision behind that:

**The app has no video player.** `twist-mobile-ui-refresh` ships `@rive-app/react-native`,
`@shopify/react-native-skia`, `lottie-react-native` and `react-native-reanimated` — and no
`expo-video`, no `expo-av`, no `react-native-video`. Playing these clips means adding one.

Three ways, in order of how much they fight the platform:

1. **`expo-video`, HEVC on iOS and VP9 webm on Android.** Closest to `dom.js`: two `VideoView`s,
   crossfade with Reanimated. Android's VP9 alpha support goes through ExoPlayer and is the part to
   test first.
2. **Stacked video through Skia**, which the app already has: colour on top, alpha mask below, one
   shader composites them. This is what the Masko player does for Android and it avoids the alpha
   codec question entirely. More work, fewer surprises.
3. **Rive.** The rigged bat-pup already exists in `study_screen_animation.riv`, and Rive is already
   a dependency. It is the only route where the arm can be AIMED rather than baked — see the
   pointing postscript in `../STATES.md`. It is also the largest change.

The machine is the same under all three. Only the renderer differs.
