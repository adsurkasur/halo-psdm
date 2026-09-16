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
