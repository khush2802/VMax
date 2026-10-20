/**
 * The VMax error hierarchy. Callers catch by type (`instanceof`), never by message text.
 */
export class VMaxError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A .fvecs / .ivecs file (or byte buffer) is structurally invalid. */
export class DatasetFormatError extends VMaxError {}

/** Two vectors that must share a dimension do not. */
export class DimensionMismatchError extends VMaxError {}

/** A zero vector was used where a direction is required (cosine, normalisation). */
export class ZeroVectorError extends VMaxError {}
