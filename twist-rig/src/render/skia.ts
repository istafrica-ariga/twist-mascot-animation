// React Native Skia renderer. Takes the `Skia` API object so the same code runs in the app
// (`import { Skia } from '@shopify/react-native-skia'`) and in validation (RN Skia's web build over CanvasKit).
// Enum values are Skia's (identical in RN Skia): PaintStyle Fill 0 / Stroke 1 · StrokeCap / StrokeJoin 0..2 (same
// order as the rig) · FillType Winding 0 / EvenOdd 1 · ClipOp Intersect 1 · TileMode Clamp 0.
// All functions are worklets: in the app, call `drawSkia` inside a PictureRecorder on the UI thread.
import type { DisplayList, PathCmd, Shader } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SkiaApi = any; type SkCanvas = any;

function toSkPath(Skia: SkiaApi, cmds: PathCmd[], evenOdd: boolean) {
  'worklet';
  const p = Skia.Path.Make();
  for (const k of cmds) {
    if (k[0] === 0) p.moveTo(k[1], k[2]);
    else if (k[0] === 1) p.lineTo(k[1], k[2]);
    else if (k[0] === 2) p.cubicTo(k[1], k[2], k[3], k[4], k[5], k[6]);
    else p.close();
  }
  p.setFillType(evenOdd ? 1 : 0);
  return p;
}

function shaderPaint(Skia: SkiaApi, paint: any, s: Shader) {
  'worklet';
  if (s.kind === 'solid') { paint.setColor(Skia.Color(s.color)); return; }
  paint.setColor(Skia.Color(0xff000000));
  const colors = s.colors.map(c => Skia.Color(c));
  paint.setShader(s.kind === 'linear'
    ? Skia.Shader.MakeLinearGradient({ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }, colors, s.positions, 0)
    : Skia.Shader.MakeRadialGradient({ x: s.cx, y: s.cy }, s.r, colors, s.positions, 0));
}

export function drawSkia(Skia: SkiaApi, canvas: SkCanvas, list: DisplayList) {
  'worklet';
  for (const op of list) {
    canvas.save();
    for (const cl of op.clips) canvas.clipPath(toSkPath(Skia, cl.path, cl.evenOdd), 1, true);
    for (const p of op.paints) {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      shaderPaint(Skia, paint, p.shader);
      if (p.style === 'fill') { paint.setStyle(0); canvas.drawPath(toSkPath(Skia, op.path, !!p.evenOdd), paint); }
      else {
        paint.setStyle(1); paint.setStrokeWidth(p.width ?? 1); paint.setStrokeCap(p.cap ?? 0); paint.setStrokeJoin(p.join ?? 0);
        canvas.drawPath(toSkPath(Skia, op.path, false), paint);
      }
    }
    canvas.restore();
  }
}
