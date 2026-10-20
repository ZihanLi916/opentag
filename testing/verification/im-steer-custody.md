# Steered IM custody without terminal reports

Date: 2026-10-20. Original base: `af9705a345b6ce1dde47e7870cfc450d1564edf2`.
Retention follow-up base: `8381cab43d5ef253e160f0ca28520fe490827c34`.
Contract: [IM delivery claim queries](../../docs/system/messaging/im-delivery-claim.md).
All inputs are synthetic. PostgreSQL runs in local testcontainers; no user Computer, model,
external message, or production operation is involved.

## Regression cases

- Every existing recovery observation, including the five former stale-failure codes and an
  unknown code, preserves all steered child fields when the accepted target has no terminal report.
- Closing the target Session, even with a replacement Session available, preserves custody.
- Real PostgreSQL tests accept and steer through the custody store, then exercise the worker
  against a reconcile transport failure or a disconnected ConnectionRegistry entry. Diagnostics
  still record the failure. Repeated expiry sweeps through one simulated day preserve the entire
  root and child rows. A separate ended-Session case exercises the same maintenance path.
- Re-registering the original instance through ConnectionRegistry allows a live Session to
  reconcile as busy and the original owner to submit its completed report. An ended Session also
  accepts that original report. A different instance or Turn cannot release the children.
  Report replay is idempotent; completed children stay steered without another delivery or steer.
- Valid failed, cancelled, and unknown reports recover children once in ingress order. Report
  replay, a conflicting completed report, and later janitor sweeps cannot recover them again.
  A pre-existing recorded non-completed report also remains recoverable by the janitor.
- Real PostgreSQL cases end the Session, move delivery and message history 91 days past the default
  retention cutoff, and run the production expiry plus retention maintenance. An accepted,
  unreported target still retains both steered child deliveries and their messages. Delayed failed,
  cancelled, and unknown reports each recover both children exactly once. A completed-target control
  proves the same aged steered history remains retention-eligible and is removed by bounded sweeps.

Before the production change, the new unit cases failed six times (five error codes and Session
closure), and all three PostgreSQL disconnect/Session cases failed because maintenance requeued
children. Before the retention follow-up, all three 91-day delayed-report cases failed because
maintenance deleted both children. After protecting only children of accepted-unreported targets,
the focused suites pass while the completed control remains bounded.

Focused commands:

```sh
pnpm --filter @opentag/server exec vitest run src/__tests__/im-delivery-worker.test.ts src/__tests__/im-delivery-retry.test.ts src/__tests__/im-delivery-recovery.test.ts src/__tests__/im-delivery-janitor.test.ts
pnpm --filter @opentag/server exec vitest run src/__tests__/integration/im-steered-delivery-recovery.test.ts --maxWorkers=1
```

## Validation

- Focused unit tests: 86 passed in four files.
- Focused PostgreSQL integration: 20 passed.
- `pnpm check`, `pnpm build`, and `pnpm typecheck` passed.
- Full PostgreSQL integration: 802 passed in 61 files.
- Agent Runtime coverage: 642 passed, with 100% statements, branches, functions, and lines.
- `pnpm test`: 691 script tests and 10,017 workspace tests passed; 22 existing skips.
  Server tests executed; unchanged workspace tasks reused matching Turbo cache entries.

## Accepted limitation

A missing terminal report can retain accepted custody indefinitely, including after Session
closure. Existing diagnostics remain; abandonment and ownership fencing need a separate policy.
This change adds no schema, queue, protocol, or automatic re-execution path. Local verification
does not establish deployment or production acceptance.
