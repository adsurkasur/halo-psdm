# Halo PSDM

Halo PSDM is a two-way communication platform for ARSC PSDM (2025/2026).
It centralizes member support workflows so reports, chat sessions, and follow-up actions are tracked in one place.

## Context

The system addresses recurring organizational issues from previous periods:

- Reporting flow was too long and fragmented.
- Cases were hard to track without ticket identifiers.
- Chat and follow-up history was scattered across personal channels.
- Admin availability and appointment requests were not structured.

This repository is currently implemented as:

- Next.js 16 (App Router host)
- React 18 + TypeScript
- Bun runtime/package manager
- Tailwind CSS + shadcn-ui
- Vitest + Testing Library

## Core Features

- Report and complaint submission with status lifecycle tracking.
- Sender and admin role-based experience.
- Live chat sessions with assignment and read-state behavior.
- Appointment request directory with WhatsApp redirect flow.
- Admin recap and analytics pages.

## Roles

- Sender: submit reports, open chat, request appointments.
- Admin: process reports, handle chat queue, update statuses.
- Super Admin: manage admin-level assignment and role governance.

## Development

### Requirements

- Bun 1.2+
- Node.js 20+ (for ecosystem compatibility)

### Install

```sh
bun install
```

### Run Locally

```sh
bun run dev
```

### Test

```sh
bun run test
```

### Lint

```sh
bun run lint
```

### Production Build

```sh
bun run build
bun run start
```

### End-to-End Test (Playwright)

Set these environment variables first:

- `E2E_PH_EMAIL`
- `E2E_PH_PASSWORD`
- `E2E_SENDER_EMAIL`
- `E2E_SENDER_PASSWORD`
- `E2E_REPORT_ID`

Then run:

```sh
bun run test:e2e
```

For headed mode:

```sh
bun run test:e2e:headed
```

The scenario validates: PH opens clarification from report detail, sender sees the same report-linked session in Ruang Curhat, and sender can open identical chat session via report detail.

## Route Hosting Note

For migration parity, the existing React route graph is hosted through Next App Router catch-all entry points:

- `src/app/layout.tsx`
- `src/app/[[...slug]]/page.tsx`
- `src/app/[[...slug]]/client.tsx`

This preserves existing feature behavior while running on Next.js 16.

## Documentation

- System context and objectives: `docs/system-context.md`
- User flow summary: `docs/system-flows.md`

Both documents are aligned with project references in `references/`.
