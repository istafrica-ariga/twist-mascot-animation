# In-lesson reactions, the Masko way

The same brief as `DESIGN.md` — idle, thinking, correct, wrong — built as a Masko canvas instead
of a Rive state machine.

## A correction first

`DESIGN.md` called Masko's clip-boundary rule "disqualifying" for answer feedback. **That was too
strong, and it is worth fixing before deciding anything on it.**

What is true: Masko's engine schedules a move with `At::Time(u64) | End`, so a queued move waits
for the clip on screen to finish. What I under-weighted is `instant: true`, which cuts the current
clip immediately. The reaction is then **instant but hard-cut** rather than delayed.

So the real trade is not *responsive vs unresponsive*. It is:

| | Rive | Masko |
|---|---|---|
| reaction starts | immediately | immediately, with `instant: true` |
| how it starts | blends over ~70 ms | **cuts** |
| without `instant` | n/a | waits up to one idle loop |

A hard cut to a celebration is a legitimate cartoon choice — cartoons cut constantly. Whether it
reads as snappy or as a glitch is a judgement call on the actual clips, not something to settle
from the architecture.

What Masko genuinely gives that the rig would cost hand-animation: real secondary motion — cape
follow-through, squash, overshoot — generated rather than authored.

## What exists

- Mascot **Twist Hero** (`39c4d2a3-2f05-4280-b98f-0ebdc56ae7c5`) in project **Twist**, created
  2026-10-30. The identity is already set up, so poses stay on-model.
- **Credits: 0.** Nothing can be generated until some are bought.

## The canvas

Nodes are poses, edges are clips. Everything the app does is set an input and let the engine find
a path.

```
                    ┌──────────────┐
         ┌─────────►│     idle     │◄──────────┐
         │          │  (self-loop) │           │
         │          └───┬──────▲───┘           │
         │   answering  │      │ reverse       │
         │              ▼      │ (free)        │
         │          ┌──────────┴───┐           │
         │          │   thinking   │           │
         │          │  (self-loop) │           │
         │          └───┬──────┬───┘           │
         │      correct │      │ wrong         │
         │              ▼      ▼               │
   ┌─────┴─────┐   ┌─────────┐ ┌──────────┐    │
   │ celebrate │   │celebrate│ │ console  │────┘
   │   _big    │   │         │ │          │
   └───────────┘   └─────────┘ └──────────┘
        ▲ streak ≥ 5, from Any State
```

**Inputs the app sets:** `answering` (bool), `correct` (trigger), `wrong` (trigger),
`streak` (number).

Correct and wrong hang off **Any State** so they fire from idle or thinking without the app
needing to know which. That is Masko's own pattern and it is the right one here.

## What it would cost

Masko's pricing: a pose is **1 credit**; an animation is **2 credits/second** on Standard
(2–15 s) or 6 on Premium; **a reverse of an existing clip is free**; background removal is free.

| | | credits |
|---|---|---|
| 5 poses | idle, thinking, celebrate, celebrate_big, console | 5 |
| idle self-loop | 4 s | 8 |
| thinking self-loop | 4 s | 8 |
| idle → thinking | 2 s | 4 |
| idle → celebrate | 2 s | 4 |
| idle → celebrate_big | 3 s | 6 |
| idle → console | 2 s | 4 |
| thinking → celebrate | 2 s | 4 |
| thinking → console | 2 s | 4 |
| all six returns to idle | reverses of the above | **0** |
| **total** | | **≈ 47** |

At the smallest pack ($15 → 100 credits) that is about **$7 of credits**, but the minimum
purchase is **$15**, which leaves roughly half the pack for revisions — and revisions are likely,
because generated takes are not directed, they are asked for.

Premium (Seedance 2.5) would be 3× the clip cost, ≈ 131 credits. Worth knowing: the measurements
in `../MASKO.md` found Premium is the same model family that produced the morphing reference
video, so paying 3× does not buy identity — that comes from reference conditioning, which both
tiers get.

## Honest comparison

| | Rive (already built) | Masko |
|---|---|---|
| cost | done, £0 | ~$15 to start |
| reaction | blends in 70 ms | cuts, or waits |
| secondary motion | hand-authored | generated, free |
| retime / recolour | yes | no |
| size | one `.riv`, ~160 KB of vector | ~0.24 MB per clip, ~14 clips |
| art | the real vector artwork | re-generated, on-model but not identical |
| already works | **yes — verified in the runtime** | needs generating |

The Rive version is wired and verified: all five states fire, measured from the runtime's own
state-change log. That is not an argument against doing the Masko version — it is just the
baseline it would have to beat.

## Before spending anything

1. **Buy credits** — https://masko.ai/billing. Nothing here can run at 0.
2. One decision that changes the whole graph: **`instant: true` or not.** With it, reactions cut
   in immediately. Without it, a tap can wait up to one idle loop — which at a 4 s loop is far too
   long for answer feedback, so the loops would need to be 2 s, the minimum Masko allows.
3. I would generate **one edge first** — `idle → celebrate` — and look at it before committing the
   other seven. That is roughly 5 credits to find out whether the generated take is good enough,
   instead of 47.
