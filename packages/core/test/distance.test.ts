import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DimensionMismatchError,
  ZeroVectorError,
  cosineDistance,
  distance,
  getDistanceFn,
  l2Squared,
  negInnerProduct,
  normalizeInPlace,
} from '../src/index.js';
import type { DistanceFn, Metric } from '../src/index.js';

const f32 = (...values: number[]) => new Float32Array(values);

/** Calls a fast distance function on two whole vectors (offset 0). */
const call = (fn: DistanceFn, a: Float32Array, b: Float32Array) => fn(a, 0, b, 0, a.length);

describe('hand-computed values', () => {
  it('l2Squared([1, 2], [4, 6]) = 25', () => {
    expect(call(l2Squared, f32(1, 2), f32(4, 6))).toBe(25);
  });

  it('negInnerProduct([1, 2], [3, 4]) = -11', () => {
    expect(call(negInnerProduct, f32(1, 2), f32(3, 4))).toBe(-11);
  });

  it('cosineDistance: perpendicular = 1', () => {
    expect(call(cosineDistance, f32(1, 0), f32(0, 1))).toBeCloseTo(1, 12);
  });

  it('cosineDistance: same direction ~ 0', () => {
    expect(call(cosineDistance, f32(1, 1), f32(2, 2))).toBeCloseTo(0, 12);
  });

  it('cosineDistance: opposite = 2', () => {
    expect(call(cosineDistance, f32(1, 0), f32(-1, 0))).toBeCloseTo(2, 12);
  });

  it('identical vectors: exactly 0 for squared L2, ~0 for cosine', () => {
    const v = f32(0.1, -3.7, 12.25, 1e-3);
    expect(call(l2Squared, v, v)).toBe(0);
    expect(call(cosineDistance, v, v)).toBeCloseTo(0, 6);
  });
});

describe('non-zero offsets inside a larger flat array', () => {
  // Layout: [junk, a0, a1, junk, b0, b1, junk]; a at offset 1, b at offset 4.
  const flat = (a: [number, number], b: [number, number]) =>
    f32(99, a[0], a[1], -99, b[0], b[1], 42);

  it('l2Squared', () => {
    expect(l2Squared(flat([1, 2], [4, 6]), 1, flat([1, 2], [4, 6]), 4, 2)).toBe(25);
  });

  it('negInnerProduct', () => {
    const data = flat([1, 2], [3, 4]);
    expect(negInnerProduct(data, 1, data, 4, 2)).toBe(-11);
  });

  it('cosineDistance', () => {
    const data = flat([1, 0], [-1, 0]);
    expect(cosineDistance(data, 1, data, 4, 2)).toBeCloseTo(2, 12);
    const same = flat([1, 1], [2, 2]);
    expect(cosineDistance(same, 1, same, 4, 2)).toBeCloseTo(0, 12);
  });

  it('works across two different arrays with different offsets', () => {
    const a = f32(0, 0, 0, 1, 2);
    const b = f32(4, 6);
    expect(l2Squared(a, 3, b, 0, 2)).toBe(25);
  });
});

describe('fast path has no bounds checks (by design)', () => {
  it('silently returns NaN when the offset runs past the end', () => {
    const a = f32(1, 2);
    const b = f32(3, 4);
    expect(l2Squared(a, 1, b, 0, 2)).toBeNaN();
    expect(negInnerProduct(a, 0, b, 5, 2)).toBeNaN();
  });

  it('propagates NaN inside a vector (the loader rejects these)', () => {
    expect(call(l2Squared, f32(1, NaN), f32(1, 2))).toBeNaN();
  });

  it('returns NaN for a zero vector under cosine', () => {
    expect(call(cosineDistance, f32(0, 0), f32(1, 2))).toBeNaN();
  });
});

describe('safe distance()', () => {
  it('computes each metric', () => {
    expect(distance('l2', f32(1, 2), f32(4, 6))).toBe(25);
    expect(distance('ip', f32(1, 2), f32(3, 4))).toBe(-11);
    expect(distance('cosine', f32(1, 0), f32(0, 1))).toBeCloseTo(1, 12);
  });

  it.each<Metric>(['l2', 'ip', 'cosine'])(
    'throws DimensionMismatchError for different lengths (%s)',
    (metric) => {
      // The fast path would read past the end of b and return NaN; the safe path refuses.
      expect(() => distance(metric, f32(1, 2, 3), f32(1, 2))).toThrow(DimensionMismatchError);
    },
  );

  it('throws DimensionMismatchError for empty vectors', () => {
    expect(() => distance('l2', f32(), f32())).toThrow(DimensionMismatchError);
  });

  it('throws ZeroVectorError for a zero vector under cosine', () => {
    expect(() => distance('cosine', f32(0, 0), f32(1, 2))).toThrow(ZeroVectorError);
    expect(() => distance('cosine', f32(1, 2), f32(0, 0))).toThrow(ZeroVectorError);
  });

  it('allows zero vectors under l2 and ip', () => {
    expect(distance('l2', f32(0, 0), f32(3, 4))).toBe(25);
    expect(distance('ip', f32(0, 0), f32(3, 4))).toBe(-0);
  });
});

describe('getDistanceFn', () => {
  it('maps each metric to its function', () => {
    expect(getDistanceFn('l2')).toBe(l2Squared);
    expect(getDistanceFn('ip')).toBe(negInnerProduct);
    expect(getDistanceFn('cosine')).toBe(cosineDistance);
  });

  it('rejects an unknown metric at runtime', () => {
    expect(() => getDistanceFn('hamming' as Metric)).toThrow(TypeError);
  });
});

describe('normalizeInPlace', () => {
  it('scales a vector to unit length', () => {
    const v = f32(3, 4);
    normalizeInPlace(v, 0, 2);
    expect(v[0]).toBeCloseTo(0.6, 6);
    expect(v[1]).toBeCloseTo(0.8, 6);
  });

  it('only touches data[off .. off + dim)', () => {
    const data = f32(7, 3, 4, 7);
    normalizeInPlace(data, 1, 2);
    expect(data[0]).toBe(7);
    expect(data[3]).toBe(7);
    expect(data[1]).toBeCloseTo(0.6, 6);
  });

  it('throws ZeroVectorError for a zero vector', () => {
    expect(() => normalizeInPlace(f32(0, 0, 0), 0, 3)).toThrow(ZeroVectorError);
  });
});

describe('properties', () => {
  // Random finite float32 vectors, pairs sharing one dimension.
  const vec = (dim: number) =>
    fc.float32Array({
      minLength: dim,
      maxLength: dim,
      noNaN: true,
      noDefaultInfinity: true,
      min: -1000,
      max: 1000,
    });
  const pair = fc.integer({ min: 1, max: 64 }).chain((dim) => fc.tuple(vec(dim), vec(dim)));

  const norm = (v: Float32Array) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  const MIN_NORM = 1e-3; // avoid near-zero vectors where cosine is ill-conditioned

  it('symmetry: d(a, b) = d(b, a) for all three metrics', () => {
    fc.assert(
      fc.property(pair, ([a, b]) => {
        fc.pre(norm(a) > MIN_NORM && norm(b) > MIN_NORM);
        for (const fn of [l2Squared, negInnerProduct, cosineDistance]) {
          expect(call(fn, a, b)).toBe(call(fn, b, a));
        }
      }),
    );
  });

  it('squared L2 is never negative, and d(a, a) = 0', () => {
    fc.assert(
      fc.property(pair, ([a, b]) => {
        expect(call(l2Squared, a, b)).toBeGreaterThanOrEqual(0);
        expect(call(l2Squared, a, a)).toBe(0);
      }),
    );
  });

  it('unit vectors: squared L2 = 2 - 2 (a . b)', () => {
    fc.assert(
      fc.property(pair, ([a, b]) => {
        fc.pre(norm(a) > MIN_NORM && norm(b) > MIN_NORM);
        normalizeInPlace(a, 0, a.length);
        normalizeInPlace(b, 0, b.length);
        const dot = -call(negInnerProduct, a, b);
        expect(Math.abs(call(l2Squared, a, b) - (2 - 2 * dot))).toBeLessThan(1e-5);
      }),
    );
  });

  it('cosine distance stays within [0, 2]', () => {
    const eps = 1e-9;
    fc.assert(
      fc.property(pair, ([a, b]) => {
        fc.pre(norm(a) > MIN_NORM && norm(b) > MIN_NORM);
        const d = call(cosineDistance, a, b);
        expect(d).toBeGreaterThanOrEqual(-eps);
        expect(d).toBeLessThanOrEqual(2 + eps);
      }),
    );
  });

  it('after normalising, L2 and cosine rank identically: l2 = 2 * cosine', () => {
    fc.assert(
      fc.property(pair, ([a, b]) => {
        fc.pre(norm(a) > MIN_NORM && norm(b) > MIN_NORM);
        const cos = call(cosineDistance, a, b);
        normalizeInPlace(a, 0, a.length);
        normalizeInPlace(b, 0, b.length);
        expect(Math.abs(call(l2Squared, a, b) - 2 * cos)).toBeLessThan(1e-5);
      }),
    );
  });
});
