# In-lesson mascot reactions — state machine design

What the mascot does while a child answers, and when they get it right or wrong.

**Nothing here needs new artwork.** The animations already exist in
`~/Documents/lesson_screen/scene.rml`. What is missing is the machine that drives them.

## What already exists

| animation | what it is | state |
|---|---|---|
| `Breathing` | idle loop | wired, on its own layer |
| `Blink_Wait`, `Left Eye blink`, `Right Eye blink` | idle life | wired, two layers |
| `Thinking` | **while answering** | **drawn, not wired** |
| `Celebration`, `Celebration 4` | **correct** | **drawn, not wired** |
| `Frustrated`, `Frustrated 2` | **wrong** | **drawn, not wired** |

Measured from the file: the state machines are all called `State Machine 1`, they have layers for
breathing and blinking only, and **`inputs: NONE`** — there is nothing the app can drive. The
reaction animations sit in the file unreferenced.

So this is a wiring job, not a drawing job.

## Why Rive and not Masko's player

Masko's engine was reverse-engineered for this project (see `../MASKO.md`). Its graph model is the
right way to think about reactions — poses as nodes, clips as edges, Any State edges for
interrupts, priority to resolve conflicts. That thinking transfers.

**What does not transfer is its central constraint.** Masko's `At` enum is literally
`Time(u64) | End`: *a move only starts when the clip on screen ends*. A tap can wait up to a full
idle loop, and `instant: true` cuts the loop but snaps rather than blends.

For answer feedback that is disqualifying. A child taps an answer and the mascot has to react
**now**. Rive blends from any frame at any moment, so it does what Masko structurally cannot. This
is the clearest case yet for the rig.

## The design

### Inputs

The app drives these. They must be **view-model properties, not Rive events** — `triggers.py` in
the study project records why: the iOS backend of `@rive-app/react-native` 0.5+ has no event API,
so the app can only watch data binding. The study screen already mirrors every event as a
`StudyCardVM` trigger, and this follows the same pattern.

On a new `MascotVM`:

| property | type | set by the app when |
|---|---|---|
| `answering` | boolean | the child is interacting with the answer area |
| `correct` | trigger | the answer was right |
| `wrong` | trigger | the answer was wrong |
| `streak` | number | current run of correct answers, so celebrations can escalate |
| `soundOn` | boolean | matches the existing study-screen convention |
| `hapticLight` / `hapticTick` / `hapticMedium` | triggers | mirrored out, same names the app already listens for |

### Layers

Following the study file's multi-layer style, so each concern can be reasoned about alone.

**1. `Reaction`** — the new work.

```
        Entry ──► Idle ◄──────────────┐
                   │  ▲               │
      answering=T  │  │ answering=F   │
                   ▼  │               │
                Thinking               │
                                       │
   AnyState ──(correct, streak<5)──► Celebrate ──── on end ──┤
   AnyState ──(correct, streak>=5)─► Celebrate_Big ─ on end ─┤
   AnyState ──(wrong)─────────────► Console ────── on end ───┘
```

- `Celebrate` / `Celebrate_Big` / `Console` hang off **Any State**, so they interrupt whatever is
  playing — including each other. That is Masko's Any State idea, and it is what makes the
  reaction feel immediate.
- They return to `Idle` on completion, not on a timer, so the blend is clean.
- Transition duration in, **60–80 ms**. Out, 120–150 ms. Fast in so it feels like a response;
  slower out so it does not snatch the expression away.

**2. `Breathing`** — exists. Gate it off while a reaction plays, or the idle loop fights the
celebration's chest movement.

**3. `Blinking_left` / `Blinking_right`** — exist. Suppress during `Console`; `Frustrated` almost
certainly drives the eyes itself, and a stray blink on top reads as a glitch.

**4. `Sound`** — mirrors the study screen's layer exactly: an `AnimationState` per cue gated on
`soundOn`, with `AudioAsset` + `AudioEvent` fired from `KeyFrameCallback`, the pattern
`addsound.py` already established.

### Escalation

Duolingo's system is *"one musical and sonic idea, three levels of reward"* — the same idea
growing for a 5-in-a-row, a 10-in-a-row, a perfect lesson. `streak` is in the inputs for exactly
this. Start with two levels (`Celebrate`, `Celebrate_Big` at 5+) and leave room for a third.

### Sound and haptics

The existing kit in `~/Documents/study-sounds` already has usable material, and
`../tools/splash_cues.py` plus `../tools/sound_spec.py` give us a generator and a meter against
the measured spec in `../out/masko_redo/audio/TARGET.md`.

| cue | sound | haptic |
|---|---|---|
| correct | short rising figure, the house marimba/bell voice | `hapticLight` |
| correct, streak | the same figure, larger — not a different sound | `hapticMedium` |
| wrong | **a gentle fall, not a buzzer** | `hapticTick`, low sharpness |
| answering | nothing, or a very quiet tick on first interaction | none |

One design point worth stating plainly: **the wrong-answer reaction must be sympathetic, not
punishing.** The mascot is disappointed *with* the child, not *at* them. A harsh buzz and a sharp
haptic on a child's mistake is the fastest way to make a learning app unpleasant. `Frustrated`
reads as the right drawing for this; the sound and haptic have to match that intent.

## What I would build, in order

1. Wire `Reaction` with the four states and Any State interrupts. No sound, no haptics.
   **Review it moving before anything else is added.**
2. Add the layer gating so breathing and blinking stop fighting the reactions.
3. Add `soundOn` and the Sound layer, with cues generated to the measured spec.
4. Add the haptic triggers.
5. Mirror the inputs as `MascotVM` properties and verify against the RN data-binding path.

## Open questions

- **Is `answering` real?** It needs the app to know when a child is composing rather than idle. If
  that signal does not exist, `Thinking` cannot be driven and should be cut from v1 rather than
  faked on a timer.
- **Which artboard?** `lesson_screen` has three `State Machine 1`s across artboards. The target one
  needs confirming before wiring.
- **Does the lesson screen pull and push the same way as the study screen** (`rive push`,
  file 2631837)? If it is a different Rive file, it needs its own project id.
