# Halo PSDM System Context

## Organizational Scope

Halo PSDM supports ARSC Divisi PSDM for period 2025/2026 by providing a centralized communication and case-handling platform.

Primary goals:

- Enable secure and responsive two-way communication.
- Accelerate report handling and member support workflows.
- Maintain structured, auditable case history across periods.
- Integrate appointment requests with direct WhatsApp contact flow.

## Problem Statement

The platform is designed to reduce these recurring issues:

- Long and fragmented reporting path before cases reach PSDM.
- Lack of ticket structure and status visibility.
- Communication spread across personal channels.
- Missing operational visibility for admin availability and follow-up.

## Strategic Direction

- Product direction: communication + case lifecycle system.
- Operational direction: measurable handling speed and completion rates.
- Technical direction: Bun-first Next.js 16 architecture for reliability and maintainability.

## Current Technical Baseline

- Framework: Next.js 16
- Runtime and package manager: Bun
- UI: React + Tailwind + shadcn-ui
- Testing: Vitest + Testing Library

## Roles and Responsibilities

- Sender:
  - Create reports
  - Open chat sessions
  - Request appointments
- Admin:
  - Process reports
  - Manage chat queue
  - Update case status and notes
- Super Admin:
  - Manage admin roster and role assignment

## Success Indicators

Target indicators adapted from concept references:

- Faster first-response for submitted reports.
- High percentage of cases reaching completion state.
- Complete chat/session history retention.
- Stable operational availability in daily use.
