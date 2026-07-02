# NexusForge Evidence Gate Tracker

Use this tracker to close all pending release gates with reproducible evidence.

## Operating Rules

- Run commands from repository root.
- Save outputs to the artifact paths listed below.
- Do not mark a row complete without attached evidence.
- Any failed hard gate blocks external beta release.

## Evidence Storage Convention

- Suggested evidence root: `var/release-evidence/2026-07/`
- Keep one subfolder per gate: `security`, `reliability`, `product`, `ops`, `desktop-release`

## Hard Gate Tracker

| Gate ID | Gate | Required Outcome | Command(s) | Owner | Due Date | Artifact Path | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HG-SEC-01 | Security and Account Integrity | Auth lifecycle and abuse controls validated with no critical failures | `npm run smoke:local`; `npm run age:gate:validate`; `npm run admin:badge:smoke` | Security Lead | 2026-07-05 | `var/release-evidence/2026-07/security/hg-sec-01.txt` | Complete (2026-07-02) |
| HG-SEC-02 | Security and Account Integrity | Audit-sensitive admin and owner paths verified | `npm run admin:badge:smoke`; `npm run ops:doctor:archive` | Security Lead | 2026-07-05 | `var/release-evidence/2026-07/security/hg-sec-02.txt` | Complete (2026-07-02) |
| HG-REL-01 | Performance and Reliability | Reliability soak strict guard passes | `npm run ops:validate:soak:deep:strict:archive`; `npm run ops:validate:soak:history:guard:strict:full` | Platform Lead | 2026-07-06 | `var/release-evidence/2026-07/reliability/hg-rel-01.txt` | Complete |
| HG-REL-02 | Performance and Reliability | Desktop network validation and local release smoke pass | `npm run desktop:network:validate:ci:strict`; `npm run desktop:release:checklist` | Platform Lead | 2026-07-06 | `var/release-evidence/2026-07/reliability/hg-rel-02.txt` | Complete |

## Core Category Gate Tracker

| Gate ID | Category | Required Outcome | Command(s) | Owner | Due Date | Artifact Path | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CG-PROD-01 | Dashboard and Core Product Workflows | Local smoke + feature flows pass without regressions | `npm run smoke:local` | Product Lead | 2026-07-04 | `var/release-evidence/2026-07/product/cg-prod-01.txt` | Complete |
| CG-DSK-01 | Desktop Update and Distribution Readiness | Update manifest, artifact consistency, and release verification pass | `npm run desktop:update:validate:insecure -- --base "https://queens-workshops-protest-russia.trycloudflare.com"`; `npm run desktop:artifact:validate`; `npm run desktop:release:verify:insecure` | Release Lead | 2026-07-04 | `var/release-evidence/2026-07/desktop-release/cg-dsk-01.txt` | Complete (validated on active public base URL) |
| CG-OPS-01 | Operations and Support Readiness | Release doctor and managed validation pass | `npm run ops:doctor:archive`; `npm run pm2:workspace:validate:managed`; `npm run ops:watchdog:summary:guard` | QA and Release Lead | 2026-07-06 | `var/release-evidence/2026-07/ops/cg-ops-01.txt` | Complete (revalidated 2026-07-01) |
| CG-ADM-01 | Admin and Owner Control Readiness | Admin mutation workflows validated and recorded | `npm run admin:badge:smoke`; `npm run smoke:local` | Product Lead | 2026-07-05 | `var/release-evidence/2026-07/admin/cg-adm-01.txt` | Complete (2026-07-02) |

## Production Deployment Readiness Tracker

| Gate ID | Category | Required Outcome | Command(s) | Owner | Due Date | Artifact Path | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PD-ENV-01 | Deployment Env | Deploy env file filled and validated against checklist | `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/desktop-release-deploy-from-env.ps1 -WhatIf` | Release Lead | 2026-07-03 | `var/release-evidence/2026-07/deploy/pd-env-01.txt` | Complete (2026-07-02; distribution via GitHub Pages — persistent base URL https://trhpruductions.github.io/-NEXUSFORGE) |
| PD-REL-01 | Desktop Release Publish | Production desktop release deploy path validated | `npm run desktop:release:deploy:env`; `npm run desktop:update:validate:persistent` | Release Lead | 2026-07-07 | `var/release-evidence/2026-07/deploy/pd-rel-01.txt` | Complete (2026-07-02; desktop:update:validate:persistent PASS against https://trhpruductions.github.io/-NEXUSFORGE; artifact consistency PASS; release checklist all 6 PASS) |

## Scorecard Update Protocol

After each gate evidence bundle is produced:

1. Update `BETA_GO_LIVE_SCORECARD.md` category values.
2. Update `MASTER_RELEASE_DASHBOARD.md` score totals and gate statuses.
3. Add communication log entry in `MASTER_RELEASE_DASHBOARD.md`.

## Completion Definition

- Hard gates HG-SEC-* and HG-REL-* all marked Complete.
- No unresolved Sev-1 blockers.
- Scorecard total at or above 85%.
- Final decision record signed in `MASTER_RELEASE_DASHBOARD.md`.