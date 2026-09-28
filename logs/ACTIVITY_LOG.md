# Activity Log

### [2026-09-28] [Claude Code / Planning + Documentation]
- **Goal**: Document the approved plan to serve Halo PSDM at `/app/halo-psdm` under one ARSC domain (Next.js Multi-Zones, main zone = new repo `arsc-home`), for handoff.
- **Actions**: Read-only audit of basePath readiness at `65342a0` (react-router basename, `/api/secure` strings, auth redirect URLs, metadata). Wrote the migration spec. Added a planned-change section to the maintainer guide. Recorded DEC-003. Replaced the literal `\n` artifacts at the end of `AGENTS.md` and `logs/README.md` with real newlines.
- **Files Modified**: `docs/MULTI_ZONE_MIGRATION.md` (new), `docs/MAINTAINER_GUIDE.md`, `AGENTS.md` (EOF artifact only), `logs/*`.
- **Verification**: Documentation only, no code changed. Re-grepped every referenced path and line (`src/App.tsx:228`, `AuthContext.tsx:493`, `LoginPage.tsx:189`, `NotFound.tsx:16`, 25 `/api/secure` strings in 8 files) against this commit.

### [2026-09-16 18:05] [Claude / Staff DevOps]
- **Goal**: Restore the `CI/CD Pipeline` workflow without relaxing the critical-advisory gate.
- **Diagnosis**: Run `35085137920` (`Dependency Audit` job) failed at `bun audit --audit-level critical` (Security & Dependency Audit): `next@16.3.0` is affected by critical GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4 (fixed in 16.3.3). Lint, type check, build, and isolated E2E jobs in that run were green.
- **Actions**: Raised the `next` floor to `^16.3.3` (`bun.lock` resolves 16.3.5, which also pulls `sharp@0.35.4`). Remaining high advisories (`brace-expansion`, `picomatch`, `js-yaml`) are development-only transitive tooling and stay under the existing non-blocking warning step; `bun update <pkg>` promoted them to new major direct dependencies, so that attempt was reverted rather than committed.
- **Files Modified**: `package.json`, `bun.lock`, `logs/*`.
- **Verification**: `bun install --frozen-lockfile`; `bun audit --audit-level critical` → exit 0; `bun run test:contract` → exit 0; `bun run lint` → exit 0; `bunx tsc --noEmit` → exit 0; `bun run test` → 11/11 pass; `bun run build` → exit 0 with `.next/BUILD_ID`. Supabase-backed E2E left to CI (requires Docker).

### [2026-09-16 17:25] [Antigravity]
- **Goal**: Initialize modular logging system and mandatory agent protocols.
- **Actions**: Created `logs/` directory and established `AGENTS.md`.
- **Files Modified**: `AGENTS.md`, `logs/README.md`, `logs/ACTIVITY_LOG.md`, `logs/DECISION_LOG.md`, `logs/CHANGELOG.md`.
- **Verification**: Git status verified.
