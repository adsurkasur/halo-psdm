---
status: active
last_verified: 2026-08-15
audience: maintainers-operators-and-ai
sensitivity: restricted
---

# Halo PSDM Maintainer Guide

## Product and data boundary

Halo PSDM handles sensitive member support workflows: reports, chronology, urgency/category, attachments, clarification, independent chat sessions, appointments, status history, administration, and recap. Treat message bodies, report text, attachments, contact details, appointments, identity links, and audit history as restricted.

Halo shares Supabase Auth and the versioned ARSC identity contract with Leaderboard. This does not authorize Leaderboard/Rapor access to Halo cases or chat, nor Halo access to private Rapor evaluation data.

## Architecture orientation

- Next.js 16 hosts the existing client route graph through `src/app/[[...slug]]`.
- `src/contexts/AuthContext.tsx` and `DataContext.tsx` coordinate identity/data state.
- `src/views/sender/` and `src/views/admin/` contain role-oriented screens.
- `src/app/api/secure/` is a security-sensitive server boundary.
- `supabase/migrations/` contains database history; `supabase/verification/` contains chat-hardening checks.
- `contracts/arsc-shared-identity.v1.json` is a cross-system dependency.
- `docs/chat-history-retention-recovery.md` and `docs/chat-hardening-deployment-runbook.md` govern retention-related operations.

## Current evidence boundary

The application and test suites cover reports, clarification, chat, attachments, role guards, appointments, sender/admin views, and shared identity behavior. Repository migration `08_chat_history_retention_and_audit.sql` and its runbook exist. The actual remote execution state of that migration was not re-proven by the 2026-08-15 documentation pass. Do not state that the production policy is active until fresh precheck/postcheck evidence exists.

## Local verification

The package declares Bun 1.3.10 and Node 24 or newer.

```powershell
bun install --frozen-lockfile
bun run lint
bun run test
bun run test:contract
bun run build
```

Run `bun run test:e2e` only in the documented isolated/local environment with dedicated test accounts. Never reuse production user credentials or allow CI cleanup to target production.

## Database and release protocol

1. Confirm the target project and exact source commit.
2. Preserve a backup/rollback path.
3. Run `supabase/verification/08_chat_hardening_precheck.sql` read-only and inspect unexpected states.
4. Obtain explicit approval before applying the migration.
5. Run postcheck and guard test; verify roles, policies, retention fields, deletion/restore behavior, and shared identity invariants.
6. Run critical browser flows using synthetic accounts.
7. Save a redacted closeout; never include messages, attachments, passwords, or tokens.

## Change rules

- Preserve sender/admin/super-admin least privilege and route guards.
- Treat close/hide/restore/delete as distinct states and test retention semantics.
- Keep identity snapshots and cascade/restrict behavior consistent with the documented migration.
- Any shared identity change requires contract tests in Halo, Leaderboard, and Rapor consumers.
- External WhatsApp handoff is a user-visible side effect; test links/numbers safely and do not message real people without authorization.
- Do not expand features while September release-critical verification remains open unless the product owner changes priorities.

## Local verification note (2026-08-15)

Lint, 3 Vitest files/11 tests, and the shared identity contract passed. Build correctly failed when Supabase variables were absent, then passed using the repository CI workflow's non-secret local placeholder values. No E2E, production accounts, or remote migration checks were run.
