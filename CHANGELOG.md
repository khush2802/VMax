# Changelog

## v0.1.0: Foundations

- Monorepo with lint, type-check and tests in CI (Node 24)
- Portable core: compiles with no Node or browser types
- .fvecs / .ivecs parsing and encoding, with validation
- Distance functions: squared L2, negative inner product, cosine
- First benchmark: l2Squared, 128 dimensions, 228 ns per call on an Intel Core i9-11900H
