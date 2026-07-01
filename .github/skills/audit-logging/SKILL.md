---
name: audit-logging
description: 'Enforce audit logging on every NestJS/Prisma service mutation. Use when writing or editing a service Create/Update/Delete (create, update, delete, upsert, updateMany) or any state change (claim, approve, stage transition, reassign, pause, resume, cancel). Guarantees each DB mutation writes an AuditLog row (actionType + actor + before/after details) inside the SAME prisma.$transaction. No unlogged database writes.'
argument-hint: 'the service method / mutation you are adding'
---

# Audit Logging for Service Mutations

Every persistent state change in the backend must be traceable: **what** happened, **who** did it, and the **before/after** snapshot — recorded atomically with the change itself.

## When to Use

- Writing or editing any method in a `*.service.ts` that changes persistent state via Prisma: `create`, `update`, `delete`, `upsert`, `updateMany`, `deleteMany`.
- Any domain action: create application, claim, stage transition, document approval, force-reassign, pause/resume, force-cancel.

## The Rule (non-negotiable)

No DB mutation ships without an `AuditLog` row written **in the same transaction**, capturing:

| Field | Value |
|-------|-------|
| `actionType` | String constant describing the action — `CREATED`, `UPDATED`, `DELETED`, `CLAIMED`, `STAGE_CHANGED`, `APPROVED`, `FORCE_REASSIGNED`, `PAUSED`, `RESUMED`, `FORCE_CANCELLED`. |
| `performedBy` | The actor: `connect: { id: actor.userId }` from `@CurrentUser()`. **Never** derive the actor from the request body. |
| `details` | JSON before/after snapshot of the changed fields. |
| `application` | Audit rows are application-scoped — `applicationId` is required by the schema. |

**Atomicity is the point.** Write `tx.auditLog.create(...)` inline, inside the same `prisma.$transaction` as the mutation, so a rollback discards both. Do **not** call a separate service after the transaction — `AuditLogsService` in this repo is read-only (`findAll`, `getSlaBreaches`) and running outside the `tx` would leave orphaned or missing logs.

## Procedure

1. **Thread the actor through.** The controller passes `@CurrentUser() user: AuthenticatedUser`; the service method signature ends with `actor: AuthenticatedUser`.
2. **Open a transaction:** `return this.prisma.$transaction(async (tx) => { ... })`.
3. **Read current state** for the before-snapshot and/or concurrency guard — `select` only the fields you need.
4. **Mutate with `tx`.** For state-machine transitions use a conditional `where` (compare-and-swap), e.g. `where: { id, currentStage: before.currentStage }`.
5. **Write the audit row** with `tx.auditLog.create(...)` (template below).
6. **Return** the updated entity using the shared `include`/`select` (passwords omitted).
7. **Translate races.** Wrap the transaction in try/catch and convert Prisma `P2025` to a `ConflictException` via `translateRaceError`.

## Template

```ts
async updateSomething(id: string, dto: SomeDto, actor: AuthenticatedUser) {
  try {
    return await this.prisma.$transaction(async (tx) => {
      const before = await tx.visaApplication.findUnique({
        where: { id },
        select: { currentStage: true /* ...fields you mutate... */ },
      });
      if (!before) {
        throw new NotFoundException(`Application ${id} not found`);
      }

      // Conditional where => atomic compare-and-swap; a losing race throws P2025.
      const updated = await tx.visaApplication.update({
        where: { id, currentStage: before.currentStage },
        data: { /* ...changes... */ },
        include: APPLICATION_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } }, // server-derived actor
          actionType: 'UPDATED',
          details: { before, after: { /* changed fields */ } },
        },
      });

      return updated;
    });
  } catch (error) {
    throw this.translateRaceError(error, 'Record changed concurrently; please retry');
  }
}
```

## Completion Checklist

- [ ] Mutation and `tx.auditLog.create` run in the **same** `$transaction`.
- [ ] `actionType` is a descriptive string constant.
- [ ] `performedBy` connects to `actor.userId` (from `@CurrentUser()`, not the body).
- [ ] `details` holds a meaningful before/after snapshot.
- [ ] Concurrency-sensitive writes use a conditional `where` + `P2025` translation.
- [ ] No password fields are returned (`omit`/`select`).

## Anti-Patterns

- Logging **after** the transaction commits, or in `.then()`/`finally` — breaks atomicity.
- Calling an injected `AuditLogsService` to write logs — it is read-only and runs outside the `tx`.
- Deriving the actor from `dto`/request body instead of `@CurrentUser()`.
- Silent `updateMany`/`deleteMany` with no corresponding audit row.

## Reference

Exemplars (`claim`, `transitionStage`, `reassign`, `forceCancel`, `pause`, `resume`): [visa-applications.service.ts](../../../backend/src/visa-applications/visa-applications.service.ts). `AuditLog` model + required fields: [schema.prisma](../../../backend/prisma/schema.prisma).
