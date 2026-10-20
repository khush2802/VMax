# Benchmarks

Micro-benchmarks, one row per measurement. Run on an idle machine, plugged in.

## l2Squared (`npm run bench:distance`)

1,000,000 calls on 128-dimensional vectors from one flat `Float32Array` (1,000 vectors), after a 200,000-call warm-up, timed with `process.hrtime.bigint()`. Every result is summed and printed so the JIT can't skip the work. Figure is the median of four runs.

| Date       | Version | ns / call | CPU                                     | Node     | Notes                                       |
| ---------- | ------- | --------: | --------------------------------------- | -------- | ------------------------------------------- |
| 2026-10-20 | v0.1.0  |       228 | 11th Gen Intel Core i9-11900H @ 2.50GHz | v24.15.0 | baseline: plain loop, one accumulator (tsx) |
