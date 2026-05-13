# Automated Tests Commands

Complete reference guide for running all automated test suites in Happy Colors project.

---

## Quick Start

**For quick validation (smoke tests):**
```bash
npm run test:e2e:smoke
```

**For full CI validation with coverage:**
```bash
npm run test:ci
npm run test:e2e:smoke
```

---

## Root Level Commands (run from project root)

### All Tests Combined

```bash
# Run all tests (server + frontend)
npm test

# Run all tests + E2E smoke (full validation)
npm run test:all

# Run all tests with coverage reports
npm run test:coverage

# CI mode - all tests with coverage (used in CI pipelines)
npm run test:ci
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E smoke tests only (tagged with @smoke)
npm run test:e2e:smoke

# Run E2E tests in UI mode (interactive Playwright UI)
npm run test:e2e:ui
```

### Server Tests Only

```bash
# All server tests
npm run test:server

# Server unit tests
npm run test:server:unit

# Server integration tests
npm run test:server:integration

# Server tests with coverage
npm run test:server:coverage

# Server tests in CI mode with coverage
npm run test:server:ci
```

### Frontend Tests Only

```bash
# All frontend tests
npm run test:frontend

# Frontend unit tests
npm run test:frontend:unit

# Frontend unit tests with jsdom environment
npm run test:frontend:unit-jsdom

# Frontend API tests
npm run test:frontend:api

# Frontend component tests
npm run test:frontend:components

# Frontend tests with coverage
npm run test:frontend:coverage

# Frontend tests in CI mode with coverage
npm run test:frontend:ci
```

---

## Server Tests (run from `server/` directory)

```bash
# Run all server tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Tests with coverage report
npm run test:coverage

# CI mode with coverage
npm run test:ci
```

---

## Frontend Tests (run from `happy-colors-nextjs-project/` directory)

```bash
# Run all frontend tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Unit tests only (default environment)
npm run test:unit

# Unit tests with jsdom environment
npm run test:unit-jsdom

# API tests
npm run test:api

# Component tests
npm run test:components

# Tests with coverage report
npm run test:coverage

# CI mode with coverage
npm run test:ci
```

---

## Recommended Test Workflows

### During Development

**Watch mode for specific area:**
```bash
# For server changes
cd server && npm run test:watch

# For frontend changes
cd happy-colors-nextjs-project && npm run test:watch
```

### Before Committing

**Quick smoke test:**
```bash
npm run test:e2e:smoke
```

**Full validation:**
```bash
npm run test:ci
npm run test:e2e:smoke
```

### For Phase Validation (Dependency Remediation)

**After Next.js upgrade (Phase 2):**
```bash
cd happy-colors-nextjs-project && npm test
cd happy-colors-nextjs-project && npm run build
npm run test:e2e:smoke
```

**After GCS upgrade (Phase 4):**
```bash
cd happy-colors-nextjs-project && npm test
cd server && npm test
```

**After server runtime updates (Phase 5A/5B):**
```bash
cd server && npm test
npm run test:e2e:smoke
```

**Final validation (Phase 7):**
```bash
cd server && npm test
cd happy-colors-nextjs-project && npm test
cd happy-colors-nextjs-project && npm run build
npm run test:e2e:smoke
```

---

## Test Coverage

To generate and view coverage reports:

```bash
# Full coverage for all packages
npm run test:coverage

# Server coverage only
npm run test:server:coverage

# Frontend coverage only
npm run test:frontend:coverage
```

Coverage reports are typically generated in:
- `server/coverage/` - server coverage
- `happy-colors-nextjs-project/coverage/` - frontend coverage

---

## CI Pipeline Commands

For automated CI/CD pipelines:

```bash
# This runs all tests with coverage (recommended for CI)
npm run test:ci

# Then add E2E smoke tests
npm run test:e2e:smoke
```

---

## Test Framework Details

- **Frontend:** Vitest with React Testing Library and jsdom/node environments
- **Server:** Vitest with supertest and mongodb-memory-server
- **E2E:** Playwright

For more details, see:
- `happy-colors-nextjs-project/vitest.config.ts` - frontend Vitest config
- `server/vitest.config.ts` - server Vitest config
- `e2e/playwright.config.js` - E2E Playwright config
