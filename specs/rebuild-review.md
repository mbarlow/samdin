# Rebuild Review

## Why the previous batch was discarded

- The earlier forward-test specs were composed as breadth-first samples instead of quality-first anchors.
- Camera fit, stage footprint, and material separation were not being judged from rendered output early enough.
- Several assets were technically valid JSON but still weak as models: flat silhouettes, low read clarity, poor lighting balance, and low-value detail.

## Current rebuild strategy

- Rebuild from one strong hero prop first, not five mediocre specs.
- Validate every revision with `node cli/validate-spec.cjs`.
- Inspect every revision through the actual viewer with Playwright screenshots before calling it done.
- Fix construction problems from render evidence, not from JSON theory.

## Current anchor

- Spec: `specs/quality-bar-field-radio.json`
- Intent: hard-surface quality bar for a compact hero prop with layered fascia, readable material groups, clean product-shot framing, and believable silhouette.

## What changed in the rebuild

- Reduced stage footprint so the model, not the plinth, drives framing.
- Reworked the shell into a clearer two-tone volume with stronger side caps and top treatment.
- Rebuilt the front face around a recessed fascia, distinct speaker area, tuning window, and control shelf.
- Removed renderer-hostile micro-detail where it created broken-looking shadow artifacts.
- Added local inspection support for parallel review sessions by updating `cli/inspect-model.js` to accept `[port]`.

## What Claude should review

- Does `quality-bar-field-radio` read as a deliberate hero prop rather than a rough procedural sketch?
- Are the material groups separated enough to read at a glance: shell, fascia, metal trim, knobs, handle, and glass?
- Is the speaker face now clean and intentional, or does it still need a more premium treatment?
- Is the spec-camera hero view strong enough to use as the working quality bar for the next rebuilds?
- Are the remaining default preset views acceptable, given that the viewer’s preset sweeps are broader than the spec camera?

## Recommended next order

1. Accept or reject the radio as the quality bar.
2. If accepted, derive the next prop or vehicle from the same review discipline: silhouette, staged render, then detail.
3. If rejected, keep iterating this single anchor until the render quality is unambiguous.
