.PHONY: dev serve smoke help

PORT ?= 7777

# Default target
help:
	@echo "Samdin development targets:"
	@echo "  make dev [PORT=7777]  - Start dev server with hot reload (browser-sync)"
	@echo "  make serve            - Simple static server via bunx serve"
	@echo "  make smoke            - Validate showcase spec via CLI"
	@echo "  make help             - Show this help"

dev:
	@PORT=$(PORT) ./scripts/dev.sh

serve:
	@bunx serve -s .

smoke:
	@cd cli && node validate-spec.cjs ../specs/showcase.json
