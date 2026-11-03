// <MascotCanvas> — plays a twist-rig on React Native Skia, evaluated on the UI thread (Reanimated 4 / Worklets).
//
//   const ref = useRef<MascotHandle>(null);
//   <MascotCanvas ref={ref} rig={mascotRig} stateMachine={mascotSM} width={180} height={180} onEvent={e => …} />
//   ref.current?.setInput('flying', true);   ref.current?.fire('launch');
//
// Per frame (UI thread): resetPose → advanceSM(dt) → solve (transforms, IK, skins) → displayList → Skia picture.
// The JS thread is not involved after mount, so React re-renders can't drop animation frames.
import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Canvas, Picture, createPicture, Skia } from '@shopify/react-native-skia';
import { useFrameCallback, useSharedValue, runOnUI, runOnJS } from 'react-native-reanimated';
import type { RigModel, Pose, Mat } from '../types';
import { compileRig, createPose, resetPose, solve, displayList } from '../core';
import { createSM, setInput as smSetInput, advanceSM, type StateMachine, type SMInstance } from '../state-machine';
import { drawSkia } from '../render/skia';

export interface MascotHandle {
  setInput(name: string, value: number | boolean): void;
  fire(trigger: string): void;
  pause(): void;
  play(): void;
}
export interface MascotCanvasProps {
  rig: RigModel;
  stateMachine: StateMachine;
  width: number;
  height: number;
  /** Fired (on the JS thread) when a layer enters a state: "<layer>:<state>". */
  onEvent?: (event: string) => void;
  autoplay?: boolean;
}

export const MascotCanvas = forwardRef<MascotHandle, MascotCanvasProps>(function MascotCanvas(
  { rig: model, stateMachine, width, height, onEvent, autoplay = true }, ref) {
  const rig = useMemo(() => compileRig(model), [model]);
  // fit "contain", centred
  const view = useMemo<Mat>(() => {
    const s = Math.min(width / rig.width, height / rig.height);
    return [s, 0, 0, s, (width - rig.width * s) / 2, (height - rig.height * s) / 2];
  }, [rig, width, height]);

  // Mutable per-instance state lives on the UI runtime (worklet-captured objects are copied/frozen).
  const state = useSharedValue<{ pose: Pose; sm: SMInstance } | null>(null);
  const picture = useSharedValue(createPicture(() => {}, { width, height }));
  const playing = useSharedValue(autoplay);

  const emit = (e: string) => onEvent?.(e);
  useFrameCallback(frame => {
    'worklet';
    if (!playing.value) return;
    if (state.value == null) state.value = { pose: createPose(rig), sm: createSM(stateMachine) };
    const { pose, sm } = state.value;
    const dt = Math.min(0.1, (frame.timeSincePreviousFrame ?? 16) / 1000);
    resetPose(rig, pose);
    advanceSM(rig, pose, stateMachine, sm, dt);
    solve(rig, pose);
    const list = displayList(rig, pose, view);
    picture.value = createPicture(canvas => { drawSkia(Skia, canvas, list); }, { width, height });
    if (sm.events.length) { const evs = sm.events.splice(0); if (onEvent) for (const e of evs) runOnJS(emit)(e); }
  });

  useImperativeHandle(ref, () => ({
    setInput: (name, value) => runOnUI((n: string, v: number | boolean) => { 'worklet'; if (state.value) smSetInput(state.value.sm, n, v); })(name, value),
    fire: name => runOnUI((n: string) => { 'worklet'; if (state.value) smSetInput(state.value.sm, n); })(name),
    pause: () => { playing.value = false; },
    play: () => { playing.value = true; },
  }), [state, playing]);

  return (
    <Canvas style={{ width, height }}>
      <Picture picture={picture} />
    </Canvas>
  );
});
