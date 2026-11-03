// 2D affine matrices [xx, xy, yx, yy, tx, ty]: x' = xx·x + yx·y + tx, y' = xy·x + yy·y + ty
import type { Mat } from './types';

export const ident = (): Mat => { 'worklet'; return [1, 0, 0, 1, 0, 0]; };
export const mul = (a: Mat, b: Mat): Mat => {
  'worklet';
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
};
export const invert = (m: Mat): Mat => {
  'worklet';
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return [1, 0, 0, 1, 0, 0];
  const d = 1 / det;
  return [m[3] * d, -m[1] * d, -m[2] * d, m[0] * d, (m[2] * m[5] - m[3] * m[4]) * d, (m[1] * m[4] - m[0] * m[5]) * d];
};
