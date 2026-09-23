# FossFLOW agent notes

## Setup and commands

- Use Node `>=24` (CI and Docker use Node 24). The checked-in `.nvmrc` still says `16.19.0`; do not follow it over the root `package.json` engine requirement.
- Run npm commands from the repository root. For a clean checkout use `npm ci`; the root `package-lock.json` is the workspace source of truth. The nested `packages/fossflow-app/package-lock.json` is an old standalone lockfile, so avoid installing from that package independently.
- `npm run build` is deliberately ordered as `build:lib` then `build:app`. Build the library before the app from a clean checkout; the app consumes the local `fossflow` workspace package.
- `npm run dev` starts only the app. Run `npm run dev:lib` separately when iterating on library code; the root does not start the library watcher, app, and backend together.

## Boundaries and entrypoints

- `packages/fossflow-lib` is the publishable `fossflow` library. Its package entry is `src/index.ts`; `src/index.tsx` is a separate examples/development entry. Rslib emits `dist` (including declarations and `tsc-alias`-rewritten paths).
- `packages/fossflow-app` is the private RSBuild PWA and emits to `packages/fossflow-app/build`. Its active browser entry is `src/index.tsx` → `src/App.tsx`; `src/EditorPage.tsx` also exists but is not imported by the current `App.tsx`, so verify the active component before editing it.
- `packages/fossflow-backend` is an optional, build-free ESM Express server (`server.js`); start it with `npm run dev:backend` when testing filesystem storage.
- Library state is split across the Zustand `modelStore`, `sceneStore`, and `uiStateStore`; app persistence is split between `App.tsx` and `src/services/storageService.ts`. Trace both sides before changing saved-diagram behavior.
- Jest and RSBuild deliberately resolve React from the root `node_modules`; preserve those aliases when changing dependencies to avoid duplicate React instances.

## Verification

- Root `npm test` and `npm run lint` fan out with `--if-present`, but only `fossflow-lib` currently defines those scripts. `lint` there is a TypeScript `--noEmit` check, not ESLint; app/backend have no unit-test or lint scripts.
- Run all library tests with `npm run test --workspace=packages/fossflow-lib -- --runInBand`; focus a file with `npm run test --workspace=packages/fossflow-lib -- --runInBand src/path/to/file.test.tsx`, or add `-t "test name"`. Use `npm run lint --workspace=packages/fossflow-lib` for the library typecheck.
- The test workflow is the executable baseline: Node 24, `npm ci`, `npm test -- --coverage || npm test`, then `npm run build`. Do not assume the root lint command is part of CI.
- E2E tests are separate Python/Selenium tests. From `e2e-tests`, `./run-tests.sh` starts Selenium and manages a Python venv, but expects FossFLOW to be running at `http://localhost:3000`; it does not start the app. A focused test is `pytest tests/test_basic_load.py::test_homepage_loads -v`; override `FOSSFLOW_TEST_URL` or `WEBDRIVER_URL` when needed.

## Runtime and deployment

- The backend enables diagram endpoints only when `ENABLE_SERVER_STORAGE` is exactly `true` (Compose enables it by default). It listens on `BACKEND_PORT` (default `3001`) and writes JSON files under `STORAGE_PATH` (default `/data/diagrams`). `ENABLE_GIT_BACKUP` is currently only reported in logs, not implemented.
- In development, the app probes `http://localhost:3001` only when served from `localhost:3000`; production/Docker uses relative `/api` paths through nginx. `npm run docker:run` uses `compose.dev.yml`, which builds locally, maps `3000:80` and `3001:3001`, and mounts `./diagrams` to `/data/diagrams`; `compose.yml` instead pulls the published image.
- Subpath deployments are compile-time: build the app with `PUBLIC_URL=/FossFLOW/ npm run build:app`. `PUBLIC_URL` controls RSBuild assets, the router basename, translation URLs, and the service-worker path. The service worker is registered only in production builds.
- RSBuild copies `packages/fossflow-app/src/i18n` into the build output; keep translation source and the committed `public/i18n/app` copies consistent when changing locales.

## Project constraints

- FossFLOW is intentionally a privacy-first, browser-based diagram tool. `CONTRIBUTING.md` explicitly places authentication/RBAC, accounts/teams, cloud/SaaS, and database integrations out of scope.
- Releases are semantic-release driven. Use Conventional Commits; `npm run update-version -- <version>` synchronizes the root, library, app, and backend package versions, so do not update only one package manually.
- PRs follow `CONTRIBUTING.md`: the title starts with `fflow: ` followed by a conventional-commit title, and the description includes `I have read the contributing guidelines`. Formatting follows the root `.prettierrc` (semicolons, single quotes, no trailing commas, 80 columns); there is no root format script.
