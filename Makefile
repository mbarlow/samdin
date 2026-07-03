.PHONY: dev serve smoke test lint schema-check golden golden-update help

PORT ?= 7777

help:
	@echo "Samdin development targets:"
	@echo "  make dev [PORT=7777]  - Start dev server with hot reload (browser-sync)"
	@echo "  make serve            - Plain static server (bunx serve, no hot reload)"
	@echo "  make smoke            - Validate a hero anchor spec via CLI (fast check)"
	@echo "  make test             - Validate every spec and prefab on disk"
	@echo "  make lint             - Quality-rule lint (--strict) over specs (advisory)"
	@echo "  make schema-check     - Validate specs against the JSON Schema (needs cli deps)"
	@echo "  make golden           - Regression-check the quality-bar anchors"
	@echo "  make golden-update    - Rewrite the anchor goldens from current build"
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

golden:
	@node cli/golden.js

golden-update:
	@node cli/golden.js --update
