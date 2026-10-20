import { DatasetFormatError } from './errors.js';

/**
 * A set of `count` vectors of `dim` float32 values, stored flat and row by row:
 * vector i occupies data[i * dim] .. data[i * dim + dim - 1].
 */
export interface VectorSet {
  readonly dim: number;
  readonly count: number;
  readonly data: Float32Array;
}

/** Same layout as VectorSet, with int32 values (e.g. ground-truth neighbour IDs). */
export interface IdSet {
  readonly dim: number;
  readonly count: number;
  readonly data: Int32Array;
}

/**
 * Sanity cap on the per-record dimension, so a corrupt first integer cannot make the
 * parser allocate gigabytes. Real embedding models stay far below this.
 */
export const MAX_DIM = 65_536;

type ElementKind = 'float32' | 'int32';

/*
 * File format (TEXMEX): records back to back, no header. Each record is a little-endian
 * int32 `d` followed by `d` little-endian 4-byte values (float32 for .fvecs, int32 for
 * .ivecs), so every record is 4 + 4d bytes.
 *
 * Decision: bytes are read through a DataView, not a Float32Array view over the input.
 * DataView states the byte order explicitly and has no alignment rules (a Node Buffer
 * from the shared pool can start at any byte offset). It is slower; we measure parse
 * time on SIFT1M in v4 and only optimise if it matters.
 *
 * Validation checks structure, not meaning: an .ivecs file passed to parseFvecs is
 * structurally identical and parses into tiny, meaningless (denormal) floats.
 */
function parseVecs(
  bytes: ArrayBuffer | Uint8Array,
  kind: ElementKind,
): { dim: number; count: number; data: Float32Array | Int32Array } {
  const view =
    bytes instanceof Uint8Array
      ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : new DataView(bytes);
  const total = view.byteLength;

  // Decision: an empty file is an error, not an empty set; it is almost always a failed download.
  if (total === 0) {
    throw new DatasetFormatError('empty file: expected at least one record');
  }
  if (total < 4) {
    throw new DatasetFormatError(
      `truncated header: record 0 needs 4 bytes for its dimension, got ${total}`,
    );
  }

  const dim = view.getInt32(0, true);
  // Decision: cap the dimension so a corrupt first integer cannot trigger a huge allocation.
  if (dim <= 0 || dim > MAX_DIM) {
    throw new DatasetFormatError(
      `invalid dimension ${dim} in record 0: must be between 1 and ${MAX_DIM}`,
    );
  }

  const recordBytes = 4 + 4 * dim;
  const count = Math.floor(total / recordBytes);
  const data = kind === 'float32' ? new Float32Array(count * dim) : new Int32Array(count * dim);

  let offset = 0;
  for (let r = 0; offset < total; r++) {
    const remaining = total - offset;
    if (remaining < 4) {
      throw new DatasetFormatError(
        `truncated header: record ${r} needs 4 bytes for its dimension, got ${remaining}`,
      );
    }
    const d = view.getInt32(offset, true);
    if (d !== dim) {
      throw new DatasetFormatError(
        `inconsistent dimension in record ${r}: expected ${dim} (from record 0), got ${d}`,
      );
    }
    if (remaining < recordBytes) {
      throw new DatasetFormatError(
        `truncated record ${r}: expected ${recordBytes} bytes, got ${remaining}`,
      );
    }

    const base = r * dim;
    let pos = offset + 4;
    if (kind === 'float32') {
      for (let j = 0; j < dim; j++, pos += 4) {
        const v = view.getFloat32(pos, true);
        // Decision: reject NaN / Infinity. Base data must be finite or every distance is NaN.
        if (!Number.isFinite(v)) {
          throw new DatasetFormatError(`non-finite value ${v} in record ${r} at position ${j}`);
        }
        data[base + j] = v;
      }
    } else {
      for (let j = 0; j < dim; j++, pos += 4) {
        data[base + j] = view.getInt32(pos, true);
      }
    }
    offset += recordBytes;
  }

  return { dim, count, data };
}

/** Parses a .fvecs file. Accepts a Uint8Array (e.g. a Node Buffer) with any byteOffset. */
export function parseFvecs(bytes: ArrayBuffer | Uint8Array): VectorSet {
  const { dim, count, data } = parseVecs(bytes, 'float32');
  return { dim, count, data: data as Float32Array };
}

/** Parses an .ivecs file. Accepts a Uint8Array (e.g. a Node Buffer) with any byteOffset. */
export function parseIvecs(bytes: ArrayBuffer | Uint8Array): IdSet {
  const { dim, count, data } = parseVecs(bytes, 'int32');
  return { dim, count, data: data as Int32Array };
}

function encodeVecs(set: VectorSet | IdSet, kind: ElementKind): Uint8Array {
  const { dim, count, data } = set;
  if (!Number.isInteger(dim) || dim <= 0 || dim > MAX_DIM) {
    throw new DatasetFormatError(`invalid dimension ${dim}: must be between 1 and ${MAX_DIM}`);
  }
  if (!Number.isInteger(count) || count < 0 || data.length !== count * dim) {
    throw new DatasetFormatError(
      `data length ${data.length} does not match count ${count} x dim ${dim}`,
    );
  }

  const recordBytes = 4 + 4 * dim;
  const out = new Uint8Array(count * recordBytes);
  const view = new DataView(out.buffer);
  let pos = 0;
  for (let r = 0; r < count; r++) {
    view.setInt32(pos, dim, true);
    pos += 4;
    const base = r * dim;
    for (let j = 0; j < dim; j++, pos += 4) {
      const v = data[base + j] as number;
      if (kind === 'float32') view.setFloat32(pos, v, true);
      else view.setInt32(pos, v, true);
    }
  }
  return out;
}

/** Encodes a VectorSet in .fvecs format. */
export function encodeFvecs(set: VectorSet): Uint8Array {
  return encodeVecs(set, 'float32');
}

/** Encodes an IdSet in .ivecs format. */
export function encodeIvecs(set: IdSet): Uint8Array {
  return encodeVecs(set, 'int32');
}

/**
 * Returns vector i as a view (no copy) into the set's data. A convenience for tests and
 * tools: it allocates a view object per call, so never use it in hot loops.
 */
export function vectorAt(set: VectorSet, i: number): Float32Array {
  if (!Number.isInteger(i) || i < 0 || i >= set.count) {
    throw new RangeError(`vector index ${i} out of range [0, ${set.count})`);
  }
  return set.data.subarray(i * set.dim, (i + 1) * set.dim);
}
