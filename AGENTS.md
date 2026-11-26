<!-- GENERATED FILE. DO NOT EDIT DIRECTLY.
Sources: workspace AGENTS.md and docs/operations/agent-overlays/frontend.md
source-sha256: 68313c3b6c473924fdc7d7831c53e24e5debf576882899347a4e7432a3687e14
Regenerate from the workspace root with: make sync-context
-->

# Spine Screening Workspace Instructions

## Mission and scope

This workspace contains a research-only spine screening system. The active products are
`Spine-Screening-API` and `Spine-Screening-Frontend`. Treat
`Spine-Opportunistic-Screening`, `SOS-Colab`, and `From Phu` as read-only references unless the
user explicitly includes research or training work in scope.

The system produces screening-support geometry and measurements. Never describe model output as
a diagnosis or claim that it proves scoliosis, fracture, osteoporosis, or another condition.
Uploaded images must be anonymized; never put patient-identifiable data, radiographs, secrets, or
checkpoint tensors in prompts, task records, logs, fixtures, or documentation.

## Context loading

Use progressive disclosure to conserve context:

1. Read this file and the active repository's generated `AGENTS.md`.
2. Read `docs/README.md`, then only the relevant document in `docs/reference/` or
   `docs/operations/`; when an active work plan/task packet exists for the task, read that packet
   too. Archive material remains opt-in and should be loaded only when explicitly needed.
3. Inspect target files and their closest tests with `rg` or `rg --files`.
4. Expand into adjacent modules only when a discovered dependency requires it.

Do not broadly read notebooks, checkpoints, datasets, generated builds, dependency directories,
coverage output, caches, or whole-repository listings. The root documents are canonical; README
files are entry points, not duplicate architecture specifications.

## Agent operating model

One lead agent owns each task. Use no specialist for small isolated work. Delegate only bounded,
independent work where parallelism or domain expertise materially helps, with at most two
specialists running concurrently:

- Backend/model specialist: FastAPI, Pydantic, inference, checkpoints, landmarks, geometry, and
  readiness.
- Frontend specialist: Next.js, React, UI state, overlays, accessibility, and API consumption.
- Contract/verifier specialist: OpenAPI compatibility, cross-stack behavior, tests, and safety
  language.

Concurrent agents must have mutually exclusive file ownership. Serialize tasks that touch the
same files or public contract. For cross-stack changes, stabilize and export the backend OpenAPI
contract before editing frontend consumers. Public API, landmark order, coordinate transforms,
model loading, clinical wording, and cross-repository changes require independent verification.

Use cost-aware model routing when the active Codex runtime supports per-agent model overrides.
Keep planning, integration, high-risk decisions, and final review with the capable lead model
(currently the Sol tier). Prefer the cost-efficient Luna tier at medium reasoning for bounded
implementation tasks. Do not delegate small tasks merely to switch models, and never reduce the
required verification because a cheaper worker performed the implementation. Routine bounded
implementation defaults to Luna. Sol may implement directly only small integration corrections or
work that cannot be safely bounded/high-risk.

Follow the tracked work lifecycle: Discover -> Plan -> Implement -> Verify -> Archive. Keep active
plans and task packets under `docs/work/active/`; archive completed work under
`docs/work/archive/<year>/`, loading archive material only when explicitly needed. Before any
automatic Luna medium-reasoning spawn, run the task-specific `make check-task` readiness gate. Give
workers minimal context rather than a full-history fork, keep at most two concurrent workers with
disjoint file ownership, and have Sol retain planning, integration, and final review. Sol may send
small integration fixes to the worker; unbounded or high-risk work stays with Sol.

Every delegated task must state its goal, acceptance criteria, allowed repositories and files,
required documents, interface impact, validation commands, prohibited actions, and risks. A
specialist handoff contains only changed behavior, changed files, tests run, unresolved risks, and
durable decisions. Do not retain raw reasoning or full command logs.

## Engineering boundaries

- Preserve user changes in dirty worktrees and avoid unrelated rewrites.
- Agents may inspect, edit, and test locally. Do not commit, push, merge, deploy, publish, or
  transmit sensitive data without explicit user authorization.
- Keep frontend and backend as independent Git repositories. The workspace root coordinates them
  but does not absorb their histories.
- FastAPI OpenAPI is the authoritative HTTP contract. Regenerate the frontend schema after route
  or response changes; never hand-edit generated schema files.
- Preserve floating-point coordinates without premature rounding or clamping.
- AP/PA landmark order is TL, TR, BL, BR. LA order is top-left, top-middle, top-right,
  bottom-left, bottom-middle, bottom-right.
- LA Cobb output is four-outer-landmark geometry agreement, not clinical AP/PA Cobb measurement.
- Never add large datasets, checkpoints, generated outputs, environments, or secrets to the root
  coordination repository.

## Validation and handoff

Run the narrowest relevant checks during development, then use root automation before handoff:

- `make check-context` validates generated repository instructions.
- `make check-work` validates work-plan/task-packet structure.
- `make check-task` validates readiness for a specific task before automatic spawning.
- `make check-contract` validates OpenAPI and generated frontend schema drift.
- `make verify-fast` runs normal backend and frontend quality gates.
- `make verify-all` adds production build and container checks; real-checkpoint tests remain
  opt-in through `SPINE_RUN_MODEL_TESTS=1`.

Record only durable architectural decisions in `docs/decisions/`. Final handoffs should lead with
the outcome, name validation performed, identify remaining risk, and avoid pasting generated files
or verbose logs.

---

# Frontend Repository Rules

This repository owns the Next.js screening interface, client-side queue, overlays, measurements,
accessibility, and safe presentation of API results. When this repository is opened inside the
coordinated workspace, read `docs/README.md`, `docs/reference/architecture.md`,
`docs/reference/api-contracts.md`, and `docs/reference/medical-safety.md` when those areas are
relevant.

Use the `/spine-api` rewrite instead of exposing backend hosts in browser code. Types in
`features/screening/api/schema.generated.ts` are generated from FastAPI OpenAPI and must not be
edited manually. Keep runtime response guards and UI-specific domain types handwritten, strict,
and covered by tests.

Preserve the established visual language and responsive behavior. Do not present geometry or
morphology as diagnosis, and keep the clinical-review notice visible when showing results. Never
log or retain uploaded image contents.

Run focused Vitest tests during development. Before handoff run ESLint, TypeScript type checking,
Vitest, and the production build when practical. For API changes, regenerate from the workspace
root and verify both repositories rather than adjusting generated types by hand.
