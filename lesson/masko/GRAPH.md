# Lesson reactions — the clip set

Replaces the edge graph that was here before. The graph was Masko's model: poses are nodes, clips
are edges between them. Watching the first edge play back showed why that is the wrong model for
this app, and the fix removes most of the machinery rather than adding to it.

## Why the edge model was wrong

An edge runs from pose A to pose B, so it **ends standing in pose B**. `idle → yes` finishes with
the mascot's arm in the air, and it stays there until something plays a second clip to bring it
down. Every reaction needs a partner, the player has to know which partner, and if anything drops
a clip the mascot is stranded in a pose it should only have passed through.

## The model now: every clip closes on itself

**The first and last frame of every clip are the same drawing.** The generator takes `startFrame`
and `endFrame`, so this is free to ask for — pass the same pose to both.

Everything follows from it:

* A reaction always comes back. It cannot end anywhere but home.
* A loop is seamless by construction, not by crossfading.
* There are no edges, so there is no graph and nothing to author per transition.
* `oops` and `go_on` become **one clip**, so the recovery cannot be skipped or interrupted. That
  was the beat carrying the whole idea in `IDEA.md`, and it no longer depends on the player
  chaining two things correctly.

The player reduces to: hold a loop, and on an event play a one-shot and resume the loop. That is
small enough either way that choosing between `masko-player` and our own stops mattering.

## The six clips

| state | app fires it | kind | built from | credits |
|---|---|---|---|---|
| `idle` | default | loop | start = end = `idle`, breathing bounce | 250 |
| `narrate` | mascot speaks | loop | start = end = `narrate`, mouth cycle | 250 |
| `watching` | child is answering | loop | start = end = `watching` | 250 |
| `yes` | correct | one-shot | existing `idle → yes`, reversed and appended | **0** |
| `yes_big` | streak | one-shot | start = end = `idle`, jump and land | 250 |
| `oops` | wrong | one-shot | start = end = `idle`, wince then recover | 250 |

**1,250 credits** of the 79,750 left on the plan — about 1.6% of one month.

### Two ways to make a round trip, and when each is right

* **Reverse it.** Free, and the loop closes perfectly because the last frame *is* the first frame.
  But the return is the departure played backwards, so the easing runs the wrong way. Fine for a
  quick bounce like `yes`; wrong for `yes_big`, where it would read as un-landing from a jump.
* **Generate the whole arc** with `startFrame` = `endFrame` = `idle`. The physics are right in both
  directions, but nothing pins the peak, so the model decides what the celebration looks like.

So `yes` is reversed and the rest are generated whole.

## Narration

Narration runs as long as the sentence does, so the `narrate` clip has to **tile** — play end to
end against itself indefinitely without a visible seam. Same-frame construction gives that if the
model returns a true cycle.

If it drifts instead, the fallback is a mouth-only sprite swap: a handful of mouth shapes composited
over a still body, driven by the audio envelope. Cheap, completely controllable, and it is what
Masko's own talking animation does underneath.

## Proven — `idle`, 250 credits

Same-frame construction returns a **real cycle**, not a drift-and-snap. Measured by
`masko/loopcheck.py`, which tracks each frame's distance from frame 0 and the step between
consecutive frames:

| | |
|---|---|
| distance from frame 0 at the last frame | **5% of peak** |
| step onto the last frame | **0.4x** the median step |

A drift-and-snap would show the opposite on both counts — still far from home at the end, and a
hard spike on the final frame as the model jumps back to the pinned frame. Neither is there, so
the clip can be looped end to end with no crossfade and no seam.

**A loop is never trimmed.** Trimming is for one-shots, where the performance finishes early and
leaves a dead hold; cutting a loop short just breaks the cycle. The whole 5.17 s is the loop.

Keyed to alpha at **1,079 KB** for 5.17 s, 71% of the frame clear.

## Fixed in this pass

* **Teeth.** Four of the five original poses had pointed vampire fangs. The cause was one word in
  the pose prompt — it said "two small white fangs" — against a reference that has two blunt
  rounded tiles hanging from the upper lip. The shape is now spelled out in `TEETH` and the wrong
  reading is named and forbidden.
* **The stick.** It used to float unheld beside the paw. The cause was direction, not grip: asked
  for a stick "pointing down at its side" the generator draws it lying across the body with the paw
  nowhere near it, and asked for one angled up it closes the paw around it every time. Every pose
  now keeps it above the horizontal, and it is gripped in all seven.
* **`watching`.** First roll laid the head over sideways and turned the body, breaking the shared
  spine the whole set depends on. Re-rolled square-on with the eyes doing the looking.
* **`normalise.py`** chose between padding and cropping by sign, which broke on the first pose that
  needed padding on one axis and cropping on the other. It now pads wide and crops back.

---

# What `idle` means

Worth settling before the clip, because it decides every choice in it.

On the lesson screen the mascot sits top-left beside a speech bubble, roughly **45 x 80 px**, and
it has just asked the question. The child is counting lions and choosing between 4 and 6. So idle
is not "waiting to be used" — it is **I have asked, and I am here while you work it out.**

Two things follow, and they pull against each other:

* It must never look **frozen**, or the app looks broken.
* It must never **compete** with the lions and the answer buttons, because the child needs those.

So: continuous motion, low amplitude. Something is always moving, nothing is ever loud. A big
gesture every few seconds with stillness between is the worst of both — it reads as a stutter, and
it pulls the eye exactly when the child is counting.

The first `idle` failed this. It was two gestures with stillness between — measured dead time
**80% of frames barely moving**, which at 45 px reads as frozen rather than resting.

The rebuilt one holds continuous overlapping motion instead: head turning, stick swaying, scarf
trailing, mouth and glint moving under it, with the parts deliberately out of phase so no single
beat dominates.

| | first | rebuilt |
|---|---|---|
| dead time | 80% | **11%** |
| median step between frames | 0.16 | **1.45** |
| distance from frame 0 at the end | 5% of peak | 6% of peak |
| verdict | cycle | **cycle** |

Nine times the motion, still closing cleanly on its own first frame. Keyed to alpha at 1,589 KB.

## What reads at 45 px

Fine detail is wasted at this size; silhouette is everything. Roughly in order of how much each
contributes at the size it is actually used:

| moves | why it reads |
|---|---|
| the pointer stick | long lever, the tip travels furthest of anything |
| the scarf ends | break the outline, and they trail behind the body |
| head turn | changes the silhouette itself |
| the free arm | changes the silhouette |
| body rise and fall | moves the whole shape |
| mouth | ~4 px — barely |
| the glint on the glasses | ~3 px — invisible here |

The glint is in the clip anyway. It costs nothing, and it matters wherever the mascot is shown
larger. But it is not what makes this idle work, and it should not be what the motion is built
around.

## One thing the idle can do for the lesson

A glance **down toward the work** points the child at the question without a word. A mascot that
looks at the thing you are meant to look at is doing something; one that only looks out at you is
decoration. Worth one beat in every cycle.

---

# Closing the loop

Matching the end pose to the start pose is necessary but **not sufficient**, and the gap between
those two is what "it kinda doesn't loop" turned out to be.

The model eases INTO the pinned end frame and OUT of the pinned start frame, so the velocity goes
to zero at both ends even though the position is right. Measured on the rebuilt idle:

| frames | step per frame | against a median of 1.46 |
|---|---|---|
| 116-123 (the end) | 0.08, 0.05, 0.12, 0.34, 0.25, 0.08, 0.09, 0.10 | a dead stop |
| 1-3 (the start) | 0.23, 0.26, 0.71 | crawling off the line |

Played on repeat that is a third of a second of stillness straddling the join. The loop is
seamless in position and visibly stops in motion.

`masko/loopclose.py` fixes it: drop the stalled frames at both ends, then dissolve what is left of
the tail over the head. Writing the kept frames as `source[a..b]` and the overlap as `K`:

    out[i] = source[a + i]                                     for i >= K
    out[i] = lerp(source[a + L + i], source[a + i], i / K)      for i <  K

`out[L-1]` is `source[a+L-1]` and `out[0]` begins as `source[a+L]` — **two consecutive frames of
the original**, so the motion runs straight through the join instead of being cut across it.

## Two things pull against each other

Sliding the trim end moves the join to a different moment, and the first instinct — put it where
the motion is liveliest — is wrong on its own, because the dissolve also has to blend the head
against the tail, and those must be similar poses or it ghosts:

| trim end | join step | ghosting | |
|---|---|---|---|
| 97 | 2.39 | **7.51** | liveliest join, worst ghost |
| 104 | 1.19 | 4.11 | |
| 112 | **0.30** | 5.76 | still hesitates |
| **106** (chosen) | **1.47** | **3.50** | |

So the score is liveliness over ghosting, and the search beats every candidate picked by hand.
The join now steps **0.9x the median** — ordinary motion, neither a pause nor a jerk.

## What it costs

**3.96 s, down from 5.17 s.** The eased ends are not usable material and trimming them is the
whole point. If a longer loop is wanted later, the fix is to generate longer and trim to length,
not to keep the stalled frames.

Keyed to alpha at **1,177 KB**.

---

# Measuring motion is not the same as looking

`loopcheck.py` and `loopclose.py` both passed cleanly on an idle whose mouth had become a dark
gaping hole for the entire clip and whose two blunt teeth had vanished. Nothing was wrong with the
motion. The character had simply stopped being the character, and no amount of measuring step
sizes was ever going to say so.

The cause was in the prompt: it asked for "the mouth opens and closes softly once or twice", and
the model held the mouth open for the whole clip. The `TEETH` rule that fixed the poses lives in
`masko_poses.mjs` and was never carried into the video prompt, so nothing protected the face once
it started moving.

`masko/facecheck.py` now measures identity rather than motion — it crops the head from each frame,
lines it up against the head in the source pose, and writes a contact sheet of the worst offenders
beside the source. The sheet is the point. The number only decides which frames to put on it.

## The trade-off this exposed

Protecting the face cost the motion:

| | median step | dead time | face |
|---|---|---|---|
| v2 — motion prompt | **1.46** | **11%** | mouth a gaping O, no teeth, startled |
| v3 — face locked | 0.32 | 54% | **correct throughout** |

v3's prompt put its weight on what must NOT change and the model became conservative everywhere —
it holds the home pose for the last 1.6 s. Its usable loop closes at only 2.62 s with ghosting of
7.05, against v2's 3.96 s at 3.50.

Neither is shippable. The next prompt has to hold the face lock from v3 **and** restate the
continuous-motion requirement from v2 with equal force, including an explicit instruction that the
pace does not slacken toward the end — which is where v3 dies.

---

# The fourth pass — all four clips generated

`idle`, `narrate`, `yes`, `oops`, one home frame (`idle.png`), 1,000 credits. Every clip returned a
true cycle on the first attempt, which the previous three passes never managed.

| clip | cycle | median step | dead time | closed to | ghosting | join |
|---|---|---|---|---|---|---|
| `idle` | yes | 0.45 | 54% | **4.42 s** | 1.27 | 1.3x median |
| `narrate` | yes | 1.18 | 50% | **3.88 s** | 3.09 | 0.5x median |
| `yes` | yes | 0.41 | 82% | trimmed to 3.0 s | — | — |
| `oops` | yes | 0.19 | 84% | trimmed to 4.1 s | — | — |

Dead time reads high on the one-shots because it is measured against the clip's PEAK step and a
jump peaks hard — everything either side of it looks asleep by comparison. On a one-shot the number
means little; the frame grid is what settles it, and both performances run to the end.

**The motion fix worked.** Naming the ENDING specifically — "the final second must be exactly as
alive as the first" — is what the third idle was missing. Its last 1.6 s was one pose repeated and
only 2.62 s survived. This one varies to the last frame and closes at 4.42 s.

## Keeping the head is worth an order of magnitude

`loopclose.py` used to walk in from BOTH ends to the first frame that was genuinely moving. That is
wrong, and it is the one thing that made this set look unloopable at first.

The eased-in opening frames **are** the home pose, and the home pose is exactly what the tail has to
be dissolved against. Trim them and frame `a` becomes the start of a gesture, so the blend mixes a
head turn with a settled stand. Measured on this idle, same clip, same everything else:

| `a` | ghosting |
|---|---|
| **0** | **0.88 – 1.86** |
| 7 | 7.27 – 8.46 |

Only the tail is dead weight, because by then the motion has already come home and is sitting
there. The search now fixes `a` at 0 and hunts the trim end and the overlap together.

Its scoring changed too. Liveliness over ghosting picks a join that moves hard and smears hard with
it — narrate's best ratio ghosted at 4.98. It now **requires** the join to clear 60% of the median
step and takes the least ghosting among whatever qualifies.

The `LIVE` threshold also stopped being purely peak-based. This idle peaks at 5.38 against a median
of 0.45, so `peak * 0.30` came to 1.61 — three and a half times the clip's ordinary motion, which
declared everything but the gestures dead. It is now `min(peak * 0.30, median * 0.6)`.

## What is wrong with the clips

Three defects, found by looking at the contact sheets and grids, not by the numbers.

* **`narrate` loses the teeth on the wide-open mouth frames.** Roughly half the open frames are a
  round "O" with the tongue and no teeth; the other half are an open smile with both teeth correct.
  The prompt says they "STAY ATTACHED to the upper lip and remain visible" and the model half
  complied. Milder than the second idle, where the mouth was a dark hole for the whole clip and the
  expression was wrong — here the expression stays cheerful and it returns to the closed smile.
* **`yes` invented bat wings.** Dark membranes appear behind the arms for the whole jump. The
  reference has plain rounded arms. The IDENTITY block lists what the character HAS; it never says
  it has no wings, and "bat-pup" plus "jump" was apparently enough.
* **`oops` lets the ears go floppy.** They droop and round off through the wince, losing the pointed
  triangular shape — the exact failure the prompt names and forbids, in the words that fixed it in
  the still pose.

The face itself is correct in all four: blunt teeth, glasses level, glint present, warm expression,
no dark hole. `yes` is the best of them — wide open cheering with both teeth clearly along the
upper lip.

**The invented ground shadow under the jump keys out cleanly.** It was worth checking, since a dark
ellipse would have left a hole, but nothing survives on the purple.

## What a fifth pass would fix

All three defects are additions or distortions the prompt never explicitly forbade, so each is one
more NEVER in the IDENTITY block rather than a rethink:

* no wings, no membranes, no cape — the arms are plain and rounded
* the ears NEVER droop, flop or round off, in any pose, at any point, including while wincing
* the teeth stay visible on EVERY open-mouth frame; an open mouth is a smile with teeth along the
  upper lip, never a round hole

That is 1,000 credits to regenerate all four, or 500 for just `yes` and `oops`, whose defects are
the ones that read at size — a wing changes the silhouette and a drooping ear changes the head
outline, while the teeth are about 4 px.

---

# The fifth pass — six clips, moods, and the three notes

`idle`, `narrate`, `yes`, `oops`, `pleased`, `sheepish`. 1,500 credits. Every loop a true cycle,
both one-shots landing where they should.

## The three notes

* **Teeth, open and closed.** The rule used to describe the closed mouth only, so the model drew
  whatever it liked once the mouth opened — in the fourth `narrate` about half the open frames were
  a plain round hole with no teeth. It now says the teeth are *fixed to the upper lip* and the
  mouth **opens BELOW them**, same size, same spacing, same place, and that the mouth must look
  like the SAME mouth in both states. Every open frame in this `narrate` and this `yes` has both
  blunt teeth along the upper lip.
* **The stick looked unnatural.** Every pose had it angled up and out, which reads as a FLAGPOLE —
  carrying a banner, not holding a pointer. The fix was not to point it down again: asked for a
  stick "pointing down at its side" the generator draws it lying across the body with the paw
  nowhere near it, which is what forced the upward angle in the first place. The fix is to give the
  stick a REASON to be where it is — **resting its tip on the ground**, the way anyone stands
  holding a long stick. The paw still closes around it and it stops sticking out.
* **Nothing gets added.** The scarf is the only loose part on the character, so it is the only
  thing that may move that way. The `ADD NOTHING` block now forbids wings, membranes, capes, second
  scarves, anything behind the arms or back, the invented belly patch, and any part growing or
  changing proportion. The wings are gone from `yes`; the ears no longer droop in `oops`.

## The numbers

| clip | kind | cycle | closed to | ghosting | join |
|---|---|---|---|---|---|
| `idle` | loop | yes | 3.88 s | **0.77** | 1.0x median |
| `narrate` | loop | yes | 4.21 s | 2.55 | 1.5x median |
| `pleased` | loop | yes | 4.33 s | 2.82 | 1.2x median |
| `sheepish` | loop | yes | 3.96 s | 1.45 | 0.7x median |
| `yes` | one-shot | n/a | trimmed to 3.6 s | — | — |
| `oops` | one-shot | n/a | trimmed to 3.6 s | — | — |

`idle` ghosting at 0.77 is the cleanest join of any pass. `pleased` runs a median step of 3.95 —
by far the liveliest clip in the set, which is right for a bounce — and `sheepish` runs 0.73, the
calmest, which is also right.

## `loopcheck.py` cannot judge a one-shot any more

It measures every frame against frame 0 and calls a clip a CYCLE when it returns home, so a
reaction that deliberately ends SOMEWHERE ELSE now reports **SNAP**. That verdict is meaningless
under the mood model: landing away from home is the whole point.

`masko/endcheck.py` answers the question that replaced it — does the last frame match the pose the
destination loop begins on? Compare it to the target, and to the start pose as a control:

| clip | last frame vs target | vs `idle` (control) | first frame vs `idle` |
|---|---|---|---|
| `yes` | **3.91** (`pleased`) | 16.68 | 4.44 |
| `oops` | **4.06** (`sheepish`) | 16.96 | 4.30 |

Both land four times closer to their mood than to home, and **as tightly as they start** — 3.91
against a 4.44 opening, 4.06 against 4.30. So the player can cut straight from the reaction into
the mood loop with nothing to blend, which is what the whole architecture rests on. Checked by eye
across both joins as well: the proud smile carries through `yes` into `pleased`, and the frown
softens into the kind smile right across `oops` into `sheepish`.

Both one-shots settle into their mood pose at about 3.5 s of 5.17 s, so both are trimmed to 3.6 s —
the rest is the destination loop's job.

## Still honest about

`sheepish` reads as **attentive**, not as sorry. Ears swept back, eyes up and out, paw open and
patient — warm, never sulking, and it holds without becoming annoying, which was the brief for a
held mood. But the character has no neck and no shoulders, so it cannot hunch, and every
conventional cue for sad was ruled out as off-model. The ear sweep carries it at size and the
motion carries the rest.

---

# The stick was never a direction problem. It was a SIZE problem.

Two references arrived after the fifth pass — `ref/mouth_open.png` and `ref/mouth_closed.png` —
and measuring the stick off them says every pass so far drew it far too big:

| | measured |
|---|---|
| length | **25% of the character's height** — about one arm |
| angle | about 30 degrees off vertical, leaning down and away |
| where the paw grips | **80% down the body** — low, at hip level |
| where the tip reaches | 101% — just touching the ground beside the foot |

Earlier passes kept forcing it upward because a stick asked to "point down at its side" gets
dropped: the generator draws it lying across the body with the paw nowhere near it. That was read
as a direction problem and it never was. **A short rod gripped low needs no upward angle to read as
held** — the length was what made every version look like a flagpole, first angled out and then
standing vertical.

## And the inside of the mouth is not red

The prompt said "a warm dark red inside". Sampled off the reference it is **dark purple, about
#32085A, with a pink #F06E8C tongue**. Stating red pushed every open mouth away from the character,
which is part of why the teeth kept going with it.

The mouth rule now describes both states from the references: closed is a single dark smile line
with the two blunt teeth just below it, open is a wide dark-purple cavity with the heart tongue in
the bottom and **the same two teeth hanging from the top edge** — the mouth opens BELOW them.

## Three references need a stated precedence

Passing all three at once pulled the character off-model on two of three poses: `idle` came back
grey with wolf ears, `pleased` came back with a belly patch, a striped scarf and a wing. The two
new references are drawn a little differently from `approved.png` and the model averaged them.

The prompt now says which image wins: **the first image IS the character** — proportions, colour,
ears, fur, scarf, glasses — and the other two are included **for the mouth and the stick only**,
with everything else explicitly not to be taken from them. That fixed it in one roll.

A fourth roll was needed for pink inner ears, so `ADD NOTHING` now also pins the inner ear to the
body colour.

## The eye cannot show where it is looking

The reference eye is ONE solid dark almond with ONE small white dot near its upper inner corner.
No sclera, no white of the eye, no iris, no ring. The pale diagonal streak belongs to the glasses.

That single fact explains most of what went wrong with `sheepish`. Asked for eyes that "look UP and
OUT at the viewer from under the brows", the generator did the only thing that reads as looking up:
it put a white sclera in and floated the pupil at the top of it. Big glossy anime eyes, off-model
in one stroke. Taking the gaze back out swung it the other way — the whole head bowed to the floor
and eyebrows appeared.

So the rule is now explicit in both files: **the eye has no white in it, therefore it cannot show a
direction of gaze, and the HEAD does the looking.** Every "the eyes look X" line in every
performance became "the face aims X". A blink closes to a curved line; a happy squeeze curves
upward; neither ever shows white.

## Describe a difference, not a mood

Seven rolls went into `sheepish` across two passes, and every one that tried to say what the mood
FELT like broke something: sitting on the floor, folded ears, puppy eyes, a bowed head, eyebrows.

It is now defined as **the reference plus three changes and nothing else** — ears swept back thirty
degrees as one rigid piece, the free paw out low with the pad turned up, the shoulders drawn in
slightly — with the head explicitly staying level and front-facing. The mood is carried by the
ears, the paw and, in the clip, by slow heavy motion. Not by the face. That held on the first roll.

# Pass six — the corrections landed, with one clip out of step

| clip | cycle | closed to | join | stick |
|---|---|---|---|---|
| `idle` | yes | 3.67 s | 0.8x median | low, tip on the ground |
| `narrate` | yes | 3.71 s | 0.5x median | low, tip on the ground |
| `pleased` | yes | 4.58 s | 0.8x median | low, tip on the ground |
| `sheepish` | yes | 3.00 s | 0.5x median | **raised to 45 degrees — wrong** |
| `yes` | one-shot | trimmed to 3.7 s | lands on `pleased` 4.22 | low |
| `oops` | one-shot | trimmed to 3.6 s | lands on `sheepish` 3.91 | low |

**The mouth fix worked.** Every open frame of `narrate` has both blunt teeth on the upper lip, the
pink tongue in the bottom and a DARK PURPLE interior. Naming #32085A instead of "warm dark red" is
what did it — the teeth had been going out with the wrong colour.

**The eye fix worked.** No white of the eye anywhere in any of the six, including the clip that
grew a sclera last time. Blinks close to a curved line; the happy squeeze in `pleased` and `yes`
curves upward and shows no white.

**`sheepish` holds its stick up.** Short, gripped, correct length — but raised to about forty-five
degrees with the tip above the shoulder for the whole clip, where the other five hold it low with
the tip on the ground. It inherited this from the sheepish POSE, which had the same drift and was
let through. Everything else in the clip is correct.

Fixing it is one pose roll plus one clip: $0.14 and 250 credits.

# The teeth fuse, and prompting cannot stop it

The failure was the opposite of what the earlier passes assumed. The teeth were not going MISSING
from the open mouth — they were **fusing into a single wide white band** across it, a plain toothy
grin with no cavity and no tongue. On a talking clip that happens on roughly one frame in six,
clustered in short runs.

Naming it precisely did almost nothing:

| | fused-band frames |
|---|---|
| pass six, "two blunt teeth" | 20% |
| pass seven, plus "never a band, never a row, never a grin, never a single wide white shape" | **15%** |

500 credits to move it five points. It is a drawing habit, not a misunderstanding, and a third roll
would have been a third guess.

## So measure it and fix it after the fact

In a correct open mouth the white is TWO small blobs with dark cavity between them. In a broken one
it is a single wide blob. `masko/mouthcheck.py` scans each row of the mouth region, finds the
widest continuous white run, and flags the frame when that run exceeds 42% of the mouth's width.

`masko/mouthfix.py` then swaps each flagged frame for the NEAREST unflagged one, before or after,
whichever is closer. On this clip that was 18 frames in 7 runs, and because each run takes from
both sides the longest hold is two frames — about a twelfth of a second, in a mouth that is moving
anyway.

That is frame substitution, and it is the same move the Eddy Interactions file makes with its smear
frames: swap the artwork for a few frames and nobody sees the swap. Result: **0 of 106 frames fused**,
at no credit cost, and unlike a re-roll it is certain.

The remaining `narrate.mov` is 4.42 s, join 1.3x median, 707 KB.

# Pointing works. I was wrong twice, and the fix was in the grip.

The user supplied a drawing of the mascot pointing, and measuring it corrected two things I had
asserted.

**The angle is +63 degrees, not +10.** I derived +10 from the screen geometry by assuming the rod
should aim along the sight-line to the text. Their drawing treats it as a GESTURE toward the text,
which is the design call. The very first generated pose came back at +64 and I rejected it as too
steep. It was right.

**The grip swaps ends.** At rest the paw holds the TOP of the rod and it hangs down to the ground.
Pointing, the paw holds the BOTTOM and the rod rises. Every prompt I wrote said "gripped at its top
end" even in the pointing pose — geometrically impossible for an upward rod, which is why the hand
kept losing it. That single word is what made the stick float.

**And the stick was supposed to MOVE.** I had been locking it still, and fighting the generator for
it. Asked instead for the hand to WORK the stick — short taps, a small sweep, as if indicating the
words — it holds the grip in every frame and the angle stays inside a **7 degree band across all
124 frames**. Locking it produced a floating rod for 78% of a clip; letting it move produced a
steady one.

| | locked still | hand working it |
|---|---|---|
| grip held | lost for most of the clip | **every frame** |
| angle spread | +12 to +67 | **7 degrees** |
| fused teeth | — | **0%** |

## A loop-close fix came out of it

With a moving prop the old scoring broke. It used "is the join frame moving?" as a proxy for "will
this read as a hesitation", with a floor each candidate had to clear — and on this clip the best
wrap sits near the end where motion has calmed, fails the floor, and the search settled on a
candidate wrapping at **3.2x the median** instead of 0.7x. It also never tried a 4-frame overlap,
which is the one a moving prop wants: a 6- or 8-frame blend has to reconcile two stick positions.

The wrap step is not a proxy for the jump. **It IS the jump** — the distance from the last output
frame back to the first. The search now minimises it directly, plus the ghosting it costs.

Every loop in the set improved:

| clip | join before | join after | length |
|---|---|---|---|
| `idle` | 0.8x median | **0.5x** | 5.00 s |
| `narrate` | 3.2x (STILL JUMPS) | **0.4x** | 5.00 s |
| `pleased` | 0.8x | **0.1x** | 5.00 s |
| `sheepish` | 0.5x | **0.4x** | 4.29 s |
