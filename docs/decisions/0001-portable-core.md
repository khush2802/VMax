# 0001: A portable core, walled off by the compiler

- Status: accepted
- Date: 2026-10-20

## Decision

All engine logic (dataset parsing, distance functions and, later, the indexes) lives in `packages/core/src` and may use only the ES2022 standard library. Its tsconfig sets `"lib": ["ES2022"]` (no DOM, so no `window` or `console`) and `"types": []` (no `@types/node`, so no `fs`, `process` or `Buffer`). The core sees only bytes and numbers. Code that touches the disk or the network lives in adapters (`src/adapters/node`), which are type-checked under a separate tsconfig with Node types. CI runs both type-checks, so a stray `import 'node:fs'` in the core fails the build.

## Alternative considered

One Node-only package, where any file may import `fs` and read datasets directly. It is simpler on day one: no second tsconfig, no adapter layer, and parsing can call `readFileSync` where it needs it.

## Why we chose this

The same core must run in a browser in v10, and portability that is only a convention erodes one convenient import at a time. Making the compiler enforce it costs one extra tsconfig and a thin adapter, and catches violations the moment they are written rather than when the browser build breaks months later. It also improves the design today: functions that take bytes instead of paths are trivially testable with in-memory buffers, which is how the parser's failure cases are tested.
