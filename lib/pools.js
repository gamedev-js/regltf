import { FramePool } from 'memop';

export let f32a_m4_pool = new FramePool(function() {
  return new Float32Array(16);
}, 256);