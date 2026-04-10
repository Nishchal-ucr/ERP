# Local development and CI – from repo root
.PHONY: dev ci test-pwa

dev:
	@./start-local-flask.sh

# Production compile gate (TypeScript + Next). Run `npm run lint` separately until ESLint is clean.
test-pwa:
	cd PMR-farm-reporting-pwa && npm ci && npm run build

ci: test-pwa
