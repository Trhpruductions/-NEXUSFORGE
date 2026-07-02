# NexusForge Beta Go-Live Scorecard

Use this scorecard to make a hard go/no-go decision for beta release.

Scoring model:

- Pass = 2 points
- Partial = 1 point
- Fail = 0 points

Release thresholds:

- Security category must have no Fail items.
- Reliability category must have no Fail items.
- Total score must be >= 85% of maximum.

## A) Performance and Reliability

1. Desktop cold start p95 meets target budget.
2. Dashboard first meaningful content meets target budget.
3. Crash-free session rate meets target.
4. Sync success rate meets target under soak test.
5. Notification latency meets target p95.

Evidence:

- Benchmark report link:
- Soak report link:
- Crash report dashboard link:

## B) Security and Account Integrity

1. Register/login/refresh/logout flows verified in production-like env.
2. Email verification and password reset single-use token behavior verified.
3. Session revocation and device/session visibility verified.
4. Rate limits and abuse protections verified.
5. Audit logs present for auth/admin/owner sensitive actions.

Evidence:

- Security validation report link:
- Auth E2E report link:
- Audit sample bundle link:

## C) Dashboard and Core Product Workflows

1. Dashboard panels load correctly with realistic data.
2. Project create/edit/archive/search/tag/favorite flows pass E2E.
3. Settings categories (theme/notification/privacy/security) persist correctly.
4. Notification preferences are respected across categories.
5. Empty states and failure states are handled gracefully.

Evidence:

- Product E2E report link:
- UX validation recording link:

## D) Desktop Update and Distribution Readiness

1. Desktop update manifest and installer artifacts validate successfully.
2. Versioned and latest installer links are correct.
3. Update flow tested from previous beta version.
4. Artifact consistency checks pass.
5. Rollback procedure tested.

Evidence:

- Update validation output link:
- Artifact report link:
- Rollback drill report link:

## E) Operations and Support Readiness

1. Monitoring dashboards are available and accurate.
2. Critical alerts are configured and tested.
3. Incident response runbook is published and rehearsed.
4. Feedback reporting and crash reporting channels are operational.
5. On-call ownership and escalation matrix are documented.

Evidence:

- Monitoring dashboard link:
- Alert test output link:
- On-call plan link:

## F) Admin and Owner Control Readiness

1. Admin user/project moderation tools are functional.
2. Announcement and beta access controls are functional.
3. Owner system health and error log surfaces are functional.
4. Maintenance mode controls are authorized and auditable.
5. Permission boundaries verified for admin vs owner scopes.

Evidence:

- Role-permission test report link:
- Admin/owner walkthrough recording link:

## Decision Sheet

- Total earned points:
- Maximum points:
- Percentage:
- Security gate status: Pass/Fail
- Reliability gate status: Pass/Fail

Final decision:

- Go
- Go with constraints (must list constraints)
- No-go

## Alignment With Existing Docs

Use this scorecard with:

- BETA_RELEASE_READY.md
- BETA_TESTING.md
- DEPLOYMENT_ENV_CHECKLIST.md
- DEPLOYMENT_PLATFORM_CHECKLIST.md

This scorecard is the release decision layer that sits on top of those operational checklists.