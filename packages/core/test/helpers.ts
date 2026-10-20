/** Test helpers: build tiny .fvecs / .ivecs files by hand, byte by byte. */

type Value = number;

/**
 * Builds a vecs file from records. Each record is written as its declared dimension
 * (defaults to the record's length, so tests can lie about it) followed by its values.
 */
export function buildVecs(
  records: readonly (readonly Value[])[],
  kind: 'float32' | 'int32',
  declaredDims?: readonly number[],
): Uint8Array {
  const total = records.reduce((sum, r) => sum + 4 + 4 * r.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let pos = 0;
  records.forEach((record, r) => {
    view.setInt32(pos, declaredDims?.[r] ?? record.length, true);
    pos += 4;
    for (const v of record) {
      if (kind === 'float32') view.setFloat32(pos, v, true);
      else view.setInt32(pos, v, true);
      pos += 4;
    }
  });
  return out;
}

export const fvecs = (records: readonly (readonly Value[])[], declaredDims?: readonly number[]) =>
  buildVecs(records, 'float32', declaredDims);

export const ivecs = (records: readonly (readonly Value[])[], declaredDims?: readonly number[]) =>
  buildVecs(records, 'int32', declaredDims);
