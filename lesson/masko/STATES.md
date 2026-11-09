# The six states, and how they connect

Prompts live in `masko/states.mjs`; `node masko/states.mjs --print` writes them all to
`masko/PROMPTS.md`. This file is the part no prompt can tell you: where each clip ends, and why.

## Where a clip ends is the whole design

It used to be that every clip began and ended on `idle`, so a reaction always came home. The
**Eddy Interactions** file (Rive 2601980 — read up in `masko/EDDY.md`) does something better, and
it is worth copying exactly:

**A reaction does not come home. It flows into an idle of its own, and stays there.**

Eddy has `Correct answer → Correct answer idle` and `Incorrect answer → Incorrect answer idle`,
both on `exitTime 100%`, both looping forever. The character stays pleased, or stays sheepish, for
as long as the child sits there. Nothing returns to neutral on its own.

That is right and coming home was wrong, because **the mood belongs to the question, not to the
clip**. A child who just got something wrong is still in that moment until they try again. Sending
the mascot back to neutral two seconds later throws away the one thing the reaction was for.

| clip | kind | starts on | ends on |
|---|---|---|---|
| `idle` | loop | `idle` | `idle` |
| `narrate` | loop | `idle` | `idle` |
| `yes` | one-shot | `idle` | **`pleased`** |
| `oops` | one-shot | `idle` | **`sheepish`** |
| `pleased` | loop | `pleased` | `pleased` |
| `sheepish` | loop | `sheepish` | `sheepish` |

### This is not the old edge model

Edges were dropped because an edge ends standing in the target pose and waits there. Eddy supplies
the missing half: **every node is a loop.** You can be left in a *mood*, which is the point, but
never in a *pose*, because something is always running wherever you land. The objection was to
edges with no destination idle, not to edges.

### What is ours and not Eddy's

Eddy only reacts. This mascot also gives the child their **directions**, which is `narrate`. It
sits beside `idle` rather than inside the mood chain, because giving directions is the mascot being
a teacher, not being pleased or sorry.

## The machine

```
            ┌──────────── nextQuestion() ──────────────────────────────┐
            │          the mood holds until the child moves on         │
            ▼                                                          │
         IDLE ⟲ ──── answerCorrect() ───► YES ──auto──► PLEASED ⟲ ─────┤
      (idle frame)                     one-shot      (pleased frame)   │
          │  ▲                                                         │
     speak│  │speechEnd                                                │
          ▼  │                                                         │
      DIRECTIONS ⟲ ─ answerWrong() ───► OOPS ──auto──► SHEEPISH ⟲ ─────┘
      (idle frame)                    one-shot      (sheepish frame)   │
            ▲                                                          │
            └──────────── retry()  /  hint() ──────────────────────────┘
                   the child goes again, and only then does it let go

  auto = Eddy's exitTime 100%. The only two transitions nothing has to fire.
  Everything else waits for the app. Nothing ever leaves a mood by itself.
  Every blend: 6 frames, early exit on.
```

## What each state means

| state | the app fires it when | it has to say |
|---|---|---|
| `idle` | nothing else is true | *I am here while you work it out* |
| `narrate` | a direction is being spoken | *I am telling you what to do* |
| `yes` | correct answer | *nice one* |
| `pleased` | after `yes`, until the child moves on | *and I am still pleased about it* |
| `oops` | wrong answer | *that one hurt* |
| `sheepish` | after `oops`, until the child tries again | *and I am right here with you* |

### `oops` no longer carries its own recovery

It used to, because nothing else would: split in two, a dropped second half left the child sitting
in the bad beat. Under the mood model the recovery is **not a clip at all** — `sheepish` is where
the child sits, so `sheepish` is what has to be kind.

That is better than it sounds. A two-second scripted recovery *rushed the child through* the
moment. A warm held loop lets them take as long as they need.

Which makes **`sheepish` the most important clip in the set.** The child sits there after getting
something wrong, for as long as it takes them to go again, so whatever that loop says is what the
app says about being wrong. It is written as company, not pity: shoulders in and head down, but the
eyes up and out, holding contact, with a small kind closed smile. Never sad, never sulking, never
scolding.

### Blends, not cuts

Eddy blends **all fifteen** of its transitions over 100 ms cubic. At 60 fps that is six frames —
the same six `loopclose.py` arrived at independently for the dissolve inside a loop. So the player
blends 6 frames on every state change, with early exit on, which means an answer landing
mid-direction cuts straight into the reaction without waiting for the line to finish.

## The three blocks in front of every prompt

Identical across all six. Each one exists because a clip failed without it.

| block | holds | what happened without it |
|---|---|---|
| **IDENTITY** | the character, the face in detail, and now three NEVERs | see below |
| **MOTION** | something moves every frame, parts out of phase, **pace does not slacken at the end** | idle v3 held the home pose for its last 1.6 s of 5 s, so only 2.62 s was usable |
| **FRAME** | no camera move, same size, feet on the ground line, flat green, nothing else in frame | a clip that drifts in scale cannot be keyed against a fixed layout |

The fourth pass added three NEVERs to IDENTITY, because the model adds or breaks all three unless
told not to — and did:

* **No wings.** `yes` grew dark membranes behind the arms for the whole jump. The block listed what
  the character *has*; it never said it has no wings, and "bat-pup" plus "jump" was enough.
* **The ears never droop, flop, fold, sag or round off.** `oops` rounded them off through the wince.
* **The teeth show on every open-mouth frame.** `narrate` lost them on about half its open frames —
  an open mouth is a *smile with teeth*, never a round hole.

## What it costs from here

| | clips | credits |
|---|---|---|
| `pleased`, `sheepish` — the two new moods | 2 | 500 |
| `yes`, `oops` — regenerate to end in the mood, with the three NEVERs | 2 | 500 |
| `idle`, `narrate` — keep as generated | 0 | 0 |
| | | **1,000** |

Half of that was already owed: `yes` and `oops` need regenerating for the wings and the ears
regardless. So the **marginal cost of the whole mood architecture is 500 credits.**

`narrate` keeps its missing teeth for now. They are about 4 px at the size this plays and genuinely
invisible on the lesson screen; worth 250 only if directions ever get shown larger.

Two pose stills are needed first — `pleased.png` and `sheepish.png`, about $0.50 together on
OpenRouter, separate from credits. Both are already written into `masko_poses.mjs`.

## The pipeline each clip goes through

1. `node masko/states.mjs --print` — review the prompt
2. generate at 768P, 1:1, 5 s, `from` pinned as `startFrame` and `to` as `endFrame`
3. `loopcheck.py` — a cycle, and how much is dead?
4. `facecheck.py` — still the character? **and look at the contact sheet**
5. `loopclose.py` — loops only; keep the head, trim the tail, dissolve
6. `key.sh` — chroma key to transparent HEVC

---

## Can the mascot point at the words? Measured answer: yes

From the real screen (`ref/lesson_screen.png`, 393 x 852):

| | |
|---|---|
| mascot | 69 x 75 px at x 37–106, y 162–237 — **bigger than the 45 px assumed until now** |
| the paw that holds the stick | (102, 208) |
| narrated text block | x 163–262, y 178–217 |
| the highlighted words | x 204–290, y 177–193 |

Angles from the paw:

| to | angle above horizontal |
|---|---|
| start of line 1 | +26° |
| end of line 1 | +11° |
| start of line 2 | −8° |
| end of line 2 | −3° |
| **the highlighted words** | **+7° to +13°** |

So the whole text block sits in a **34° cone** and the words actually being read sit in the middle
of it. **A single fixed stick angle of about +10° aims at them**, and it keeps aiming at them
whatever the sentence says, because the bubble is always immediately right of the mascot at the
same height. The direction is fixed by the LAYOUT, not by the text.

### What it does not do

The stick is a quarter of the body height, so about 19 px, and the text starts 61 px away. It
**points toward** the words; it never reaches them. And one angle cannot single out one word —
that job belongs to the blue highlight already in the design.

### What it costs, and what it breaks

`narrate` currently shares `idle.png` as its home frame, and that pose holds the stick LOW. A
pointing narration needs its own pinned frame with the stick raised to +10°, which means:

* one new pose, `narrating` — about $0.14
* one clip — 250 credits
* `idle` ⇄ `narrate` stops being a hard cut and becomes the one blended transition in the set,
  6 frames, exactly as `watching` used to be

It also deliberately breaks the rule written into all six prompts last pass — *"the stick is never
raised, never lifted, never waved"*. That rule came from the reference STILLS, which are the
resting pose. The product mockup draws the mascot mid-narration with the stick up. Those are not in
conflict; they are different states, and only `narrate` is allowed the exception.

The mockup's own stick sits at roughly +35°, which points above the bubble. +10° is the angle that
lands on the words.

### Postscript: pointing cannot be done with these clips

It was built and it failed, and the failure is worth recording because it is not a prompt problem.

Four pose rolls, and the defect changed form every time: the stick came back at +64 degrees
pointing at the ceiling; pushed toward level it came back level but on a DIFFERENT character, with
bat wings, bigger ears and a long wand; described as a pure rotation of the reference it drifted
again. The pose was finally built by **rotating the rod in the still with code**
(`masko/pointstick.py`) rather than generating it — the character then matched `idle` exactly,
because nothing about the character was touched.

The clip is where it died. Measured frame by frame, the generator held the pinned +12 degrees for
the first six frames and the last sixteen and spent the 85 in between between +34 and +67 — above
the bubble for 78% of the clip. And worse than the angle: **it loses the grip.** For most of the
clip the rod floats beside the paw, unheld.

Forcing it in post did not work either. `masko/stickhold.py` erases the rod and redraws it at a
fixed angle and length from the detected grip; the grip cannot be detected stably on a moving paw,
so the redrawn rod floats too.

**The conclusion: pointing is an AIMING problem, and a baked video frame cannot aim.** Asking the
generator to hold a thin rigid prop at a given angle in a given grip for five seconds is asking for
the one thing it is worst at.

Where it belongs is the Rive rig. There the arm is a bone: it holds exactly where it is keyed, and
it can be driven from a view-model property — so it would track the actual WORD, not just the text
block. The rigged bat-pup already exists in `study_screen_animation.riv`.

And the thing that actually communicates is already in the design: **"many lions" is highlighted**.
Animate that word by word with the audio and the child's eye follows the words. The arm is
decoration next to that.

`narrate` therefore stays as it shipped — stick low, mouth correct, pinned to `idle.png`.
