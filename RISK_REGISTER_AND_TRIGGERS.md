# NexusForge Risk Register and Trigger Matrix

This register tracks release risks with measurable trigger thresholds, required actions, and ownership.

## Risk Scoring Model

- Impact: 1 to 5
- Likelihood: 1 to 5
- Risk score = Impact x Likelihood

Priority bands:

- Critical: 20 to 25
- High: 12 to 19
- Medium: 6 to 11
- Low: 1 to 5

## Active Risk Register

| ID | Risk | Domain | Impact | Likelihood | Score | Trigger Threshold | Owner | Mitigation | Contingency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | Startup regression on desktop | Performance | 5 | 4 | 20 | Cold start p95 > 5.0s for 2 consecutive builds | Platform Lead | Profile startup phases, remove blocking work from boot path, enforce CI startup budget gate | Freeze feature merges to desktop runtime until p95 restored |
| R-02 | Crash rate spike after release candidate | Reliability | 5 | 4 | 20 | Crash-free sessions < 99.5% over rolling 6h window | Platform Lead | Crash signature triage, guard risky code paths, add defensive fallbacks | Immediate hotfix or rollback by version pin |
| R-03 | Auth token lifecycle vulnerability | Security | 5 | 3 | 15 | Any auth penetration test fail or replay-path confirmed | Security Lead | Token rotation hardening, single-use verification/reset tokens, strict expiration validation | Block release and revoke affected token families |
| R-04 | Session revocation desync across devices | Security | 4 | 3 | 12 | Revoked session remains valid beyond 60s in tests | Security Lead | Centralized session invalidation checks, cache busting, revocation propagation tests | Force global session invalidation for impacted accounts |
| R-05 | Sync conflict causing data inconsistency | Data Integrity | 5 | 3 | 15 | Sync mismatch rate > 0.1% in soak run | Platform Lead | Idempotent operations, conflict resolution strategy, checksum verification | Suspend risky sync operation class and run consistency repair job |
| R-06 | Notification latency degradation | Product Reliability | 3 | 4 | 12 | Notification delivery p95 > 5s for 3 hours | Product Lead | Queue tuning, backpressure handling, retry policy optimization | Temporarily reduce non-critical notification classes |
| R-07 | Admin permission boundary breach | Security | 5 | 2 | 10 | Any failed role-boundary test in admin/owner flows | Security Lead | Centralize authorization middleware, deny-by-default policies, regression tests | Lock affected admin endpoints pending fix |
| R-08 | Update pipeline artifact mismatch | Release | 4 | 3 | 12 | Manifest/install checksum mismatch in validation run | Release Lead | Artifact checksum validation, immutable artifact storage, pipeline hardening | Stop rollout and republish validated artifact set |
| R-09 | API latency saturation under burst load | Scalability | 4 | 3 | 12 | Critical route p95 latency exceeds budget by > 25% | Platform Lead | Query optimization, caching strategy, endpoint throttling and batching | Activate degraded-mode responses for non-critical endpoints |
| R-10 | Audit log incompleteness for sensitive actions | Compliance | 4 | 3 | 12 | Missing actor/action/target in any auth/admin/owner mutation | Security Lead | Enforce audit wrapper middleware and log schema validation | Block release until missing coverage restored |

## Trigger Response Workflow

1. Detect threshold breach from monitoring or validation output.
2. Open risk incident with owner assignment.
3. Classify as Critical/High/Medium/Low.
4. Execute mitigation action immediately.
5. Confirm stabilization via metric recovery window.
6. Decide release impact: continue, constrain, or freeze.

## Release Freeze Conditions

- Any Critical risk in active state.
- Any Security or Data Integrity risk without validated mitigation.
- Any repeated trigger event on the same risk within 48 hours.

## Weekly Risk Review Format

- New risks added:
- Risks closed:
- Risks escalated:
- Top 5 scores:
- Trigger breaches this week:
- Mitigation completion rate:
- Residual risk summary:

## Evidence Requirements

- Every risk status change must include evidence link.
- Every mitigation completion claim must include validation output.
- Every release freeze decision must include trigger and owner signoff.