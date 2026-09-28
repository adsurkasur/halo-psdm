# Decision Log (Architecture Decision Records)

### [DEC-001] Adoption of Modular Logging Protocol
- **Date**: 2026-09-16
- **Status**: Accepted
- **Context**: Standardizing change tracking, observability, and auditability across all managed projects for AI agents and human contributors.
- **Decision**: Mandate `logs/ACTIVITY_LOG.md`, `logs/DECISION_LOG.md`, and `logs/CHANGELOG.md` updates across all repositories.
- **Consequences**: Consistent history, reduced context loss during multi-agent handoffs.

### [DEC-002] Patched security floor for Next.js
- **Date**: 2026-09-16
- **Status**: Accepted
- **Context**: CI run `35085137920` blocked on critical Next.js RCE advisories affecting `>=16.0.0 <16.3.3`.
- **Decision**: Declare `next: ^16.3.3` so the manifest cannot resolve a vulnerable release; keep `bun audit --audit-level critical` blocking and the high-level report as a warning.
- **Alternatives rejected**: Lowering the blocking threshold, and `bun update` of transitive dev tooling (it rewrote them as direct dependencies on new major versions).
- **Consequences**: Critical gate green; residual dev-only high advisories remain visible as CI warnings for a follow-up lockfile refresh.

### [DEC-003] Serve Halo under `/app/halo-psdm` on the shared ARSC domain (Multi-Zones)
- **Date**: 2026-09-28
- **Status**: Accepted (not implemented)
- **Context**: The owner wants one domain for all ARSC apps. The new `arsc-home` company-profile repo is the main zone and rewrites `/app/<name>/*` to each app's Vercel deployment.
- **Decision**: Halo sets `basePath: "/app/halo-psdm"` from a single `BASE_PATH` constant, with `BrowserRouter basename`, `withBase()` for `/api/secure` calls and auth redirect URLs, and an "ARSC" back link. The old host 308-redirects after the rewrite is proven. SSO with Leaderboard through the shared same-origin Supabase cookie was accepted by the owner. The September freeze is interpreted as not blocking this, because it is a deployment change and not a feature.
- **Alternatives**: Vercel Microfrontends, subdomains, links only (see arsc-home DEC-009).
- **Consequences**: Supabase Auth redirect allow-list must include the new URLs. Logout is shared with Leaderboard. Spec: `docs/MULTI_ZONE_MIGRATION.md`.

### [DEC-004] basePath is env-driven (off by default)
- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: DEC-003 approved serving Halo under `/app/halo-psdm`. A hard-coded basePath would move production on merge and break the current URL, the react-router routes, and the Supabase auth redirect URLs before arsc-home and the allow-list are ready.
- **Decision**:
  - `basePath` and the router `basename` come from `NEXT_PUBLIC_BASE_PATH`, which is empty by default and validated.
  - `callSecureApi` and the direct secure-API fetches use `withBase()`, and the auth redirect URLs include the base path.
  - Activation is an env change on the deployment, made by the owner following the arsc-home runbook, once the Supabase allow-list is updated.
- **Consequences**:
  - Reversible: unset the env var and redeploy.
  - SSO with Leaderboard on the shared origin, as approved.
  - API route handlers need no change, because Next mounts them under basePath.
