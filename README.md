# VMax

VMax is a vector search engine written in TypeScript, built from first principles: dataset loading, distance metrics, brute-force and HNSW search. Its core is pure TypeScript with no Node or browser APIs, so the same engine can run on a server and in the browser.

> Status: **v0.1.0 (Foundations)**. Datasets load and distances are tested; nothing searches yet.

## Install

Requires Node 24 (see `.nvmrc`; with nvm, run `nvm use`).

```sh
npm ci
```

## Run the checks

```sh
npm run lint        # ESLint + Prettier check
npm run typecheck   # tsc on the core (no Node/DOM types), the Node side, and tools
npm test            # Vitest
```

## Get the dataset

The `siftsmall` dataset (ANN_SIFT10K, 5.1 MB) comes from the [TEXMEX corpus](http://corpus-texmex.irisa.fr/). `data/` is git-ignored.

```sh
mkdir -p data && cd data
curl -O ftp://ftp.irisa.fr/local/texmex/corpus/siftsmall.tar.gz
tar xzf siftsmall.tar.gz
```

This gives `data/siftsmall/siftsmall_{base,query,learn}.fvecs` and `siftsmall_groundtruth.ivecs`. The integration tests run automatically when these files are present and are skipped otherwise (as in CI).

## Tools

```sh
npm run dataset-info -- data/siftsmall/siftsmall_base.fvecs   # shape and sanity numbers
npm run bench:distance                                        # ns per l2Squared call
```

## Layout

```
packages/core/
  src/                  portable core: no Node, no DOM (tsconfig.core.json)
    dataset.ts          parseFvecs / parseIvecs / encodeFvecs / encodeIvecs / vectorAt
    distance.ts         l2Squared, negInnerProduct, cosineDistance, distance, normalizeInPlace
    errors.ts           VMaxError and subclasses
    adapters/node/      Node-only: readFvecs / readIvecs (tsconfig.node.json)
  test/
tools/scripts/          dataset-info, bench-distance
docs/                   datasets, architecture decision records
```

See [CHANGELOG.md](CHANGELOG.md), [BENCHMARKS.md](BENCHMARKS.md) and [docs/decisions](docs/decisions).
