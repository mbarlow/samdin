# Reviews

Vision-based quality review for Samdin assets and scenes. Judges the render, not the triangle count.

## The loop

```
make review SPEC=specs/foo.json     # render the shot-set (6 shaded + 2 wireframe + stats)
```

Then a vision model grades the shots against the spec's **target prompt** using [docs/review-rubric.md](../docs/review-rubric.md): six weighted dimensions → a 0–100 score. Below threshold, it writes an ordered fix list into the worklog. Execute, re-shoot, re-grade.

## Files

- `docs/review-rubric.md` — the dimensions, weights, formula, thresholds, and fix playbook.
- `reviews/<name>.md` — the **worklog** for a spec: target prompt, dated review log (score + breakdown + findings), and the open fix list. Committed. This is the memory that drives iteration.
- `reviews/<name>/shots/` — rendered evidence. Regenerable, gitignored.

## Why this exists

`make golden` fingerprints anchors by geometry count. It guards that the pipeline didn't break — not that the art is good. A model can pass every count and still read as a squashed box on beach balls. That failure is only visible to the eye. This is the eye, made systematic.
