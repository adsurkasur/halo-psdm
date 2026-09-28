---
status: approved-not-started
last_verified: 2026-09-28
audience: maintainers-and-ai
sensitivity: internal
---

# Planned Change: Serve Halo PSDM at `/app/halo-psdm` (Next.js Multi-Zones)

## Why

The owner approved serving every ARSC app from **one domain**. A new repo, `adsurkasur/arsc-home`, is the ARSC company profile and the main zone. It rewrites `/app/halo-psdm/*` to this app's deployment. Halo keeps its own repo, Vercel project, and Supabase usage. It only needs `basePath: "/app/halo-psdm"` plus fixes for paths that bypass Next's basePath handling.

The canonical cross-repo runbook lives in arsc-home: `docs/MULTI_ZONES_RUNBOOK.md` and `docs/ECOSYSTEM.md`. The decisions are arsc-home `logs/DECISION_LOG.md` DEC-009…DEC-011 and this repo's DEC-003.

## Owner decisions that affect Halo

- **SSO accepted.** On one origin, Halo and Leaderboard share the default `sb-<ref>-auth-token` cookie (path `/`). One login works for both, and logout from one logs out the other. No auth code changes are needed for this.
- **Freeze interpretation.** basePath is a deployment change, not a feature expansion, so the September freeze in `MAINTAINER_GUIDE.md` is not violated. All verification commands must still pass.
- **Back link.** Add a small `<a href="/">ARSC</a>` to the app header. It is a plain anchor because this is a cross-zone hard navigation.
- **Old URL.** After the rewrite is proven, `halo-psdm.vercel.app/*` 308-redirects to `<domain>/app/halo-psdm/*` through a `has: host` rule in `vercel.json`. The rewrite targets a separate zone alias, so proxied requests never hit the redirect.

## Required code changes (audit 2026-09-28, commit `65342a0`)

Line numbers may drift, so re-grep before editing.

| # | Where | Change |
|---|---|---|
| 1 | new `src/lib/base-path.ts` | `export const BASE_PATH = "/app/halo-psdm"` and `withBase(path)`. This is the single source; do not scatter the string. |
| 2 | `next.config.ts` | `basePath: BASE_PATH` |
| 3 | `src/App.tsx:228` | `<BrowserRouter basename={BASE_PATH}>`. Existing ~27 `navigate("/…")` and ~13 `to="/…"` are basename-relative and stay unchanged. |
| 4 | `"/api/secure/…"` strings (25 occurrences) | Route them through `withBase()`. The central helper is `callSecureApi` in `src/contexts/DataContext.tsx` (~194). Direct callers: `AuthContext.tsx`, `views/ProfilePage.tsx`, `views/sender/ChatRoom.tsx`, `views/sender/ReportForm.tsx`, `views/admin/AdminManagement.tsx`, `views/admin/AdminChatQueue.tsx`. Update the mocks in `src/test/setup.ts` to match. |
| 5 | `src/views/NotFound.tsx:16` | `<a href="/">` → basename-aware link (or the ARSC back link). |
| 6 | `src/contexts/AuthContext.tsx:493`, `src/views/LoginPage.tsx:189` | `${window.location.origin}/login` → `${window.location.origin}${BASE_PATH}/login` |
| 7 | `src/app/layout.tsx:5-8` | Set `NEXT_PUBLIC_SITE_URL` to the new domain. Check that canonical/OG URLs resolve under basePath. |
| 8 | Header component | Add the ARSC back link. |

`src/app/api/secure/**` route handlers need no change, because Next mounts them under basePath automatically. There is no middleware/proxy, manifest, or service worker in this repo.

## Operator actions (owner, not an agent)

- Supabase Auth → URL configuration: add `https://<domain>/app/halo-psdm/login` and the recovery variant. Keep the old URLs until the 308 is live.
- Vercel: add a zone alias (e.g. `arsc-halo-psdm-zone.vercel.app`) and set arsc-home `ZONE_HALO_PSDM_URL` to it.

## Verification

```powershell
bun install --frozen-lockfile
bun run lint
bun run test
bun run test:contract
bun run build
```

Then, on a preview:
- Open `https://<preview>/app/halo-psdm` directly, then through the arsc-home preview rewrite.
- Log in, submit a report, open chat, and refresh a deep route (it must not 404).
- The recovery email link lands on `/app/halo-psdm/login?recovery=1`.
- Log in to Halo, open `/app/leaderboard`, and confirm you are already logged in (SSO).
- The network tab shows no 404s.

Use synthetic accounts only (see `MAINTAINER_GUIDE.md`).

## Rollback

Unset `ZONE_HALO_PSDM_URL` in arsc-home and remove the 308 redirect. The app still works at its alias under `/app/halo-psdm`. For a full rollback, revert the basePath PR.
