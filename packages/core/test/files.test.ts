import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFvecs, readIvecs } from '../src/adapters/node/index.js';
import { DatasetFormatError } from '../src/index.js';
import { fvecs, ivecs } from './helpers.js';

describe('Node adapter: readFvecs / readIvecs', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vmax-files-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads and parses an .fvecs file', async () => {
    const path = join(dir, 'ok.fvecs');
    await writeFile(
      path,
      fvecs([
        [1, 2],
        [3, 4],
      ]),
    );
    const set = await readFvecs(path);
    expect(set.count).toBe(2);
    expect(Array.from(set.data)).toEqual([1, 2, 3, 4]);
  });

  it('reads and parses an .ivecs file', async () => {
    const path = join(dir, 'ok.ivecs');
    await writeFile(path, ivecs([[7, 8, 9]]));
    const set = await readIvecs(path);
    expect(Array.from(set.data)).toEqual([7, 8, 9]);
  });

  it('prefixes format errors with the file path and keeps the cause', async () => {
    const path = join(dir, 'empty.fvecs');
    await writeFile(path, new Uint8Array(0));
    const err = await readFvecs(path).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DatasetFormatError);
    expect((err as Error).message).toContain(path);
    expect((err as Error).message).toMatch(/empty file/);
    expect((err as Error).cause).toBeInstanceOf(DatasetFormatError);
  });

  it('lets I/O errors through unchanged', async () => {
    await expect(readFvecs(join(dir, 'missing.fvecs'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

// Integration test on the real dataset. data/ is git-ignored, so CI skips this.
const siftDir = fileURLToPath(new URL('../../../data/siftsmall/', import.meta.url));
const hasSift = existsSync(join(siftDir, 'siftsmall_base.fvecs'));

describe.skipIf(!hasSift)('siftsmall integration', () => {
  const allFinite = (data: Float32Array) => data.every((v) => Number.isFinite(v));

  it('loads base as 10,000 x 128', async () => {
    const base = await readFvecs(join(siftDir, 'siftsmall_base.fvecs'));
    expect([base.count, base.dim]).toEqual([10_000, 128]);
    expect(base.data.length).toBe(10_000 * 128);
    expect(allFinite(base.data)).toBe(true);
  });

  it('loads query as 100 x 128', async () => {
    const query = await readFvecs(join(siftDir, 'siftsmall_query.fvecs'));
    expect([query.count, query.dim]).toEqual([100, 128]);
    expect(allFinite(query.data)).toBe(true);
  });

  it('loads learn as 25,000 x 128', async () => {
    const learn = await readFvecs(join(siftDir, 'siftsmall_learn.fvecs'));
    expect([learn.count, learn.dim]).toEqual([25_000, 128]);
    expect(allFinite(learn.data)).toBe(true);
  });

  it('loads ground truth as 100 lists of 100 IDs, every ID in [0, 9999]', async () => {
    const gt = await readIvecs(join(siftDir, 'siftsmall_groundtruth.ivecs'));
    expect([gt.count, gt.dim]).toEqual([100, 100]);
    expect(gt.data.every((id) => id >= 0 && id <= 9_999)).toBe(true);
  });
});
