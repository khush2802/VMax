import { readFile } from 'node:fs/promises';
import { parseFvecs, parseIvecs } from '../../dataset.js';
import type { IdSet, VectorSet } from '../../dataset.js';
import { DatasetFormatError } from '../../errors.js';

// The Buffer is passed straight to the parser: a Buffer is a Uint8Array, and it may be
// a window into Node's shared pool, so the parser honours byteOffset and byteLength.
async function readWith<T>(path: string, parse: (bytes: Uint8Array) => T): Promise<T> {
  const bytes = await readFile(path);
  try {
    return parse(bytes);
  } catch (err) {
    if (err instanceof DatasetFormatError) {
      throw new DatasetFormatError(`${path}: ${err.message}`, { cause: err });
    }
    throw err;
  }
}

/** Reads and parses a .fvecs file from disk. */
export function readFvecs(path: string): Promise<VectorSet> {
  return readWith(path, parseFvecs);
}

/** Reads and parses an .ivecs file from disk. */
export function readIvecs(path: string): Promise<IdSet> {
  return readWith(path, parseIvecs);
}
