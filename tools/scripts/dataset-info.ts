/**
 * Prints a dataset file's shape and sanity numbers.
 *
 *   npm run dataset-info -- data/siftsmall/siftsmall_base.fvecs [more files...]
 */
import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { readFvecs, readIvecs } from '../../packages/core/src/adapters/node/index.js';
import type { IdSet, VectorSet } from '../../packages/core/src/index.js';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });

function describeVectors(set: VectorSet): string[] {
  let min = Infinity;
  let max = -Infinity;
  let lengthSum = 0;
  for (let i = 0; i < set.count; i++) {
    let sq = 0;
    for (let j = 0; j < set.dim; j++) {
      const v = set.data[i * set.dim + j]!;
      if (v < min) min = v;
      if (v > max) max = v;
      sq += v * v;
    }
    lengthSum += Math.sqrt(sq);
  }
  return [
    `  smallest value:   ${fmt(min)}`,
    `  largest value:    ${fmt(max)}`,
    `  avg L2 length:    ${fmt(lengthSum / set.count)}`,
  ];
}

function describeIds(set: IdSet): string[] {
  let min = Infinity;
  let max = -Infinity;
  for (const id of set.data) {
    if (id < min) min = id;
    if (id > max) max = id;
  }
  return [`  smallest ID:      ${fmt(min)}`, `  largest ID:       ${fmt(max)}`];
}

async function info(path: string): Promise<string> {
  const ext = extname(path);
  if (ext !== '.ivecs' && ext !== '.fvecs') {
    throw new Error(`unsupported file extension ${ext}: expected .fvecs or .ivecs`);
  }
  const { size } = await stat(path);
  const set = ext === '.ivecs' ? await readIvecs(path) : await readFvecs(path);
  const expected = set.count * (4 + 4 * set.dim);
  const lines = [
    basename(path),
    `  file size:        ${fmt(size)} bytes (expected ${fmt(expected)})`,
    `  count:            ${fmt(set.count)}`,
    `  dimension:        ${fmt(set.dim)}`,
    ...(ext === '.ivecs' ? describeIds(set as IdSet) : describeVectors(set as VectorSet)),
  ];
  return lines.join('\n');
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('usage: dataset-info <file.fvecs|file.ivecs> [...]');
  process.exit(1);
}
for (const path of paths) {
  console.log(await info(path));
  console.log();
}
