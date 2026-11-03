// Twist rig — data model. Plain JSON-able objects only (so everything can run inside Reanimated worklets).

export type Mat = [number, number, number, number, number, number]; // [xx, xy, yx, yy, tx, ty]

export interface Component {
  type: string;            // 'Node' | 'Shape' | 'PointsPath' | 'RootBone' | 'Bone' | 'Skin' | 'Tendon' | 'Weight' | ...
  parent: number | null;   // index into Rig.components (0 = artboard root)
  p: Record<string, number | string | boolean | undefined>;
  is: { transform: boolean; path: boolean; vertex: boolean; drawable: boolean };
}

export interface Keyframe { frame: number; value: number; interpolationType: number; interpolatorId?: number }
export interface KeyedProperty { name: string; color?: boolean; frames: Keyframe[] }
export interface Animation { name: string; fps: number; duration: number; loop: number; keyed: { objectId: number; props: KeyedProperty[] }[] }
export interface Interpolator { type: 'CubicEaseInterpolator' | 'ElasticInterpolator' | string; p: Record<string, number> }

/** Authoring / interchange model. */
export interface RigModel {
  width: number; height: number;
  components: Component[];
  animations: Animation[];
  interpolators: Record<number, Interpolator>;
}

/** Compiled rig: model + precomputed topology. Immutable at runtime. */
export interface Rig extends RigModel {
  kids: number[][];
  transformParent: (number | null)[];
  order: number[];                     // components in parents-first order
  drawables: number[];                 // shapes, in draw order (back → front)
  paths: Record<number, number[]>;     // shape → paths
  paints: Record<number, number[]>;    // shape → fills/strokes (paint order)
  verts: Record<number, number[]>;     // path → vertices
  skinOf: Record<number, number>;      // path → skin
  tendons: Record<number, number[]>;   // skin → tendons
  weightOf: Record<number, number>;    // vertex → weight
  mutator: Record<number, number>;     // paint → SolidColor / gradient
  stops: Record<number, number[]>;     // gradient → stops
  clips: Record<number, number[]>;     // component → ClippingShapes parented to it
  clipShapes: Record<number, number[]>; // clip source (Shape or Node) → shapes under it
  base: Record<string, number | string | boolean | undefined>[];
}

/** Per-instance mutable state. */
export interface Pose {
  p: Record<string, number | string | boolean | undefined>[];
  world: Mat[];
  opacity: number[];
  hidden: boolean[];
  boneMats: Record<number, Mat[]>;
}

// ── Display list: what a renderer draws. Coordinates already in output (canvas) space. ──
export type PathCmd = number[]; // [0,x,y] moveTo · [1,x,y] lineTo · [2,x1,y1,x2,y2,x,y] cubicTo · [3] close
export type Shader =
  | { kind: 'solid'; color: number }                                                     // ARGB, alpha pre-multiplied by opacity
  | { kind: 'linear'; x0: number; y0: number; x1: number; y1: number; colors: number[]; positions: number[] }
  | { kind: 'radial'; cx: number; cy: number; r: number; colors: number[]; positions: number[] };
export interface PaintOp { style: 'fill' | 'stroke'; shader: Shader; evenOdd?: boolean; width?: number; cap?: number; join?: number }
export interface ClipOp { path: PathCmd[]; evenOdd: boolean }
export interface DrawOp { path: PathCmd[]; clips: ClipOp[]; paints: PaintOp[] }
export type DisplayList = DrawOp[];
