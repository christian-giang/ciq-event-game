# Shared-mesh avatar animations

Split from `mohawk_mcgregor.glb`. Load the mesh **once**, then play any clip on it.

- `character.glb` — skinned mesh + skeleton (33 bones), **no** animations (~6.6 MB)
- `clips/*.glb` — animation curves only, no mesh/textures (~200 KB each):
  `boxing`, `drop-kick`, `dropkick`, `taunt`, `tpose`, `warming-up`

Every clip's tracks target the same bone names as `character.glb`, so they retarget
onto the shared skeleton by name.

## three.js usage

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const char = await loader.loadAsync('/animations-shared/character.glb');
scene.add(char.scene);

const mixer = new THREE.AnimationMixer(char.scene);

async function play(name) {
  const clip = await loader.loadAsync(`/animations-shared/clips/${name}.glb`);
  mixer.clipAction(clip.animations[0]).reset().play(); // binds tracks by bone name
}

// in your render loop: mixer.update(delta)
play('boxing');
```

Load each clip once and cache `clip.animations[0]` if you replay it.
