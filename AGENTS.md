# Alsasvize — B2B SaaS Visa Application Management

Enterprise workflow platform that moves a customer's visa application through department pools/processes (Sales → Doc → Secretary) with strict RBAC, an immutable audit trail, and direct-to-storage file uploads.

## Monorepo Layout

- [backend/](backend) — NestJS 11 + Prisma 7 + PostgreSQL REST API (mobile-ready). **This is where all current code lives.**
- [frontend/](frontend) — **empty**; Next.js (App Router) + React + Tailwind PWA is planned, not scaffolded.
- [docker-compose.yml](docker-compose.yml) — local-only Postgres + MinIO. Backend/frontend deploy as separate containers (Coolify VPS).

## Essential Commands (run from `backend/`)

| Task | Command |
|------|---------|
| Start infra (Postgres :5433, MinIO :9000 / console :9001) | `docker compose up -d` (repo root) |
| Install (auto-runs `prisma generate`) | `npm install` |
| Dev server (watch, port 3001) | `npm run start:dev` |
| Build | `npm run build` |
| Lint (autofix) | `npm run lint` |
| Unit / e2e tests | `npm run test` / `npm run test:e2e` |
| Create migration after schema edit | `npm run prisma:migrate` |
| Regenerate client after schema edit | `npm run prisma:generate` |
| Open DB GUI | `npm run prisma:studio` |

**Setup gotcha:** copy [backend/.env.example](backend/.env.example) → `backend/.env` and start `docker compose up -d` **before** running Prisma/dev commands. Prisma 7 does not auto-load `.env` at runtime — `ConfigModule` (app) and `dotenv/config` in [backend/prisma.config.ts](backend/prisma.config.ts) (CLI) handle it. Running `npx prisma studio` without a populated `.env` and a running DB will fail.

## Critical Conventions (non-obvious — follow exactly)

### Prisma 7 with a custom client + driver adapter
- Import types/enums from the **generated output**, never from `@prisma/client`:
  `import { Prisma } from '../generated/prisma/client'` and `import { Role, VisaStage } from '../generated/prisma/enums'`.
- Client is emitted to [backend/src/generated/prisma/](backend/src/generated/prisma) (committed). Re-run `npm run prisma:generate` after any [schema](backend/prisma/schema.prisma) change.
- Runtime uses the `@prisma/adapter-pg` driver adapter wired in [backend/src/prisma/prisma.service.ts](backend/src/prisma/prisma.service.ts); models map to snake_case tables via `@@map`.

### Auth & RBAC
- JWT travels in an **HTTP-only cookie** (`ACCESS_TOKEN_COOKIE`), never a Bearer header and never in a response body. See [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts).
- Protect routes with `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.X, ...)`; read the actor via `@CurrentUser() user: AuthenticatedUser` (`{ userId, email, role }`).
- [JwtStrategy](backend/src/auth/strategies/jwt.strategy.ts) re-reads the user from the DB on every request so soft-deleted (`isActive = false`) accounts are rejected instantly.
- Roles: `ADMIN` (God Mode), `SALES`, `DOC`, `SEC`, `CUSTOMER`. On register/onboard the role is **hardcoded to `CUSTOMER`** — never trust a client-supplied role.

### Application state machine
- Flow: `SALES_POOL → SALES_PROCESS → DOC_POOL → DOC_PROCESS → SEC_POOL → SEC_PROCESS → COMPLETED`, plus admin/terminal states `PAUSED` and `CANCELLED`.
- Transitions are **data-driven** by the `CLAIM_CONFIG` and `STAGE_TRANSITIONS` maps in [backend/src/visa-applications/visa-applications.service.ts](backend/src/visa-applications/visa-applications.service.ts). Extend those maps rather than adding `if/switch` chains.
- God Mode (ADMIN only): claim override, force-reassign, force-cancel, pause/resume. Gating rule: an app cannot leave `DOC_PROCESS` while any document is unapproved.

### Atomicity, concurrency & audit
- Every mutation runs in a `prisma.$transaction`. Claims/transitions use a **conditional `where`** (compare-and-swap); a losing race throws Prisma `P2025`, translated to a `ConflictException` via `translateRaceError`.
- **Every** state-changing action writes an `AuditLog` row **inside the same transaction** — `actionType` is a string constant (`CREATED`, `CLAIMED`, `STAGE_CHANGED`, `FORCE_REASSIGNED`, `FORCE_CANCELLED`, `PAUSED`, `SLA_BREACH`, ...) and `details` is a JSON before/after snapshot.

### Real-time events (Socket.io)
- The [EventsGateway](backend/src/events/events.gateway.ts) (namespace `/events`) authenticates every socket with the same JWT (web cookie `ACCESS_TOKEN_COOKIE` or mobile `auth.token`) and drops anonymous connections; non-customers join a `staff` room.
- Emit events **after** the `prisma.$transaction` commits, never inside it, so clients never observe a change that later rolled back. Inject `EventsGateway` into the service and call `emitApplicationClaimed` / `emitStageChanged`; declare new event names as exported constants.
- Set `CORS_ORIGIN` (comma-separated origins) in production to restrict socket connections.

### File storage — zero-payload backend
- Files **never** flow through the API. Mint presigned URLs via [StorageService](backend/src/documents/storage.service.ts) (`createUploadUrl` 15 min, `createDownloadUrl` 5 min); the client PUTs/GETs MinIO directly. Object key: `applications/{applicationId}/{uuid}-{sanitizedName}`.
- Sole documented exception: `POST /auth/onboard` streams the passport through the server via `uploadBuffer` (multipart). Do not add new server-side file passthroughs.

### Boundaries & safety
- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) in [backend/src/main.ts](backend/src/main.ts); validate every DTO with `class-validator`. Multipart routes bypass class-validator — validate those fields manually.
- Never return password hashes — use Prisma `omit: { password: true }` or explicit `select`.
- Required env vars use `config.getOrThrow(...)`; full list in [backend/.env.example](backend/.env.example).

## Architecture Style

- Thin controllers, fat services: controllers wire routing/guards/DTOs only; all business logic + persistence + audit live in the service.
- Production-ready code only: implement real logic (no `// TODO`/placeholder stubs), no fluff comments, keep it optimized.

## Not Yet Implemented (directives to honor when building these)

These are required by the product spec but absent from the codebase today:
- **Real-time (Socket.io):** the authenticated [EventsGateway](backend/src/events/events.gateway.ts) now emits `applicationClaimed` + `stageChanged` post-commit. Still TODO: emit events on **document approval** ([documents.service.ts](backend/src/documents/documents.service.ts)) and on pause/resume/reassign/cancel.
- **SLA cron:** [SlaMonitorService](backend/src/sla/sla-monitor.service.ts) runs a `@nestjs/schedule` cron every 5 min that auto-reverts stalled `SALES_PROCESS` apps to `SALES_POOL` (env `SLA_SALES_PROCESS_HOURS`, default 2h): atomic mutation + `SLA_BREACH` audit in one `$transaction`, then emits `stageChanged` + `slaBreached` post-commit. Extend the `rules` array for DOC/SEC. The 48h `SLA_THRESHOLD_HOURS` dashboard query still lives in [audit-logs.service.ts](backend/src/audit-logs/audit-logs.service.ts).
- **OCR:** passports are queued with `ocrStatus: PENDING`, but no processor consumes the queue.
- **Frontend:** scaffold the Next.js App Router + Tailwind PWA in `frontend/` (React, TypeScript, shadcn/ui, Lucide, socket.io-client), authenticating against the cookie-based API. Follow the frontend conventions in [.github/instructions/frontend.instructions.md](.github/instructions/frontend.instructions.md), build UI with the [frontend-design-system skill](.github/skills/frontend-design-system/SKILL.md), and use the [Frontend Architect agent](.github/agents/frontend-architect.agent.md) for the work.
