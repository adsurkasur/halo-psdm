# Halo PSDM — Complete Repository Context and AI Handoff

- **Prepared:** 2026-08-11 (Asia/Jakarta)
- **Repository:** `F:\My Files\ARSC\halo-psdm`
- **Branch/HEAD at audit:** `main` / `0b09b2a60febcc88fb5cac7362fd68e1cf1634a6`
- **Shared Supabase:** project `arsc` (`jyznguhencjwtzupxjjk`)
- **Remote mutation during documentation:** none

## 1. Product mission

Halo PSDM is the account-based support and case-management application for ARSC PSDM. It exists to replace fragmented personal-channel handling with traceable workflows for:

- member reports/complaints;
- report status and clarification;
- two-way chat;
- appointment intent and WhatsApp handoff;
- admin queue/assignment;
- recap and operational visibility;
- shared member account/profile integration.

The product owner currently considers Halo the most operationally complete of the three ARSC applications. Future work should prioritize stability, regression protection, and shared-period integration rather than unnecessary redesign.

## 2. Current status in one sentence

Halo implements the main sender/admin/PH workflows, shared Supabase Auth and Rapor identity linking, avatar synchronization, retained chat lifecycle, isolated CI/E2E, and was operator-reported as passing production login/profile/reports/chat after Vercel integration cleanup; this documentation pass did not independently mutate or retest production.

## 3. Technology

Current `package.json`:

- Next.js 16.3 host
- React 18.3
- TypeScript
- Bun 1.3.10 package/runtime workflow
- Tailwind CSS and Radix/shadcn UI
- Supabase SSR/JS
- TanStack Query
- React Router route graph hosted inside Next catch-all
- Vitest/Testing Library
- Playwright

Commands:

```text
bun run dev
bun run lint
bunx tsc --noEmit
bun run test
bun run test:contract
bun run build
bun run test:e2e
```

## 4. Runtime architecture

The existing React Router application is hosted through Next App Router compatibility entries:

```text
src/app/layout.tsx
src/app/[[...slug]]/page.tsx
src/app/[[...slug]]/client.tsx
```

Feature navigation lives in the client route graph rather than one filesystem route per view. Do not assume the absence of an App Router folder means a page does not exist.

Major layers:

```text
src/
  app/api/secure/       authenticated server mutation routes
  components/           shared UI and layout
  contexts/
    AuthContext.tsx     Auth session, profile sync, update, role
    DataContext.tsx     reports/chat/appointments/notifications state
  data/domain.ts        domain types
  lib/supabase/         clients, environment, secure-route helpers
  views/
    sender/             report, chat, appointment/member flows
    admin/              dashboard, reports, chat, recap, management
    LoginPage.tsx
    ProfilePage.tsx

supabase/
  bootstrap.sql         initial schema; not proof of final remote policy state
  migrations/           RLS and lifecycle hardening
  verification/         chat pre/post/guard checks

tests/
  unit/component
  e2e/                  local isolated Supabase browser flow
```

## 5. Roles and authorization semantics

Repository product language uses:

- **Sender/member:** submits reports, chats, appointment requests.
- **HR/admin:** handles authorized operational functions according to route/data guards.
- **PH:** higher administrative authority for relevant management/verification paths.
- **Super Admin:** older documentation uses this conceptual label; inspect current `public.users.role`, route guard, and UI code for exact effective values.

Critical cross-system distinction:

- Halo `PH`/`HR` is an operational Halo role.
- Leaderboard `admin` is stored separately in Leaderboard `user_roles`.
- Rapor has no normal account role today.
- A person can be Halo PH and Leaderboard admin, but one does not automatically grant the other.
- Future PH Journey eligibility must not be inferred from Leaderboard admin.

Authorization must be enforced in server routes and RLS/RPCs, not only by hiding navigation.

## 6. Shared account and identity model

Halo and Leaderboard consume the same Supabase Auth project.

### Account

- canonical key: `auth.users.id`;
- email/password storage: Supabase Auth only;
- password changes affect credentials used by both apps;
- browser sessions are separate across the Halo and Leaderboard domains.

### Halo profile

- projection: `public.users.id = auth.users.id`;
- owns operational role, WhatsApp, active state, Halo-specific profile behavior;
- consumes canonical Rapor identity after link;
- owns avatar editing in the shared contract.

### Rapor link

`src/app/api/secure/profile/link-rapor/route.ts`:

- requires an authenticated Halo user;
- validates a supplied Rapor code using the shared server-side pepper;
- resolves `rapor_access_codes`/reference data;
- calls `link_arsc_account_from_reference`;
- does not store the raw access code;
- returns a controlled canonical identity response.

### Avatar

`src/app/api/secure/profile/avatar/route.ts`:

- accepts image files only;
- enforces a 5 MB limit and supported extensions;
- uploads to a profile bucket;
- calls `set_shared_profile_avatar` so the Leaderboard projection can receive the same URL;
- removes the newly uploaded object when the database update fails.

Shared identity contract SHA-256 at audit:

`B53B7BFEFE990B65D83C78F92ABEA3A7BD92509152F2C57BED2831020BEE1E39`

The file is identical in Halo, Leaderboard, and Rapor.

## 7. Main user experiences

### Login/profile

- Supabase password login/sign-up in `AuthContext`;
- secure profile synchronization route;
- profile editing for allowed operational fields;
- avatar crop/upload;
- Rapor identity link;
- account deletion with explicit confirmation.

Verified canonical identity fields must not become freely editable through Halo profile UI after link.

### Reports

Member:

- create report with validated category, urgency, and chronology;
- upload supported attachment;
- view own reports and detail/history;
- participate in report-linked clarification.

Admin:

- list and open reports;
- update urgency/status through secure routes;
- preserve status history;
- open a report-linked clarification session;
- view report/member identity snapshots.

### Chat

- member can start a normal or report-linked session;
- admins can see queue and assign sessions;
- participants exchange text/media;
- closed sessions cannot receive new messages;
- sessions can be hidden only through controlled lifecycle behavior;
- history is designed to remain auditable.

### Appointments

- member selects an admin/contact;
- appointment intent is recorded;
- user can continue to WhatsApp;
- admin can track status;
- immediate duplicate behavior is guarded in the product flow.

### Recap/admin management

- operational dashboard;
- report distribution/trends;
- appointment tracking;
- admin roster/availability/profile administration;
- user verification where PH authority is required.

## 8. Secure API inventory

All listed routes are under `src/app/api/secure/` and should authenticate server-side through shared helpers.

### Authentication/profile

- `auth/sync-profile`: creates/repairs/reads Halo profile projection and reports diagnostic stage/path.
- `auth/verify-user`: PH-only user verification path.
- `profile/avatar`: controlled image upload and shared avatar update.
- `profile/link-rapor`: access-code identity link.
- `profile/delete-account`: explicit confirmation and Auth user deletion path.

### Reports

- `reports`: create a report.
- `reports/attachments`: upload attachment with type/size validation.
- `reports/[reportId]`: guarded deletion behavior.
- `reports/[reportId]/status`: admin status update plus history.
- `reports/[reportId]/urgency`: admin urgency update.

### Chat

- `chat/sessions`: create normal/report-linked session.
- `chat/sessions/[sessionId]/assign`: assign admin.
- `chat/sessions/[sessionId]/close`: controlled close.
- `chat/sessions/[sessionId]`: hide/soft-delete semantics.
- `chat/messages`: guarded text message creation.
- `chat/media`: guarded media upload.

### Appointments

- `appointments`: create and update appointment tracking.

When changing an API route, test unauthenticated, wrong-role, wrong-owner, missing-record, invalid-input, and valid paths.

## 9. Database model

### `users`

Halo profile projection keyed to Auth ID. Contains name/email, unit/biro, position, operational role, avatar, WhatsApp, active state, and timestamps as evolved by migrations.

### `reports`

Case/report record with member ownership, category, urgency, chronology/status, attachments/metadata, and identity snapshots. Later migration permits account deletion while retaining reporter name/email/WhatsApp snapshot.

### `report_status_history`

Audit/history of status changes. Actor may become null after account deletion while the historical event remains.

### `chat_sessions`

Member, assigned admin, optional report link, lifecycle status, timestamps, hidden/closed metadata, and identity snapshots from hardening migrations.

### `chat_messages`

Session messages with sender/media/content/read data and sender identity snapshot. Sender account deletion need not erase message history.

### `chat_session_events`

Append-oriented audit events introduced by chat hardening for created/assigned/closed/hidden/restored/migration events.

### `admin_profiles`

Admin-specific profile/availability data and heartbeat presence.

### `appointments`

Member-to-admin appointment request/tracking with identity retention behavior.

### `notifications`

Halo-specific notification rows. This table is separate from the proposed/Stage 7 Leaderboard notification table.

## 10. RLS and schema evidence

Important source sequence:

1. `supabase/bootstrap.sql` creates the original tables and permissive bootstrap policies.
2. `supabase/migrations/03_enforce_rls.sql` removes old policies and defines authenticated ownership/admin policies.
3. later migrations repair admin profile insertion, add presence/indexes/FKs, identity snapshots/account deletion, and chat retention/audit.

Do not inspect only `bootstrap.sql` and conclude the final production RLS is permissive. Conversely, do not claim the final remote policy state solely because a later migration exists locally. A remote catalog preflight is required before risky work.

RLS intent includes:

- users see themselves, while authorized admin information remains discoverable for workflows;
- report owners and admins see reports/history;
- chat participants/admins see sessions/messages;
- appointment participants/admins see records;
- users see their own notifications;
- mutations are further mediated through secure server routes and hardening RPCs where implemented.

## 11. Identity snapshot and account deletion behavior

`07_identity_snapshotting_and_delete_cascade.sql` is designed to preserve meaningful historical context:

- reports copy reporter identity fields;
- report `user_id` becomes nullable and uses `ON DELETE SET NULL`;
- status actor can become null;
- report-linked history remains related;
- chat session participant/admin and message sender can become null while snapshots retain display identity;
- appointment actors can become null;
- per-user notifications/admin profiles are cleaned with account deletion.

This design expresses an important system principle: delete an account identity where required, but do not silently erase organizational case history.

## 12. Chat retention hardening

`08_chat_history_retention_and_audit.sql` adds:

- hidden/closed invariants;
- session/message identity snapshots;
- chat session event audit table;
- controlled assign, close, hide, restore functions;
- prevention of unaudited direct state transitions;
- prevention of destructive history deletion/event mutation;
- participant/admin RLS for audit events.

Operational runbook requires:

- managed Supabase recovery point;
- separate logical roles/schema/data dumps;
- read-only precheck;
- one atomic migration;
- postcheck and guard test;
- application deployment only after DB verification;
- controlled UI smoke.

Important status boundary: this repository contains the migration and runbook, but this documentation pass did not find a Leaderboard-style preserved remote closeout proving the current production execution. Re-check remote markers/postcheck before depending on every hardening invariant.

## 13. CI/CD

`.github/workflows/ci.yml` triggers on main/master/develop pushes and pull requests.

### Quality

- Node 24;
- Bun 1.3.10;
- frozen lockfile install;
- shared identity contract;
- lint;
- TypeScript no-emit;
- unit/component tests.

### Build

- requires quality;
- restores Next cache;
- builds Next application;
- verifies `.next/BUILD_ID`.

### Isolated E2E

- starts Supabase CLI 2.113.0 locally;
- refuses an API URL other than `127.0.0.1:55321`;
- exports only local generated keys;
- applies schema-only fixtures and chat migration;
- seeds CI-only accounts/records;
- builds and runs Chromium Playwright;
- uploads report;
- stops local Supabase without backup.

Coverage listed by the repository:

- report-linked clarification continuity;
- appointment tracking;
- attachment modal behavior;
- sender/PH two-way message exchange;
- route guard for HR vs PH.

### Security

- critical dependency advisories block;
- unresolved high tooling advisories are reported as warnings.

Production credentials must never be used for CI E2E.

## 14. Environment contract

Public/client:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- supported browser-safe anon/publishable key.

Server-only:

- Supabase integration secret/service-role alias as supported;
- `RAPOR_ACCESS_CODE_PEPPER`;
- optional Postgres integration variables.

E2E-only:

- role-specific test email/password variables;
- target report ID.

Rules:

- Vercel integration-managed variables are preferred over manually duplicated values;
- pepper is one Sensitive Shared Environment Variable linked to all three apps;
- no server key may use a `NEXT_PUBLIC_` prefix;
- environment changes require redeployment;
- E2E values must be isolated/test-only.

## 15. Production evidence boundary

Operator reported after Vercel–Supabase integration cleanup:

- redeploy ready;
- login passed;
- profile passed;
- reports/history passed;
- chat passed;
- test used one PH account.

This is useful operational evidence, but it does not cover:

- non-PH sender end-to-end behavior in the same test;
- every route guard;
- account deletion recovery;
- chat restore/hide audit postconditions;
- multi-account race/concurrency;
- current remote schema fingerprints.

Use isolated E2E and a narrow production smoke matrix when a shared contract changes.

## 16. Relationship with other products

### Rapor

- Halo can link an account using Rapor access-code evidence.
- Rapor provides canonical name/unit/position.
- Halo preserves its own role/WhatsApp/operational fields.
- Halo does not read full private Rapor payloads.

### Leaderboard

- same Auth account and credentials;
- shared canonical identity link;
- avatar updates can project to Leaderboard;
- Leaderboard admin role is independent;
- Halo does not own competition scoring or participation review.

### Future period/archive work

Halo will need a period-aware archive policy for reports/chat/appointments, but identity continuity must survive periods. Do not add a Halo-only period ID before a cross-system period contract is agreed.

## 17. Current product direction

The owner has no immediate Halo feature complaint and considers it operational. Recommended priority:

1. protect existing flows;
2. close any remote-evidence gap for chat hardening;
3. keep dependencies/current CI healthy;
4. participate in shared period/archive design;
5. add cross-app features only through versioned contracts.

Avoid UI churn that risks report/chat reliability without a concrete user outcome.

## 18. Known risks

1. No current preserved remote closeout was found for chat hardening in this documentation pass.
2. Shared `public` schema means generic Halo table names can be accidentally treated as unrelated by another repo.
3. Bootstrap SQL is stale relative to later RLS migrations and can mislead a new agent.
4. Next catch-all plus React Router creates two routing mental models.
5. Halo `notifications` and Leaderboard `leaderboard_notifications` are separate systems.
6. Cross-domain browser session sharing is not implemented.
7. Account deletion, history retention, and privacy must be tested together.
8. Production smoke evidence used only one PH account.
9. There is no multi-period archival implementation.
10. Shared identity database objects are deployed from the Leaderboard remote artifact, so Halo depends on another repository's migration evidence.

## 19. Definition of done for Halo changes

A Halo change is done only when:

- sender and applicable admin/HR/PH roles are tested;
- server-route authorization and RLS agree;
- report/chat/appointment history remains intact;
- invalid files/inputs are rejected;
- closed/hidden chat rules remain enforced;
- shared identity and avatar contract tests pass;
- unit, type, lint, build, isolated E2E, and dependency gates pass;
- no production credential enters code/tests/logs;
- any database migration has backup, precheck, atomic apply, postcheck, guard, and closeout;
- Rapor/Leaderboard/shared objects show no unexpected remote drift.

## 20. Read order for the next AI

1. `docs/AI_HANDOFF_COMPLETE_CONTEXT.md`
2. `docs/system-context.md`
3. `docs/system-flows.md`
4. `contracts/arsc-shared-identity.v1.json`
5. `src/contexts/AuthContext.tsx`
6. `src/contexts/DataContext.tsx`
7. `src/lib/supabase/secure-route.ts`
8. relevant `src/app/api/secure/` route
9. relevant view/component/tests
10. migration/runbook when database behavior is involved

## 21. Instructions to the next AI

- Inspect Git status and current code first.
- Treat production data and credentials as unavailable unless explicitly and safely provided through secret tooling.
- Never repeat credentials from prior chats.
- Do not mutate remote Supabase/Vercel without exact approval.
- Do not use `db push` on the shared project.
- Preserve Rapor, Leaderboard, shared identity, and Auth objects.
- Do not conflate Halo PH with Leaderboard admin or future Rapor PH audience.
- Prefer secure server routes/RPCs over direct client mutations.
- Keep historical case data when changing account lifecycle.
- Use current migrations plus remote catalog evidence; do not infer production from bootstrap alone.
