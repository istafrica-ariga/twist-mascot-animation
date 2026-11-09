# The idea, before any images

What the mascot *is* during a lesson decides every pose. Two coherent directions, and they do not
mix — a set built half from one and half from the other reads as an inconsistent character.

## Direction A — the study buddy (recommended)

**The mascot is sitting with the child, watching them work, reacting with them.** It is on their
side. It never judges.

- While answering, it **leans in and watches**. Not "thinking" — the *child* is thinking. The
  mascot is attentive, rooting for them.
- Right: it celebrates **with** them.
- Wrong: it **winces with them**, then picks itself up and encourages. The wince is sympathy, not
  disappointment.

The thing this buys: a wrong answer stops being a punishment. The mascot felt it too, and it is
still here. For a child learning, that is the whole difference between an app they return to and
one they avoid.

## Direction B — the performer

**The mascot does tricks when you score.** It is a reward dispenser: idle until something happens,
then a big show. More conventionally gamified, more Duolingo-like in its loudest moments.

Simpler to build and read, but the wrong-answer beat has nowhere kind to go — a performer that
stops performing just reads as disappointment.

---

## The pose set, if A

Poses correlate by sharing a **spine**: same stance, same weight, same cap angle. Only the arms,
the head tilt and the face change. That is what makes the transitions between them short and
clean, and it is the same reason Masko builds every pose off one identity.

| pose | what it is | reads as |
|---|---|---|
| `idle` | neutral, weight centred, small breath | here with you |
| `watching` | leans in a little, head tilted, eyes down toward the work | paying attention |
| `yes` | quick bounce, one paw up | nice one |
| `yes_big` | both paws up, feet off the ground, confetti | a streak |
| `oops` | ears drop, small wince, shoulders in | that one hurt |
| `go_on` | straightens, small nod, paw gesture forward | try again, I'm here |

**The beat that matters is `go_on`.** Without it a wrong answer ends on the wince and the child is
left there. With it, the mascot recovers in front of them — which is the thing being modelled.

### How they connect

```
   idle ⇄ watching
     │        │
     │        ├── right ──► yes ──────────────► idle
     │        │              └─ streak ≥ 5 ──► yes_big ──► idle
     │        │
     │        └── wrong ──► oops ──► go_on ──► idle
     │
     └── (self-loop, breathing)
```

`oops → go_on` is a **chain, not a choice** — the wince always resolves into encouragement, so the
child never sits in the bad beat.

## What already exists

The lesson Rive file already has, as finished artwork: `Breathing`, `Thinking`, `Celebration`,
`Celebration 4`, `Frustrated`, `Frustrated 2`. Mapped onto the set above:

All six takes were rendered and looked at frame by frame (`lesson/strips/`) rather than judged by
their names. Two things came out of that, and the second changes the plan.

**`Frustrated 2` is not a second wince.** It is the mascot smiling with a paw raised — a friendly
"it's okay" gesture. By name it reads as more frustration; on screen it is a recovery.

**But `Thinking` is the same pose.** It raises one paw into a wave and holds it, smiling. `Thinking`
is the move into that pose and `Frustrated 2` is the hold. Using both would show the same shape
twice and read as a bug.

So there are **four** distinct reads in the file, not six:

| needed | have | state |
|---|---|---|
| `idle` | `Breathing` | neutral, smiling |
| `yes` | `Celebration` | arms up, confetti, feet off the ground |
| `yes_big` | `Celebration 4` | arms wide, more confetti |
| `oops` | `Frustrated` | settles into a held frown |
| `go_on` | `Thinking` / `Frustrated 2` | paw raised, smiling — reads as "come on, you've got this" |
| `watching` | **nothing** | leaning in, attentive — not in the file |

`Frustrated` **holds** its frown to the end of the take, so returning straight to `Breathing` snaps
from frown to smile. Chaining it into `go_on` fixes that: the blend carries the face from frown to
smile as the paw comes up, which is exactly the recovery the idea wants.

### What this means for v1

`idle`, `yes`, `yes_big`, `oops` and `go_on` all exist. **Nothing needs drawing.**

`watching` is the only missing piece, and it is also the one that depends on a signal the app may
not have — knowing when a child is composing rather than idling. If that signal does not exist,
`watching` cannot be driven anyway, so v1 should ship without it rather than fake it on a timer.

## Open question that changes the art

**Does the mascot look at the child, or at the work?** A mascot that looks *out* at the viewer is a
companion. One that looks *down* at the question is a fellow student. Both work; they are different
characters, and the eye direction has to be consistent across all six poses.

---

# Built — step 1, verified 2026-11-05

The Reaction machine is wired into `Artboard 3` of a copy of the lesson file
(`~/Documents/lesson-reactions`; the live `lesson_screen` is untouched). Generated by
`lesson/wire_reaction.py`, which is re-runnable rather than hand-edited.

**Inputs the app sets:** `correct` (trigger), `wrong` (trigger), `streak` (number).

**States:** `idle`, `yes`, `yes_big`, `oops`, `go_on`. No `watching` in v1, for the two reasons
above: `Thinking` duplicates `go_on`'s pose, and the app may have no signal for it.

## Verified, from the runtime's own state-change log

Not read off the pixels — the Rive runtime reports each state as it enters it:

```
   10 ms   Breathing, Blink_Wait, Blink_Wait, Breathing   entry, all four layers
  680 ms   Celebration        correct + streak 1  ->  yes
 2029 ms   Breathing          returned to idle
 2613 ms   Frustrated         wrong  ->  oops
 2947 ms   Frustrated 2       THE CHAIN, with no further input
 3280 ms   Breathing          go_on -> idle
 4613 ms   Celebration 4      correct + streak 6  ->  yes_big
```

Every transition in the design fires, including the streak gate routing 1 to `yes` and 6 to
`yes_big`, and the `oops -> go_on` chain running on its own.

## Measured take lengths, and one problem they expose

| take | length |
|---|---|
| `yes` (Celebration) | 1349 ms |
| `yes_big` (Celebration 4) | ~1350 ms |
| `oops` (Frustrated) | **334 ms** |
| `go_on` (Frustrated 2) | **333 ms** |
| oops + go_on together | **667 ms** |

**The whole wrong-answer beat is half the length of the right-answer one.** `Frustrated` and
`Frustrated 2` have 20-frame work areas against the celebrations' 80. The recovery is the beat
that carries the kindness in this design, and right now it is over before it registers.

This is a timeline fix in the Rive editor, not a code one: extend the two work areas. Worth doing
before any sound is put on them, because the cues would have to be re-timed afterwards anyway.

## What this does not depend on

The costume. States, inputs and transitions are independent of what the mascot wears, so swapping
the cap for the scarf, glasses and pointer does not touch this machine.
