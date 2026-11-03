# How Masko works

Read from the integration guides, the open-source player (`masko-ai/masko-player`) and from
actually running it on 2026-10-30. Everything here is from source or docs, not marketing.

## The one-sentence model

**Masko is a state machine that switches between pre-rendered video clips.** It never draws
anything at runtime. Rive interpolates vectors frame by frame; Masko picks which already-made
video to play next. Every design decision below follows from that.

## The four layers

| Layer | What it is | Cost |
|---|---|---|
| **Identity** | a mascot = a name + `reference_asset_ids`. No rig, no geometry. Consistency comes from reusing that id + its reference images on every later call. | free |
| **Poses** | `generate_mascot_image` against the identity. Each pose is a still. | 1 credit |
| **Clips** | `animate_mascot` — image-to-video from a finished still. | 2/sec standard, 6/sec premium |
| **Canvas** | the graph that decides which clip plays when. | free to author |

## The canvas

A real state machine, stored as JSON and patched whole:

- **Nodes** are poses. Each has an `id`, an `assetId` (a completed pose image), a label and a grid position.
- **Edges** are transitions, and each edge *is a video*. Fields: `conditions`, `priority`, `speed`,
  `speedInput`, `duration`, `description` (the animation prompt), `reverse`.
- **Self-edges** (`source == target`) are the pose's own animations. The first one without conditions
  is that pose's **loop**.
- **`source: "*"`** is an Any State edge — fires from anywhere, resolved at runtime, **no video**.
- **Conditions** compare an input (`behavior::attention`, `node::nodeTime`, …) with `== != > < >= <=`.
- Updates are `PATCH` with `expected_graph_hash`; a stale hash gets `409` and your write is refused.

Inputs are driven from the app with **`set(name, value)`** (held) and **`fire(name)`** (one-shot).
The player watches nothing itself — no pointer, no clicks. Your app sends those as values.

## The engine

`masko-ai/masko-player` is a Rust engine plus thin per-platform shells (Apple, Android, web,
React Native). The engine is **1,587 lines** and its own header says it has *"no video, network or
screen"* — it is pure. You feed it time and events; it returns a list of `Command`s the shell carries out:

`ShowClip` · `ShowStill` · `Preload` · `PlaySound` · `StopSounds` · `PoseEntered` · `Interrupted` ·
`Spent` · `Error`

Two functions do the real work:

- **`hops(start, target, seen)`** — breadth-first search for the fewest moves *that have clips* from
  one pose to another. So the engine will route through intermediate poses to reach a target.
- **`best(edges)`** — highest `priority`, then **shortest clip**, then id. Fully deterministic;
  ties among equal loops are broken by a seeded roll, so playback is reproducible and testable.

## The constraint that defines it

**A move starts only when the clip on screen ends.** The `At` enum is literally `Time(u64)` or
`End`. A hover or a click can therefore wait up to one loop length before anything happens.

The escape hatch is `instant: true`, which cuts the loop — and if no transition leads to the new
pose, the mascot simply *snaps* into it. So you choose between latency and a visible jump.

This is the deepest difference from Rive, which can blend from any frame to any other at any moment.

## The economics

| Edge type | Condition | Cost |
|---|---|---|
| Loop | `source == target` | paid |
| Forward | `source != target` | paid |
| **Reverse** | reverse of a forward edge | **0 credits** |
| Any State | `source = "*"` | skipped, no video |

`(loops + forwards) × credits/sec × duration`. A reverse edge is the forward clip played backwards,
filled in automatically once the forward one completes — which is why their example canvases are
full of there-and-back pairs. **Always send `animation_model`** or it bills at the older 5/sec.

Plan first: `GET /generation-estimate` is read-only and free; `generate-all` with `dry_run: true`
returns a `plan_id` + `graph_content_hash` you must echo back to execute. A changed graph → `409`.

Worked example from their docs: 4 loops + 3 forwards, standard, 5s = **70 credits**. For scale, a
25-pose / 79-clip canvas is a serious spend.

## Delivery

`GET /v1/canvases/{id}/releases/{id}/delivery?target=web|apple|android` returns signed, expiring
links plus the canvas rules. Your **backend** fetches it with the API key and forwards it; the key
never ships in the app. The player takes a `getDelivery` callback and swaps links before they expire
without stopping the mascot.

Transparency per platform: web gets WebM + HEVC, Apple gets HEVC-with-alpha, Android gets **stacked
MP4** (colour on top, alpha matte below). `formats=av1` gives stacked AV1 — 0.24 MB vs 2.2 MB HEVC
for 5s at 720px.

⚠ **The alpha matte covers only the character.** Verified on our own render: the clouds, speed lines
and sparkles Masko generated exist in the opaque video and are cut out of the transparent one. Hand
someone the "transparent" WebM expecting effects and they get a bare character.

## Which models it actually uses

Not in the docs — the docs index (467 KB) names no provider at all. It leaks from the shipped
client config, found with REA (`analyze-web-bundle` parsed 32 of 33 chunks, 460k AST nodes) and
confirmed by reading the chunk source. Verbatim:

```js
standard: { name: "Standard", modelName: "H3 Max Turbo",
            provider: "minimax-h3-max-turbo",
            creditsPerSecond: 2, minDuration: 2,  maxDuration: 15 }
premium:  { name: "Premium",  modelName: "Seedance 2.5",
            provider: "seedance2.5-ark",
            creditsPerSecond: 6, minDuration: 4,  maxDuration: 30 }
```

- **Standard = MiniMax Hailuo H3 Max Turbo.** This is what our 8-credit launch used.
- **Premium = ByteDance Seedance 2.5**, served through **Ark** (Volcengine's model platform).

⚠ **Premium is the same model that made the reference video** (`..._Seedance_25_...mp4`), the one
that morphs the character by 2.4 s. So paying 3× for Premium does not buy a more consistent
character — the consistency we got came from reference-image conditioning, not the model.

The shipped price table, also verbatim:

```js
{ image:1, sticker:1, svg:30, interactive:9, animationPerSecond:5, logo:5, background:3,
  talkingPerSecond:2, voiceSamples:1, backgroundRemoval:0,
  cdnFreeViewsPerMonth:50000, cdnOverageCreditsPerThousandViews:1 }
```

`animationPerSecond: 5` is the legacy fallback the docs warn about when `animation_model` is omitted.

**Background removal is not determinable from the client.** `backgroundRemoval: 0` is a *price*
(free), not a provider; no matting service is named anywhere in the bundle. What the output does
tell us: the matte is a clean white-on-black silhouette of the character only, with the generated
clouds and speed lines excluded — so it is subject segmentation applied after generation, not a
chroma key and not an alpha-aware generator. That is an inference from the artefact, not evidence.

### What I checked and ruled out

Chased the hidden models four more ways; all dead ends, recorded so nobody repeats them:

- **`generate_mascot_image` has no model parameter at all.** Nor does `make_background` or
  `make_talking_animation`. Animation is the only feature offering a choice, which is exactly why
  it is the only one with client config to leak.
- **The whole bundle contains two `modelName` values and two `provider` values.** Nothing else.
  No `imageModel`, `voiceModel`, `ttsModel` or matting key exists anywhere in it.
- **`GET /v1/models` is a 404.** `GET /v1/styles` returns 200 but they are *prompt* presets
  (cartoon, flat, …), not models. `/v1/collections/{id}/variants` works and is empty.
- **The signed-in app was checked too, and shows the same thing.** Using the real signed-in Chrome
  (Claude in Chrome), `/mascots/new` loads **24 chunks, 2.0 MB**. Grepping all of them for
  `modelName` / `provider` / `model` / `engine` returns exactly: `H3 Max Turbo`,
  `Seedance 2.5`, `minimax-h3-max-turbo`, `seedance2.5-ark`, `model:"standard"`. **Nothing else.**
  No image model, no voice model, no matting service — in the authenticated app either.
- **A live network trace of the signed-in page (36 requests) never contacts a model provider.**
  Every data call is first-party: `/api/projects`, `/api/creator/status`, `/api/onboarding`,
  `/api/organizations`, `/api/collections`, `/api/collection-folders`, `/api/collections/drafts`.
  Third parties are analytics and support only: PostHog (proxied via `/ingest`), **Sentry**
  (`ingest.de.sentry.io`, EU region), **Crisp** chat, Twitter ads pixel. Media from `assets.masko.ai`.
- The ten style presets, from their preview assets: cartoon, flat, pastel-pop, kawaii, cute, pixel,
  3d, sketch, watercolor, line-art.
- **(Earlier note, superseded)** An anonymous browser only reaches the sign-in page: `/mascots/new` redirects to
  "Sign in | Masko" and the App Router exposes no build manifest (`app-build-manifest.json` → 404).
  Attaching to an already-signed-in browser is the right move, and is what REA's own docs prescribe.

So the rule is structural: **Masko only ships model identity to the client where the user picks
one.** Everything with a single fixed backend stays server-side.

### Other facts from the tool schemas

- `visual_references`, up to 4 per generation, each tagged `pose | expression | motion | prop |
  style | scene` — so references are role-typed, not just a bag of images.
- **Variants**: a mascot can hold approved alternate forms (`GET /v1/collections/{id}/variants`),
  selected per generation with `variant_id`. Conflicting variants return `409` before charging.
- **"Non-square inputs are center-cropped to square before animation."** That is why our 2000×2000
  source came back as 720×720 and why framing is not ours to control.
- Talking returns MP4 + transparent WebM + HEVC with sound + MP3 + a timed transcript, 2 credits/s,
  and `dry_run` is free.
- `make_background` is 3 credits with fixed places: `phone_screen`, `phone_header`, `square`,
  `web_hero`, `banner`.

**Infrastructure** (from asset URLs and the page): web app on **Vercel** (Next.js, `dpl_` ids),
media on **Google Cloud Storage** (`storage.googleapis.com/masco-media/`, service account
`masco-backend-sa@masco-482209.iam.gserviceaccount.com`, GCP project `masco-482209`), **Stripe**
for top-ups, **PostHog** proxied through `/ingest`, Rewardful for referrals.

**What REA could not reach.** All 11 endpoint candidates in the bundle are first-party `/api/*`
routes. The browser never contacts a model provider — every call goes through masko.ai's own Next.js
routes, which call the providers server-side. REA says this itself: *"server-side behavior may
remain unknown."* The image model, the voice model and the matting service stay hidden.

### Doing the same workflow on OpenRouter

Masko's pipeline maps onto what you already have, with exactly one gap:

| Masko step | On OpenRouter? | What to use instead |
|---|---|---|
| Identity (`reference_asset_ids`) | **yes** — pass the reference images on every call | — |
| Pose generation (1 credit) | **yes** — 10 image models, all `image,text` input | — |
| Image edit / variants | **yes** — same models | — |
| **Animate (image → video)** | **no** — OpenRouter has 0 video models | Volcengine Ark (Seedance) or MiniMax (Hailuo) direct |
| Background removal | no | locally, or skip it — see below |
| Canvas / state machine | no | **Rive** — already built at `~/Documents/twist-splash` |
| Player + delivery | no | Rive runtime |

The reference-conditioning Masko sells as "identity" is just passing the same reference images with
each prompt. Every OpenRouter image model accepts `image,text` input, so that is reproducible.

Image models and their output-token price (a generated image is roughly 1,300 output tokens, so
these are approximate per-image costs — resolution moves it):

| model | $/output token | ≈ per image |
|---|---|---|
| `google/gemini-nano-banana-2.1` | 0.00003 | ~$0.04 |
| `openai/gpt-5-image` | 0.00004 | ~$0.05 |
| `google/gemini-3.1-flash-image` (Nano Banana 2) | 0.00006 | ~$0.08 |
| `google/gemini-3-pro-image` (Nano Banana Pro) | 0.00012 | ~$0.16 |

Masko charges 1 credit ≈ $0.15 per pose, so the cheap models are roughly **4× cheaper** and the top
one is about the same.

**Measured, not estimated (2026-10-30).** One real call on `google/gemini-3-pro-image` through
`tools/orpose.mjs` — both reference stills plus the same character brief Masko got, asking for a
pose present in neither reference (celebrating, both paws up):

- **1,302 prompt tokens, 1,381 completion tokens, $0.1401, 34.6 s, 1024×1024 PNG**
- So the ~$0.16 row above is right to within a cent, and the 1,300-token rule of thumb holds.
- Two 2000×2000 reference images cost only ~1,300 prompt tokens, so conditioning is nearly free;
  the output tokens are the whole bill. Cheaper models scale down from here on the same math.

Identity held: ears, muzzle, fang placement, the heart-shaped tongue, the cape's cut and the gold
medallion all carried across, in a pose it had to invent. It drifted on two things — the eyes
became closed happy arcs rather than the open dark ovals with highlights, and it added cheek blush
the references only hint at. Both are promptable. Output is a flat PNG with no alpha, so background
removal is still a separate step, exactly as with Masko.

**The gap does not matter for Twist.** The only Masko output we could not use was the video — it is
720×720, un-retimable, un-themeable and un-drivable. Poses are the part worth having, and that part
is fully covered. So: **OpenRouter for poses + Rive for everything that moves** replaces Masko here.

### Could you skip Masko and call the models yourself?

**Not through OpenRouter.** Checked 2026-10-30 against its live catalogue:

- Masko does **not** route through OpenRouter — the string appears nowhere in either the marketing
  or the authenticated app chunks. (A `fireworks` hit was a celebration preset, not Fireworks.ai.)
- **OpenRouter hosts no video models at all.** Of its 456 models: 440 text-only, 12 image-output,
  4 text+audio, **0 video**.
- The `minimax/*` and `bytedance-seed/*` entries on OpenRouter are those companies' **LLMs**
  (minimax-m1…m3.1, seed-1.6, seed-2.x) — same brands, unrelated products. Hailuo video and
  Seedance video are not there.

To call the video models directly you would go to the provider: **Volcengine Ark** for Seedance
(the provider string `seedance2.5-ark` names it outright) or **MiniMax** for Hailuo.

**What OpenRouter could replace:** the *pose images*, which Masko charges 1 credit each for. It has
12 image-output models — Gemini 3 Pro Image, Nano Banana 2.1, GPT-5 Image and others. Since the
only part of Masko worth buying for Twist is on-model reference poses, an OpenRouter key covers that
half; it cannot cover the video half, and the video half is the part we cannot use anyway.

## What this means for Twist

Masko is good at exactly one thing we needed and bad at another.

**Good:** character identity. Our generated launch held the fur, cape, medallion and fangs on-model
across all 90 frames, where the Seedance reference morphed badly by 2.4s.

**Bad:** it is not drivable art. You cannot retime it, recolour it for the `Theme` input, reach into
it, or blend it. It is 720×720 video. Every one of the SPEC.md fail conditions — cape behind the
head, camera lock, no extra limbs — can only be *asked for*, never guaranteed.

The honest split: **Masko for reference poses, Rive for anything the app drives.** A pose costs 1
credit and gives a canonical, on-model view to fit the rig against. That is worth real money. Paying
2/sec for clips the app can't control is not, for our case.

Related: `out/launch/SPEC.md`, `~/Documents/twist-splash` (the Rive build).

## Can we run the whole Masko workflow ourselves? (checked 2026-10-30)

Yes — all four layers, and the clip layer runs on **the same two models Masko uses**, which the
media-generation MCP server in this session exposes directly.

| Masko layer | Masko's call | Ours | Status |
|---|---|---|---|
| Identity | `reference_asset_ids` | send the reference stills on every call | measured, $0.14 |
| Poses | `generate_mascot_image`, 1 credit | OpenRouter image models | measured, $0.04–0.14 |
| Clips | `animate_mascot` | **MiniMax H3 Max Turbo** / **Seedance 2.5**, same models | available |
| Player | `masko-player` | that player (MIT, Rust) or Rive | free |

**Measured clip quotes** (5 s, 9:16, one start frame, read-only `get_generation_cost`):

| model + resolution | credits |
|---|---|
| MiniMax H3 Max Turbo — 480p | 175 |
| MiniMax H3 Max Turbo — 768p | 250 |
| MiniMax H3 Max Turbo — 1080p | 500 |
| Seedance 2.5 — 720p | 2,500 |

Balance on 2026-10-30: **1,105 credits**, renewing **2026-11-05** to 80,000/month. So today that is
four clips at 768p, or two at 1080p, and **not one** Seedance 2.5 clip. After the renewal it is ~320
clips a month at 768p — effectively unlimited for this project. **Waiting six days is worth more
than any saving we could engineer now.**

**Two things here beat Masko's own API:**

1. **`end_frame`.** Both models take a start frame *and* an end frame. `animate_mascot` only takes
   `source_image_asset_id`. A canvas edge is by definition pose A → pose B, so Masko makes you
   generate a clip and hope it lands on the next pose; here we can pin both ends. This is the single
   biggest gap in Masko's design and we do not have it.
2. **Resolution and aspect.** 1080p and true 9:16, against Masko's 720×720 square. Our splash is
   1080×1920, so Masko's output needed upscaling before it could even be composited.

**But the splash should still not be generated video.** Already measured in `out/launch/SPEC.md`:
the spec calls for takeoff at 0.25–0.55 s; the Seedance reference put it at ~1.25 s, **0.9 s late**,
and travelled 23pp against the rig's 67.5pp. Generated video cannot be retimed, so a written beat
sheet is the one thing it cannot satisfy. Nothing about having better models changes that — they are
the same models that missed.

**Where this workflow does win: the interactive mascot.** Idle, wave, celebrate, think, sleep —
states where exact frame timing does not matter and personality does, and where the state machine is
the actual product. That is what Masko was built for, and we can now build it with better inputs
than Masko offers.
