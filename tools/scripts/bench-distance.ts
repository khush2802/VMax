/**
 * Micro-benchmark: nanoseconds per l2Squared call on 128-dimensional vectors.
 *
 *   npm run bench:distance
 */
import { cpus } from 'node:os';
import { l2Squared } from '../../packages/core/src/index.js';

const DIM = 128;
const VECTORS = 1_000; // 512 KB of float32: fits in L2 cache on most CPUs
const CALLS = 1_000_000;
const WARMUP_CALLS = 200_000;

const data = new Float32Array(VECTORS * DIM);
for (let i = 0; i < data.length; i++) data[i] = Math.random() * 256;

function run(calls: number): number {
  // Every result goes into the sum, which is printed, so the JIT cannot skip the work.
  let sum = 0;
  for (let k = 0; k < calls; k++) {
    const a = (k % VECTORS) * DIM;
    const b = ((k * 7 + 13) % VECTORS) * DIM;
    sum += l2Squared(data, a, data, b, DIM);
  }
  return sum;
}

run(WARMUP_CALLS);

const start = process.hrtime.bigint();
const sum = run(CALLS);
const elapsed = process.hrtime.bigint() - start;

const nsPerCall = Number(elapsed) / CALLS;
console.log(`l2Squared, dim ${DIM}, ${CALLS.toLocaleString('en-US')} calls`);
console.log(`  ${nsPerCall.toFixed(1)} ns per call`);
console.log(`  checksum: ${sum}`);
console.log(`  CPU: ${cpus()[0]?.model.trim() ?? 'unknown'}`);
console.log(`  Node: ${process.version}`);
