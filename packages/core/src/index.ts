/** Public entry point of the portable core. No Node or browser APIs past this line. */
export const VERSION = '0.1.0';

export {
  VMaxError,
  DatasetFormatError,
  DimensionMismatchError,
  ZeroVectorError,
} from './errors.js';
export type { VectorSet, IdSet } from './dataset.js';
export { MAX_DIM, parseFvecs, parseIvecs, encodeFvecs, encodeIvecs, vectorAt } from './dataset.js';
export type { Metric, DistanceFn } from './distance.js';
export {
  l2Squared,
  negInnerProduct,
  cosineDistance,
  getDistanceFn,
  distance,
  normalizeInPlace,
} from './distance.js';
