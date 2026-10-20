import { describe, expect, it } from 'vitest';
import {
  DatasetFormatError,
  MAX_DIM,
  VMaxError,
  encodeFvecs,
  encodeIvecs,
  parseFvecs,
  parseIvecs,
  vectorAt,
} from '../src/index.js';
import type { IdSet, VectorSet } from '../src/index.js';
import { fvecs, ivecs } from './helpers.js';

function expectFormatError(fn: () => unknown, message: RegExp): void {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(DatasetFormatError);
  expect(caught).toBeInstanceOf(VMaxError);
  expect((caught as Error).message).toMatch(message);
}

describe('parseFvecs: valid input', () => {
  it('parses records into one flat Float32Array, row by row', () => {
    const set = parseFvecs(
      fvecs([
        [1, 2, 3],
        [4.5, -5, 6],
      ]),
    );
    expect(set.dim).toBe(3);
    expect(set.count).toBe(2);
    expect(set.data).toBeInstanceOf(Float32Array);
    expect(Array.from(set.data)).toEqual([1, 2, 3, 4.5, -5, 6]);
  });

  it('accepts an ArrayBuffer as well as a Uint8Array', () => {
    const bytes = fvecs([[7, 8]]);
    const set = parseFvecs(bytes.buffer as ArrayBuffer);
    expect(Array.from(set.data)).toEqual([7, 8]);
  });

  it('rounds values to float32 (like Math.fround)', () => {
    const set = parseFvecs(fvecs([[0.1]]));
    expect(set.data[0]).toBe(Math.fround(0.1));
  });

  it('honours a Uint8Array with a non-zero byteOffset (e.g. a pooled Buffer)', () => {
    const file = fvecs([
      [1, 2],
      [3, 4],
    ]);
    // Offset 3 is deliberately not a multiple of 4: a Float32Array view would throw.
    const big = new Uint8Array(3 + file.length + 5).fill(0xff);
    big.set(file, 3);
    const window = big.subarray(3, 3 + file.length);
    expect(window.byteOffset).toBe(3);

    const set = parseFvecs(window);
    expect(set.count).toBe(2);
    expect(Array.from(set.data)).toEqual([1, 2, 3, 4]);
  });
});

describe('parseIvecs', () => {
  it('parses records into one flat Int32Array', () => {
    const set = parseIvecs(
      ivecs([
        [0, 9999, -1],
        [5, 6, 7],
      ]),
    );
    expect(set.dim).toBe(3);
    expect(set.count).toBe(2);
    expect(set.data).toBeInstanceOf(Int32Array);
    expect(Array.from(set.data)).toEqual([0, 9999, -1, 5, 6, 7]);
  });

  it('rejects the same structural errors as parseFvecs', () => {
    expectFormatError(() => parseIvecs(new Uint8Array(0)), /empty file/);
    expectFormatError(() => parseIvecs(ivecs([[1, 2], [3]])), /inconsistent dimension in record 1/);
  });
});

describe('parseFvecs: failure cases', () => {
  it('rejects an empty file', () => {
    expectFormatError(() => parseFvecs(new Uint8Array(0)), /empty file/);
  });

  it('rejects fewer than 4 bytes as a truncated header', () => {
    expectFormatError(() => parseFvecs(new Uint8Array(3)), /truncated header.*got 3/);
  });

  it.each([0, -1, -128])('rejects a non-positive dimension (%i), naming it', (d) => {
    expectFormatError(() => parseFvecs(fvecs([[1]], [d])), new RegExp(`invalid dimension ${d}`));
  });

  it('rejects a dimension above the cap, naming it', () => {
    const d = MAX_DIM + 1;
    expectFormatError(() => parseFvecs(fvecs([[1]], [d])), new RegExp(`invalid dimension ${d}`));
  });

  it('accepts a dimension exactly at the cap', () => {
    const set = parseFvecs(fvecs([new Array<number>(MAX_DIM).fill(1)]));
    expect(set.dim).toBe(MAX_DIM);
  });

  it('rejects a later record whose dimension differs, naming the record', () => {
    const bytes = fvecs([
      [1, 2],
      [3, 4],
      [5, 6, 7],
    ]);
    expectFormatError(
      () => parseFvecs(bytes),
      /inconsistent dimension in record 2: expected 2 \(from record 0\), got 3/,
    );
  });

  it('rejects a last record cut short, with expected and actual byte counts', () => {
    const bytes = fvecs([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    // Each record is 4 + 4 * 3 = 16 bytes; drop the last 5 bytes.
    expectFormatError(
      () => parseFvecs(bytes.subarray(0, bytes.length - 5)),
      /truncated record 1: expected 16 bytes, got 11/,
    );
  });

  it('rejects a trailing partial header after complete records', () => {
    const bytes = fvecs([[1, 2]]);
    const padded = new Uint8Array(bytes.length + 2);
    padded.set(bytes);
    expectFormatError(() => parseFvecs(padded), /truncated header: record 1.*got 2/);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('rejects %s, naming the record and position', (_label, bad) => {
    const bytes = fvecs([
      [1, 2, 3],
      [4, bad, 6],
    ]);
    expectFormatError(() => parseFvecs(bytes), /non-finite value .* in record 1 at position 1/);
  });

  // An .ivecs file passed to parseFvecs is structurally valid and cannot always be
  // detected: validation checks structure, not meaning. This test documents that.
  it('cannot detect an .ivecs file passed to parseFvecs (documented limitation)', () => {
    const set = parseFvecs(ivecs([[1, 2, 3]]));
    expect(set.count).toBe(1);
    expect(set.data[0]).toBeGreaterThan(0);
    expect(set.data[0]).toBeLessThan(1e-40); // int 1 reads as a tiny denormal float
  });
});

describe('encodeFvecs / encodeIvecs', () => {
  it('round-trips a VectorSet', () => {
    const set: VectorSet = {
      dim: 3,
      count: 2,
      data: new Float32Array([1.5, -2.25, 0, 1e-3, 3e20, -7]),
    };
    const parsed = parseFvecs(encodeFvecs(set));
    expect(parsed.dim).toBe(set.dim);
    expect(parsed.count).toBe(set.count);
    expect(parsed.data).toEqual(set.data);
  });

  it('round-trips an IdSet', () => {
    const set: IdSet = {
      dim: 2,
      count: 3,
      data: new Int32Array([0, 1, 2147483647, -2147483648, 42, 7]),
    };
    const parsed = parseIvecs(encodeIvecs(set));
    expect(parsed).toEqual(set);
  });

  it('produces exactly count * (4 + 4 * dim) bytes, little-endian', () => {
    const bytes = encodeIvecs({ dim: 1, count: 1, data: new Int32Array([128]) });
    expect(Array.from(bytes)).toEqual([1, 0, 0, 0, 128, 0, 0, 0]);
  });

  it('matches a hand-built file byte for byte', () => {
    const records = [
      [1, 2],
      [3, 4],
    ];
    const encoded = encodeFvecs({ dim: 2, count: 2, data: new Float32Array(records.flat()) });
    expect(encoded).toEqual(fvecs(records));
  });

  it('rejects data whose length does not match count x dim', () => {
    expectFormatError(
      () => encodeFvecs({ dim: 3, count: 2, data: new Float32Array(5) }),
      /does not match count 2 x dim 3/,
    );
  });

  it('rejects an invalid dimension', () => {
    expectFormatError(
      () => encodeIvecs({ dim: 0, count: 0, data: new Int32Array(0) }),
      /invalid dimension 0/,
    );
  });
});

describe('vectorAt', () => {
  const set: VectorSet = { dim: 2, count: 3, data: new Float32Array([1, 2, 3, 4, 5, 6]) };

  it('returns a view of vector i, sharing memory with the set', () => {
    const v = vectorAt(set, 1);
    expect(Array.from(v)).toEqual([3, 4]);
    expect(v.buffer).toBe(set.data.buffer);
  });

  it.each([-1, 3, 1.5])('rejects index %s', (i) => {
    expect(() => vectorAt(set, i)).toThrow(RangeError);
  });
});
