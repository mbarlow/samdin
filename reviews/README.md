# Reviews

Vision-based quality review for Samdin assets and scenes. Judges the render, not the triangle count.

## The loop

```
make review SPEC=specs/foo.json     # render the shot-set (6 shaded + 2 wireframe + stats)
```

Then a vision model grades the shots against the spec's **target prompt** using [docs/review-rubric.md](../docs/review-rubric.md): six weighted dimensions → a 0–100 score. Below threshold, it writes an ordered fix list into the worklog. Execute, re-shoot, re-grade.

## The critic gate

The judge is the **`samdin-critic`** subagent (`.claude/agents/samdin-critic.md`). It is a separate agent by design — the builder cannot grade its own work without defending it. Point it at a spec and it renders the sweep, reads every shot (never the JSON), scores against the rubric, emits concrete spec-level fixes, and records the result.

```
build hero spec → spawn samdin-critic on it → structured verdict + score
  → any dim <40 or score <80 → execute the named fixes → re-review
  → loop until it lands in the ship band (≥80)
```

The verdict is a gate, not advice: a hero spec does not ship below 80. Background filler doesn't need it — validate + one render is enough there.

Scenes are gated the same way with their own rubric (composition, silhouette & massing, terrain believability, palette cohesion, read-distance clarity — see the scene rubric in [docs/review-rubric.md](../docs/review-rubric.md)). The critic judges a scene against its **concept image** (`media/concepts/<scene>.png`, the concept gate) — a scene with no concept is not reviewable. **`showcase-*` specs require a critic pass (≥ 80) before merge**, the same convention as the quality-bar anchors.

## The gauge

Every critic run appends to `reviews/scoreboard.json`. See movement over time:

```
make scoreboard          # latest score + delta per spec, avg, ship count
node cli/scoreboard.cjs show --spec quality-bar-espresso-machine   # full history for one spec
```

This is how "the art got better" stops being a claim and becomes a number that moved.

## Files

- `docs/review-rubric.md` — the dimensions, weights, formula, thresholds, and fix playbook.
- `.claude/agents/samdin-critic.md` — the critic agent: adversarial art director, renders + reads + scores + records.
- `reviews/scoreboard.json` — append-only score history. Committed. The gauge.
- `cli/scoreboard.cjs` — `record` / `show` for the board (stdlib-only).
- `reviews/<name>.md` — the **worklog** for a spec: target prompt, dated review log (score + breakdown + findings), and the open fix list. Committed. This is the memory that drives iteration.
- `reviews/<name>/shots/` — rendered evidence. Regenerable, gitignored.

## Why this exists

`make golden` fingerprints anchors by geometry count. It guards that the pipeline didn't break — not that the art is good. A model can pass every count and still read as a squashed box on beach balls. That failure is only visible to the eye. This is the eye, made systematic.
