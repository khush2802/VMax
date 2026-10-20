# Datasets

## siftsmall (ANN_SIFT10K)

Source: [TEXMEX corpus](http://corpus-texmex.irisa.fr/), `ftp://ftp.irisa.fr/local/texmex/corpus/siftsmall.tar.gz` (5.1 MB). Unpacked into `data/siftsmall/` (git-ignored).

Size check from the format alone: each record is `4 + 4 × 128 = 516` bytes, so the base file is `10,000 × 516 = 5,160,000` bytes. `ls -l` agrees.

Output of `npm run dataset-info -- data/siftsmall/*`:

```
siftsmall_base.fvecs
  file size:        5,160,000 bytes (expected 5,160,000)
  count:            10,000
  dimension:        128
  smallest value:   0
  largest value:    180
  avg L2 length:    508.6415

siftsmall_query.fvecs
  file size:        51,600 bytes (expected 51,600)
  count:            100
  dimension:        128
  smallest value:   0
  largest value:    169
  avg L2 length:    508.7072

siftsmall_learn.fvecs
  file size:        12,900,000 bytes (expected 12,900,000)
  count:            25,000
  dimension:        128
  smallest value:   0
  largest value:    193
  avg L2 length:    508.5889

siftsmall_groundtruth.ivecs
  file size:        40,400 bytes (expected 40,400)
  count:            100
  dimension:        100
  smallest ID:      0
  largest ID:       9,999
```

Observations:

- SIFT descriptors are non-negative integers stored as floats (0 to 193 here), with lengths clustered around 509: the descriptors are roughly normalised to a fixed length of about 512.
- Ground-truth IDs span the full base range [0, 9,999], with 100 neighbours per query, closest first.
