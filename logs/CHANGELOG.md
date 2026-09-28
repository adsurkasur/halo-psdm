# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
### Added
- Optional Multi-Zones support: set `NEXT_PUBLIC_BASE_PATH=/app/halo-psdm` to serve under the shared ARSC domain (off by default). `← ARSC` back link when active.
- Planned-change spec `docs/MULTI_ZONE_MIGRATION.md` for serving Halo at `/app/halo-psdm` on the shared ARSC domain (documentation only).
- Modular logging protocol (`logs/` directory with activity, decision, and changelog files).
- Mandatory `AGENTS.md` guidelines for AI agents and contributors.

### Security
- Upgraded `next` to >=16.3.3 (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4).
