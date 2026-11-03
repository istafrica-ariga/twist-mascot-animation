# The real brief (the prompt behind the reference video)

Kept verbatim as the authority for the launch animation. The reference video is one
*interpretation* of this, not the spec itself — measured, it misses the timing badly (see below).

## Measured: spec vs what the video actually did

| Beat | Spec says | Reference video does |
|---|---|---|
| empty hold | ~0.10 s | ~0.20 s |
| takeoff | 0.25–0.55 | **~1.25** |
| ascent done | 0.95 | ~1.40 |
| settled | 1.35–1.60 | ~2.10 |
| travel | enters from below the frame | enters at 84 % down, ends at 20 % — **65 pp** |

Masko, for comparison, travelled **23 pp** and never entered or left frame: its centre goes
49 % → 56 % (crouch) → 33 % (hover). It was never told to start off-screen, which is the
single instruction that produces the launch read.

## What the rig must honour that a video model can only be asked for

Layer order, cape-behind-everything, camera lock, no depth rotation, no extra limbs,
character design unchanged. In a layered vector rig these are structural, not requests.

---

GLOBAL STYLE Create one continuous 4-second vertical 2D mobile splash-screen animation for the Twist learning app. Use the supplied Twist superhero mascot reference as the exact character design. Use the supplied finished Twist splash screen as the target final composition. Use the supplied motion reference only for animation rhythm: fast anticipation, energetic launch, bold simple vector effects, overshoot, follow-through and playful settling. Preserve the Twist artwork exactly. This must behave like a 2D Rive character rig, not a 3D character.

ABSOLUTE CAMERA LOCK The camera remains completely stationary for the entire clip. No zoom. No pan. No tilt. No shake. No perspective change. The purple gradient background stays completely stationary. Motion comes only from the mascot and simple graphic effects.

ABSOLUTE CHARACTER ORIENTATION LOCK The mascot faces directly toward the viewer for the entire animation. Head remains front-facing. Chest remains front-facing. Both eyes remain visible. Both ears remain visible. Do not rotate the mascot in depth. No side view. No 3/4 view. No perspective foreshortening. Treat the character as a flat layered 2D puppet.

CRITICAL CAPE LAYER RULE The red superhero cape is physically attached to the mascot at the neck and shoulders for every frame. The cape must NEVER appear independently from the mascot. The cape must NEVER enter the frame before the mascot. The cape must NEVER detach from the gold clasp or shoulders. The cape must NEVER move in front of the mascot's face. The cape must NEVER cover the eyes. The cape must NEVER cover the mouth. The cape must NEVER pass over the mascot's head or ears. The cape must NEVER become a parachute, umbrella, canopy or floating red object. The cape must remain BEHIND the head, torso, arms and legs at all times. Imagine the cape as one flat Rive mesh positioned one layer behind the entire mascot. Its top edge is pinned permanently to the shoulders. Only the lower half and outer corners may deform. Cape movement is limited to simple trailing, stretching, widening and one soft wave.

FIRST FRAME — 0.00s Show only the clean purple gradient background. No mascot. No cape. No Twist logo. No POWERED BY IST text. Hold this empty frame for only about 0.10 seconds. The mascot is conceptually standing immediately below the visible screen.

0.10–0.25s — HIDDEN ANTICIPATION The mascot is still mostly below the screen. It compresses before jumping. Both knees bend slightly. Torso lowers approximately 6%. Body widens approximately 2%. Hero arm bends slightly in preparation. Other arm bends close to the torso. Cape stays attached behind the shoulders and is also below the screen with the body. No part of the cape may become visible before the mascot.

0.25–0.55s — SUPERHERO TAKEOFF The mascot suddenly shoots upward into the frame. Strong upward acceleration. The mascot remains completely upright and front-facing. The body moves first. One arm rapidly extends upward into the superhero fist pose. Shoulder rotates upward. Elbow extends but retains a tiny bend. The fist stays visible from the front. The opposite arm remains bent close to the torso and reacts with only a small delayed movement.

LEGS DURING TAKEOFF Both legs initially extend slightly downward as the character leaves the ground. Then both legs trail beneath the torso. One leg may trail 2–3 pixels lower than the other for natural asymmetry. Do not kick. Do not cross the legs. Do not rotate the hips. Feet remain front-facing.

HEAD DURING TAKEOFF Head remains centered over the torso. No head rotation. No head tilt. During the acceleration, allow the head to lag behind the torso only 1–2 pixels, then catch up. Preserve the exact facial expression.

TORSO DURING TAKEOFF At maximum acceleration, vertically stretch the torso and full character approximately 4%. Immediately return to normal proportions. Never change the silhouette dramatically.

CAPE DURING TAKEOFF This is extremely important. The cape remains behind the mascot. The shoulders and clasp move upward with the body immediately. The bottom edge of the cape reacts approximately 2–3 frames later because of inertia. This creates a gentle downward stretch. The cape widens slightly left and right. The outer corners trail BELOW the shoulders. They do not rise above the ears. They do not fold over the head. They do not cross in front of the body. Shape progression: neutral cape → slightly stretched downward → wider outward → one gentle trailing curve. Think of only 3–5 deformation points.

TAKEOFF EFFECT At approximately 0.30 seconds, create one playful vector burst beneath the mascot. Use four soft rounded lavender cloud puffs. Two expand left and right. Two remain closer to the center. They expand quickly and disappear within about 0.30 seconds. Add three short tapered vertical lavender streaks beneath the mascot. The streaks move downward while the mascot moves upward. Add one or two tiny four-point sparkles. Keep everything graphic and simple. No realistic smoke. No giant white beam. No rocket flame. No explosion.

0.55–0.95s — FAST ASCENT The mascot travels quickly toward the center of the screen. Hero fist remains raised. Other arm remains bent. Torso is back at normal proportions. Legs trail underneath. Head remains stable. Character stays centered horizontally. Add 2–3 long lavender motion streaks travelling downward behind the mascot. Place streaks mainly around the outside of the silhouette. Do not place them across the face.

CAPE DURING FAST ASCENT Cape remains behind the character. Airflow pushes it slightly downward and outward. Left and right cape corners form a broad shallow V behind the body. The cape should look like it is being dragged by the air. It must NEVER stand vertically above the mascot. It must NEVER form a rectangle above the head. It must NEVER behave like a parachute. One small broad wave may travel through it: left corner lifts slightly → center follows → right corner follows → return. Maximum deformation should remain subtle.

0.95–1.15s — DECELERATION As the mascot reaches its final area, reduce upward speed strongly. The torso slows first. The hero arm continues upward only a tiny amount because of inertia and then settles. The bent arm rises 1–2 pixels and settles. Both legs swing upward approximately 2–3 pixels because the torso slowed before them, then fall back.

CAPE DURING DECELERATION Because the body slows first, the cape briefly continues its movement. The lower cape rises slightly behind the mascot. It still remains below shoulder level and behind the body. Then it drops back down. Cape motion: rise slightly → one soft downward wave → tiny rebound → settle. Again: cape never passes the head.

1.15–1.35s — OVERSHOOT Mascot travels approximately 10–15 pixels above the intended final position. Pause very briefly. Then move approximately 10–15 pixels back downward. Only one overshoot. No repeated bouncing.

1.35–1.60s — SETTLE The body reaches its final central flying position. Torso settles first. Head follows one frame later. Hero arm follows one frame later. Legs settle after the torso. Cape settles last. Do not stop all body parts simultaneously.

1.60–2.10s — FLYING ILLUSION The mascot now stays almost stationary. Move the mascot vertically only 2–3 pixels in a gentle hover. Instead of moving the character dramatically, create the illusion of continuous upward travel. Send thin lavender speed lines downward behind the mascot. Occasionally send one tiny sparkle downward. The background itself does not move. Hero arm remains stable. Bent arm moves only 1–2 degrees. Legs move by only 1–2 pixels. Cape gives one tiny slow wave behind the body.

1.85–2.15s — TWIST REVEAL Reveal the Twist wordmark beneath the mascot. Start: opacity 0%. scale approximately 90%. position approximately 8 pixels below final position. Animate quickly: 90% scale → 104% → 100%. Move upward into final position. Fade opacity to 100%. Do not rotate the logo. Do not distort the letters.

2.00–2.25s — POWERED BY IST Approximately 0.12 seconds after Twist begins appearing, reveal: POWERED BY IST Fade opacity from 0% to 100%. Translate upward about 5 pixels. No bounce. Keep it secondary.

2.15–2.40s — REWARD ACCENT Add 2–3 tiny four-point sparkles around the mascot and Twist wordmark. Each sparkle: scale 0% → 110% → 0%. Very quick. Do not add confetti.

2.40–4.00s — FINAL HOLD Final splash composition is fully established. Mascot centered. Front-facing. Hero fist raised. Bent arm beside body. Legs hanging naturally. Cape behind the mascot. Twist centered underneath. POWERED BY IST underneath. Purple gradient background unchanged. Character performs only an almost invisible 2–3 pixel hover. Cape performs only a very soft slow airflow movement. Hold cleanly until the clip ends.

LAYER ORDER — NEVER CHANGE From back to front: purple background / speed streaks behind mascot / superhero cape / mascot torso and legs / arms / head / face / gold clasp / front sparkles / Twist wordmark / POWERED BY IST. Never place the cape in front of the head or torso. Never move the cape into another layer.

ANIMATION HIERARCHY Primary movement: torso/root position. Secondary movement: arms and legs. Tertiary movement: cape. Effects react to the launch. The cape never leads the motion. The cape never appears before the character.

STRICT FAIL CONDITIONS Reject any interpretation where: the cape appears alone, the cape enters first, the cape covers the character, the cape passes over the head, the cape becomes a parachute, the cape becomes wings, the cape becomes an umbrella, the mascot rotates, the camera moves, the mascot becomes 3D, additional limbs appear, the character design changes, a giant light beam appears, or the logo appears during takeoff.
