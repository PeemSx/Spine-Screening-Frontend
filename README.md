# Spine Screening Frontend

Next.js interface for the Spine Opportunistic Screening research workspace. It provides AP/PA and
LA image queues, prediction overlays, measurement panels, responsive review workflows, and strict
runtime validation of the FastAPI contract.

This application presents screening-support geometry, not diagnoses. Upload only anonymized test
images and keep the clinical-review notice visible whenever results are shown.

## Contributor entry point

Before changing code:

1. Read this repository's generated `AGENTS.md`.
2. When working in the coordinated `Spinal AI` workspace, start at `../docs/README.md` and open
   only the relevant reference or operations document.
3. Inspect the target component or module and its closest Vitest file before expanding scope.

Useful workspace references:

- `../docs/reference/architecture.md`
- `../docs/reference/api-contracts.md`
- `../docs/reference/la-compression-assessment.md`
- `../docs/reference/medical-safety.md`
- `../docs/operations/development.md`

The frontend and API are separate Git repositories. FastAPI OpenAPI is the authoritative HTTP
contract; this repository owns presentation, runtime guards, and generated TypeScript consumers.

## Current product surface

- `/frontal`: AP/PA queue, four-landmark overlay, geometry, and measurement review.
- `/lateral`: LA queue, six-landmark overlay, lateral curvature geometry, and selected-vertebra
  compression morphometry.
- Client-side sequential batch processing with retry, stop, selection, and session-scoped results.
- Responsive queue drawer/sidebar, keyboard-accessible controls, inspection layers, and metric
  tooltips.

LA compression values are research morphometry. The UI may show heights, ratios, signed adjacent
compression rates, geometric morphology, severity ranges, and a review flag, but it must not call
those outputs a fracture diagnosis or definitive Genant grade.

## Requirements

- Node.js 20.9 or newer; the maintained local environment uses Node.js 22
- npm and the committed `package-lock.json`
- A reachable Spine Screening API for live predictions

## Local development

From this repository:

```bash
cp .env.example .env.local
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open:

- Frontal workflow: `http://127.0.0.1:3000/frontal`
- Lateral workflow: `http://127.0.0.1:3000/lateral`

The default `.env.example` sends the same-origin `/spine-api` rewrite to
`http://127.0.0.1:8000`. Prefer the rewrite over exposing a backend host in browser code.

When both repositories are checked out under the workspace, start them together from the parent
directory:

```bash
cd ..
make dev
```

Use `make status` to inspect both repositories and service readiness, and `make stop` to stop only
workspace-managed development processes.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `SPINE_API_BASE_URL` | Next.js server | Backend used by the `/spine-api` rewrite |
| `NEXT_PUBLIC_SPINE_API_BASE_URL` | Browser, optional | Direct API origin; use only when CORS is configured |

Keep local environment files uncommitted. Never place secrets, patient identifiers, radiographs,
or prediction payloads in environment files, logs, fixtures, or documentation.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Turbopack development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run test` | Run the Vitest suite |
| `npm run build` | Create a production build with webpack |
| `npm run start` | Serve a completed production build |
| `npm run generate:api` | Regenerate TypeScript from the OpenAPI snapshot |
| `npm run check:api` | Fail when the generated API schema is stale |

For normal handoff, run:

```bash
npm run lint
npm run typecheck
npm run test
```

For cross-stack changes, use `make verify-fast` from the workspace root instead of validating only
this repository.

## API contract workflow

Do not edit `features/screening/api/schema.generated.ts` by hand.

When backend routes or response schemas change:

1. Stabilize and test the FastAPI contract first.
2. From the workspace root, run `make export-contract`.
3. Update handwritten runtime guards in `features/screening/api/contract.ts` and affected UI code.
4. Add malformed-response and user-visible behavior tests.
5. Run `make check-contract` and `make verify-fast`.

The committed flow is:

```text
FastAPI schemas
  -> Spine-Screening-API/openapi/openapi.json
  -> contracts/spine-screening-api.openapi.json
  -> features/screening/api/schema.generated.ts
  -> handwritten guards and UI consumers
```

Keep additive fields backward-compatible when practical. Reject partially present or malformed
extensions rather than silently interpreting incomplete data.

## Project map

```text
app/
  frontal/                       AP/PA page and focused tests
  lateral/                       LA page and focused tests
features/screening/
  api/                           Client, generated types, guards, and contract tests
  bulk/                          Queue state and shared batch types
  components/                    Upload, queue, overlay, notice, and measurement UI
  hooks/                         Browser lifecycle and queue hooks
  session/                       Projection-specific session providers
contracts/                       Backend OpenAPI snapshot
tests/                           Shared fixtures and test setup
scripts/api-contract.mjs         Generate/check OpenAPI-derived TypeScript
```

Preserve the established responsive layout and accessibility behavior. Use stable candidate IDs
to connect overlays and measurement panels. Keep floating-point coordinates intact and use `—` for
unavailable measurements rather than inventing zeroes.

## Collaboration checklist

- Keep changes narrow and preserve unrelated work in dirty worktrees.
- Add focused tests for runtime guards, queue behavior, accessibility, and clinical wording.
- Never modify generated API types manually.
- Do not log, persist, or transmit uploaded image contents.
- Do not describe detector scores as disease probability.
- Do not infer vertebral level names from detection rank.
- Coordinate backend contract changes before editing frontend consumers.
- Run root verification before handing off cross-repository work.

## Production build

```bash
npm run build
npm run start
```

Set `SPINE_API_BASE_URL` in the server environment so the `/spine-api` rewrite reaches the intended
backend. If `NEXT_PUBLIC_SPINE_API_BASE_URL` is set, its value becomes browser-visible and the API
or gateway must explicitly allow the frontend origin.
