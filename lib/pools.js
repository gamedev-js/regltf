import { RecyclePool } from 'memop';

export let f32a_m4_pool = new RecyclePool(function() {
  return new Float32Array(16);
}, 256);