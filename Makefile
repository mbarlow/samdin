.PHONY: dev serve smoke help

PORT ?= 7777

help:
	@echo "Samdin development targets:"
	@echo "  make dev [PORT=7777]  - Start dev server with hot reload (browser-sync)"
	@echo "  make smoke            - Validate showcase spec via CLI"
	@echo "  make help             - Show this help"

dev:
	@PORT=$(PORT) ./scripts/dev.sh

smoke:
	@cd cli && node validate-spec.cjs ../specs/showcase.json
