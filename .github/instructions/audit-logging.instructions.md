---
description: 'Always-on audit-logging + transaction rules for NestJS/Prisma service mutations.'
applyTo: '**/*.service.ts'
---

# Service Mutation Rules

Every Prisma mutation (`create`, `update`, `delete`, `upsert`, `updateMany`, `deleteMany`) in a service **must**:

- Run inside a `prisma.$transaction`, with an inline `tx.auditLog.create(...)` in the **same** transaction. No unlogged DB write ever ships.
- Record `actionType` (string constant, e.g. `CREATED`/`UPDATED`/`DELETED`/`STAGE_CHANGED`), `performedBy: { connect: { id: actor.userId } }` taken from `@CurrentUser()` (never from the request body), and a before/after `details` JSON. Audit rows are application-scoped — `applicationId` is required.
- Use a conditional `where` (compare-and-swap) for state-machine transitions and translate Prisma `P2025` → `ConflictException` (`translateRaceError`).
- Never return password fields — use `omit: { password: true }` or an explicit `select`.

`AuditLogsService` is **read-only** (`findAll`, `getSlaBreaches`) — do not call it to write logs. Full template, checklist, and anti-patterns: [audit-logging skill](../skills/audit-logging/SKILL.md).
