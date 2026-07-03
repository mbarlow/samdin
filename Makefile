.PHONY: dev serve smoke test lint schema-check shot review golden golden-update help

PORT ?= 7777

help:
	@echo "Samdin development targets:"
	@echo "  make dev [PORT=7777]  - Start dev server with hot reload (browser-sync)"
	@echo "  make serve            - Plain static server (bunx serve, no hot reload)"
	@echo "  make smoke            - Validate a hero anchor spec via CLI (fast check)"
	@echo "  make test             - Validate every spec and prefab on disk"
	@echo "  make lint             - Quality-rule lint (--strict) over specs (advisory)"
	@echo "  make schema-check     - Validate specs against the JSON Schema (needs cli deps)"
	@echo "  make shot SPEC=... [OUT=... VIEW=...] - One fast render of a spec (iteration loop)"
	@echo "  make review SPEC=...  - Render the review shot-set (6 shaded + 2 wireframe + stats)"
	@echo "  make golden           - Fingerprint-check the quality-bar anchors (tris/verts/objects vs goldens/)"
	@echo "  make golden-update    - Re-bless the anchor goldens after an intended builder change"
	@echo "  make help             - Show this help"

dev:
	@PORT=$(PORT) ./scripts/dev.sh

serve:
	@bunx serve -s .

smoke:
	@node cli/validate-spec.cjs specs/quality-bar-field-radio.json

test:
	@node cli/validate-spec.cjs specs/*.json prefabs/*.json

lint:
	@node cli/validate-spec.cjs --strict specs/*.json

schema-check:
	@node cli/schema-check.js specs/*.json

OUT ?= /tmp/samdin-shot.png
VIEW ?= threeQuarter
shot:
	@node cli/shot.js $(SPEC) $(OUT) $(VIEW)

review:
	@node cli/review-shots.js $(SPEC)

golden:
	@node cli/golden.js

golden-update:
	@node cli/golden.js --update
