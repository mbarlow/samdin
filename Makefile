.PHONY: dev serve smoke test help

PORT ?= 7777

help:
	@echo "Samdin development targets:"
	@echo "  make dev [PORT=7777]  - Start dev server with hot reload (browser-sync)"
	@echo "  make serve            - Plain static server (bunx serve, no hot reload)"
	@echo "  make smoke            - Validate a hero anchor spec via CLI (fast check)"
	@echo "  make test             - Validate every spec and prefab on disk"
	@echo "  make help             - Show this help"

dev:
	@PORT=$(PORT) ./scripts/dev.sh

serve:
	@bunx serve -s .

smoke:
	@node cli/validate-spec.cjs specs/quality-bar-field-radio.json

test:
	@node cli/validate-spec.cjs specs/*.json prefabs/*.json
