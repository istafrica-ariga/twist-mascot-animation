// Renders the machine with two stacked <video> layers. The only part that knows about video.
//
// Two layers rather than one because a join is a crossfade: the incoming clip starts underneath at
// zero opacity and comes up over `joinMs`, so the outgoing clip is still playing through the blend
// instead of freezing on its last frame. On a hard cut (joinMs 0) the swap is instant and the
// second layer is never seen.
import { CLIPS, MascotMachine } from './machine.js';

// HEVC-with-alpha plays on Apple platforms and nowhere else; VP9-with-alpha plays everywhere else.
// Both live in masko/web at 256 px, which is what the app shows: the mascot renders at 69 x 75 px
// on the lesson screen, so 256 covers a 3x retina phone and the 768 masters in masko/clips are
// about eight times larger for nothing. The browser is asked which codec it can take rather than
// being sniffed.
function pickFormat(probe = document.createElement('video')) {
  const hevc = probe.canPlayType('video/mp4; codecs="hvc1"');
  const ext = hevc === 'probably' || hevc === 'maybe' ? 'mov' : 'webm';
  return { dir: '../web', ext };
}

export function mountMascot(host, opts = {}) {
  const fmt = opts.format || pickFormat();
  const src = clip => `${fmt.dir}/${clip}.${fmt.ext}`;

  host.style.position = 'relative';
  const layers = [0, 1].map(() => {
    const v = document.createElement('video');
    Object.assign(v, { muted: true, playsInline: true, preload: 'auto', autoplay: false });
    v.setAttribute('playsinline', '');            // Safari wants the attribute, not just the prop
    Object.assign(v.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      objectFit: 'contain', opacity: '0', pointerEvents: 'none',
    });
    host.appendChild(v);
    return v;
  });

  let front = 0;
  let machine;

  async function play(clip, joinMs) {
    const back = 1 - front;
    const fg = layers[front], bg = layers[back];

    bg.src = src(clip);
    bg.loop = CLIPS[clip].kind === 'loop';
    bg.onended = bg.loop ? null : () => machine.ended();
    bg.currentTime = 0;
    try { await bg.play(); } catch { /* autoplay refused until a gesture; the next event retries */ }

    if (joinMs > 0) {
      bg.style.transition = `opacity ${joinMs}ms linear`;
      fg.style.transition = `opacity ${joinMs}ms linear`;
      requestAnimationFrame(() => { bg.style.opacity = '1'; fg.style.opacity = '0'; });
      setTimeout(() => { fg.pause(); fg.removeAttribute('src'); fg.load(); }, joinMs + 40);
    } else {
      bg.style.transition = fg.style.transition = 'none';
      bg.style.opacity = '1';
      fg.style.opacity = '0';
      fg.pause();
    }
    front = back;
    opts.onChange?.(clip, joinMs);
  }

  machine = new MascotMachine((clip, joinMs) => { play(clip, joinMs); }, opts.start || 'idle');

  return {
    // the six events the lesson fires
    speak:         () => machine.send('speak'),
    speechEnd:     () => machine.send('speechEnd'),
    answerCorrect: () => machine.send('answerCorrect'),
    answerWrong:   () => machine.send('answerWrong'),
    nextQuestion:  () => machine.send('nextQuestion'),
    retry:         () => machine.send('retry'),
    hint:          () => machine.send('hint'),
    get state() { return machine.current; },
    format: fmt,
  };
}
