"use client";

import { Bounds, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Group, LoopOnce } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const CHARACTER = "/animations-shared/character.min.glb";

function Model({ clip, playing }: { clip: string; playing: boolean }) {
  // Character is loaded once and cached; each tile clones it (skinned meshes
  // must be cloned with SkeletonUtils so the skeleton is duplicated too).
  const { scene } = useGLTF(CHARACTER);
  const model = useMemo(() => cloneSkinned(scene) as Group, [scene]);

  // Clip GLBs carry animation curves only; they retarget onto the shared
  // skeleton by bone name via the mixer.
  const { animations } = useGLTF(`/animations-shared/clips/${clip}.glb`);
  const group = useRef<Group>(null);
  const { actions, names } = useAnimations(animations, group);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const action = names[0] ? actions[names[0]] : null;
    if (!action) return;
    /* eslint-disable react-hooks/immutability -- three.js AnimationAction is a mutable imperative API */
    action.reset();
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    // Rest: paused on the first frame. Tap: play through once.
    action.paused = !playing;
    /* eslint-enable react-hooks/immutability */
    invalidate(); // render the (posed) frame under frameloop="demand"
    return () => {
      action.stop();
    };
  }, [playing, actions, names, invalidate]);

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

export function MenuCharacter({
  clip,
  playing,
}: {
  clip: string;
  playing: boolean;
}) {
  return (
    <Canvas
      // Static at rest (renders on demand), animates continuously while playing.
      frameloop={playing ? "always" : "demand"}
      dpr={[1, 2]}
      camera={{ fov: 35 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <Suspense fallback={null}>
        <Bounds fit clip margin={1.25}>
          <Model clip={clip} playing={playing} />
        </Bounds>
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(CHARACTER);
