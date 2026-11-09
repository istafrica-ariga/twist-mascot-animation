# How "Eddy Interactions" handles it

Rive file **2601980** in the Rive account, pulled read-only into `~/Documents/eddy-interactions`.
Eddy is the Duolingo jogger, with three test buttons wired beside him — neutral, correct,
incorrect. Four artboards: `Reactive Eddy` plus one per button. The buttons are demo scaffolding
(Hover / Click / Idle, 260x260, their own click sound); everything that matters is on `Reactive
Eddy`, which runs **one state machine, one layer, five animations and three triggers**.

60 fps, no explicit rate set.

## The five animations

| animation | work area | length | loops |
|---|---|---|---|
| `Neutral` | 0–112 | 1.87 s | **yes** |
| `Correct answer` | 0–103 | 1.72 s | no |
| `Correct answer idle` | 7–172 | 2.75 s | **yes** |
| `Incorrect answer` | 0–112 | 1.87 s | no |
| `Incorrect answer idle` | 0–161 | 2.68 s | **yes** |

Three triggers: `Correct clicked`, `Incorrect clicked`, `Neutral clicked`. No booleans, no numbers.
Fifteen transitions, twelve of them trigger conditions.

## The graph

```
                        Entry
                          │
                          ▼
                  ┌───► NEUTRAL ⟲ ◄──────────────┐
                  │    1.87 s loop               │
                  │       │                      │
      Neutral     │  Correct / Incorrect         │   Neutral
      clicked     │       │                      │   clicked
                  │       ▼                      │
                  │  CORRECT ANSWER  ──100%──► CORRECT ANSWER IDLE ⟲
                  │   1.72 s one-shot            2.75 s loop
                  │       │  ▲                      │  ▲
                  │       │  └──── Correct clicked ─┘  │
                  │       │                            │
                  │   Incorrect clicked ───────────────┘
                  │       │
                  │       ▼
                  └── INCORRECT ANSWER ─100%─► INCORRECT ANSWER IDLE ⟲
                       1.87 s one-shot          2.68 s loop

  every trigger transition: 100 ms cubic blend, enableEarlyExit = true
  the two ──100%──► arrows: exitTime 100%, the ONLY automatic transitions
```

## The thing worth taking

**A reaction does not go home. It lands in its own idle, and stays there.**

`Correct answer` finishes and flows automatically into `Correct answer idle`, which loops forever.
`Incorrect answer` flows into `Incorrect answer idle`. The character **stays in the mood** — pleased
after a right answer, sheepish after a wrong one — until something explicitly sends it back.

Nothing returns to `Neutral` on its own. The only route back is the `Neutral clicked` trigger, and
every one of the four non-neutral states has that transition.

So the real shape is not "idle, with reactions on top". It is **three resting moods**, with a
one-shot performance on the way into two of them.

### What that costs us

Our four clips are `idle`, `narrate`, `yes`, `oops`, all pinned start = end = `idle.png`, so every
reaction returns home the instant it ends. The mood is thrown away at the end of the clip. Eddy
keeps it for as long as the child sits there.

Matching it needs two more loops — a pleased idle and a sheepish idle — and changes `yes` and
`oops` from self-closing clips into clips that START at `idle` and END in the mood pose. **500
credits for the two idles, 500 to regenerate the two reactions to land in them. 1,000 total.**

### Why this does not revive the stranding problem

The edge model was dropped because an edge ends standing in the target pose and waits there. Eddy
shows the missing half: **every node is a loop**. You can be stranded in a *mood*, which is fine and
is the point, but never in a *pose*, because there is always a loop running wherever you land. The
objection was to edges without destination idles, not to edges.

## Four smaller things

* **Nothing cuts.** Every trigger transition is a **100 ms cubic blend** — 6 frames at 60 fps,
  almost exactly the 6-frame dissolve `loopclose.py` settled on. Our state diagram claims hard cuts
  are free because the home frames match. They are, but Eddy blends anyway.
* **`enableEarlyExit = true` on all twelve.** A reaction can interrupt a reaction mid-play. Right
  answer while the wrong-answer wince is still going: allowed, immediately. Nothing waits for a clip
  to finish.
* **Sound fires on impact, not on entry.** The `Correct answer` audio event is a `KeyFrameCallback`
  at **frame 54 of 103** — just past halfway, on the hit. Incorrect fires at **frame 10 of 112**,
  almost immediately. Two different sounds, two different reasons: the cheer lands with the gesture,
  the stumble lands with the knock.
* **Effects are keyed artwork, not simulation.** `Dust.svg` and `Dust new.svg` appear through `Solo`
  nodes switched on at frame 51 and off at 101 (correct), 64 and 109 (incorrect). The smears —
  `Left smear.svg`, `Right smear` — are visible for **four frames only** (26–30) while the arm group
  is hidden and swapped back after. Classic smear-frame substitution, plus `Upper fist`, `Side fist
  left`, `Side fist right` swapped in per pose. 81 `KeyFrameId` keys in the file: that is frame-by
  -frame artwork replacement living inside a rigged animation.

## Not worth copying

* The three button artboards. Scaffolding for the demo.
* 3,268 orphaned objects (3,255 interpolators) left behind by editor deletes — they build into
  nothing.
* Two `AudioEvent`s point at `AudioAssetClip` where `AudioAsset` is required, so **the sound is
  silently ignored at runtime**. The ids resolve, so nothing else complains. Worth knowing before
  wiring our own audio the same way.
