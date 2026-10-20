import { DimensionMismatchError, ZeroVectorError } from './errors.js';

/*
 * One rule for every metric: smaller means closer. Search code never needs to know
 * which metric it is ranking by.
 *
 * The fast functions take a whole flat array plus an offset, so scanning a million
 * vectors allocates nothing. They do no checks: THE CALLER GUARANTEES that
 * aOff + dim <= a.length and bOff + dim <= b.length. Reading past the end of a typed
 * array returns undefined, and arithmetic on undefined silently gives NaN; the safe
 * `distance()` wrapper exists to catch that at the boundary.
 *
 * Typed-array reads use `a[i]!`: a documented exception to noUncheckedIndexedAccess,
 * justified by the guarantee above. Accumulation is a plain (64-bit) JS number; no
 * unrolling or multiple accumulators until v5, and only with a benchmark to prove them.
 */

export type Metric = 'l2' | 'ip' | 'cosine';

export type DistanceFn = (
  a: Float32Array,
  aOff: number,
  b: Float32Array,
  bOff: number,
  dim: number,
) => number;

/** Squared Euclidean distance. The square root is skipped: it preserves ranking. */
export const l2Squared: DistanceFn = (a, aOff, b, bOff, dim) => {
  let sum = 0;
  for (let i = 0; i < dim; i++) {
    const diff = a[aOff + i]! - b[bOff + i]!;
    sum += diff * diff;
  }
  return sum;
};

/** Negative inner product: a bigger dot product means more similar, so negate it. */
export const negInnerProduct: DistanceFn = (a, aOff, b, bOff, dim) => {
  let dot = 0;
  for (let i = 0; i < dim; i++) {
    dot += a[aOff + i]! * b[bOff + i]!;
  }
  return -dot;
};

/**
 * Cosine distance, 1 - cos(a, b): 0 for the same direction, 1 for perpendicular, 2 for
 * opposite. Reference version: computes both norms on every call. Returns NaN if either
 * vector is zero (the safe path throws ZeroVectorError instead).
 */
export const cosineDistance: DistanceFn = (a, aOff, b, bOff, dim) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < dim; i++) {
    const x = a[aOff + i]!;
    const y = b[bOff + i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return 1 - dot / Math.sqrt(normA * normB);
};

export function getDistanceFn(metric: Metric): DistanceFn {
  switch (metric) {
    case 'l2':
      return l2Squared;
    case 'ip':
      return negInnerProduct;
    case 'cosine':
      return cosineDistance;
    default: {
      const unknown: never = metric;
      throw new TypeError(`unknown metric: ${String(unknown)}`);
    }
  }
}

function squaredNorm(data: Float32Array, off: number, dim: number): number {
  let sum = 0;
  for (let i = 0; i < dim; i++) {
    const x = data[off + i]!;
    sum += x * x;
  }
  return sum;
}

/**
 * Safe path: validates, then computes. Throws DimensionMismatchError if the vectors
 * differ in length (or are empty), and ZeroVectorError for a zero vector under cosine.
 */
export function distance(metric: Metric, a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new DimensionMismatchError(`dimension mismatch: ${a.length} vs ${b.length}`);
  }
  if (a.length === 0) {
    throw new DimensionMismatchError('vectors must have at least one dimension');
  }
  if (metric === 'cosine') {
    if (squaredNorm(a, 0, a.length) === 0) throw new ZeroVectorError('first vector is zero');
    if (squaredNorm(b, 0, b.length) === 0) throw new ZeroVectorError('second vector is zero');
  }
  return getDistanceFn(metric)(a, 0, b, 0, a.length);
}

/**
 * Scales data[off .. off + dim) to unit length, in place. Throws ZeroVectorError for a
 * zero vector. The caller guarantees off + dim <= data.length.
 */
export function normalizeInPlace(data: Float32Array, off: number, dim: number): void {
  const norm = Math.sqrt(squaredNorm(data, off, dim));
  if (norm === 0) {
    throw new ZeroVectorError(`cannot normalise a zero vector at offset ${off}`);
  }
  for (let i = 0; i < dim; i++) {
    data[off + i] = data[off + i]! / norm;
  }
}
