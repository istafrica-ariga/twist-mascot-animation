// Canvas 2D renderer (web, previews, validation). Draws a display list as-is.
import type { DisplayList, PathCmd, Shader } from '../types';

const css = (argb: number) => `rgba(${(argb >>> 16) & 255},${(argb >>> 8) & 255},${argb & 255},${((argb >>> 24) & 255) / 255})`;

function toPath2D(cmds: PathCmd[]) {
  const p = new Path2D();
  for (const k of cmds) {
    if (k[0] === 0) p.moveTo(k[1], k[2]);
    else if (k[0] === 1) p.lineTo(k[1], k[2]);
    else if (k[0] === 2) p.bezierCurveTo(k[1], k[2], k[3], k[4], k[5], k[6]);
    else p.closePath();
  }
  return p;
}

function style(ctx: CanvasRenderingContext2D, s: Shader): string | CanvasGradient {
  if (s.kind === 'solid') return css(s.color);
  const g = s.kind === 'linear' ? ctx.createLinearGradient(s.x0, s.y0, s.x1, s.y1) : ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.r);
  s.colors.forEach((c, i) => g.addColorStop(s.positions[i], css(c)));
  return g;
}

export function drawCanvas2D(ctx: CanvasRenderingContext2D, list: DisplayList) {
  for (const op of list) {
    ctx.save();
    for (const cl of op.clips) ctx.clip(toPath2D(cl.path), cl.evenOdd ? 'evenodd' : 'nonzero');
    const path = toPath2D(op.path);
    for (const p of op.paints) {
      if (p.style === 'fill') { ctx.fillStyle = style(ctx, p.shader); ctx.fill(path, p.evenOdd ? 'evenodd' : 'nonzero'); }
      else {
        ctx.strokeStyle = style(ctx, p.shader); ctx.lineWidth = p.width ?? 1;
        ctx.lineCap = (['butt', 'round', 'square'] as const)[p.cap ?? 0];
        ctx.lineJoin = (['miter', 'round', 'bevel'] as const)[p.join ?? 0];
        ctx.stroke(path);
      }
    }
    ctx.restore();
  }
}
