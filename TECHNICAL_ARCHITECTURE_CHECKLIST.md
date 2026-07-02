# NexusForge Technical Architecture Checklist

Use this checklist during implementation, review, and release readiness.

## Architecture Principles

- Reliability before feature velocity.
- Secure-by-default with least privilege.
- Observable by default with traceable operations.
- Backward-compatible rollout strategy where practical.

## Monorepo Mapping

## apps/web (Next.js frontend)

### App shell and performance

- Route-level code splitting and lazy loading are applied for non-critical modules.
- Initial dashboard payload is bounded and cached appropriately.
- Error boundaries exist for major app surfaces.
- Loading states and skeletons are implemented for slow API paths.

### UX and state integrity

- Global state updates are deterministic and avoid stale race conditions.
- Optimistic UI writes have reconciliation/fallback behavior.
- Notification center state is consistent across tab refresh and reconnect.

### Security

- No secrets or privileged logic exposed in client bundle.
- CSRF protections and auth token flow align with server policy.
- Input validation and output sanitization are present for user-generated content.

## apps/server (Express API)

### API and domain boundaries

- Controllers are thin; business logic lives in services.
- Validation schemas exist for every write endpoint.
- Permission checks are centralized and composable.
- Error responses are normalized and machine-readable.

### Data integrity and transactions

- Multi-step writes use transactions for atomicity.
- Idempotency strategy exists for retry-prone operations.
- Soft-delete/archive behavior is explicit and query-safe.
- Audit logging covers sensitive actions and moderation events.

### Security and abuse controls

- Route-level rate limiting applied by risk profile.
- Auth/session/token lifecycle paths are expiration-safe and replay-safe.
- CORS allow-list and origin policy are environment-correct.
- Security headers and trusted proxy configuration are verified.

### Observability and operations

- Structured logging with correlation IDs across request lifecycle.
- Health checks include dependency-specific status.
- Alerting thresholds exist for auth failures, 5xx spikes, and sync failures.
- Background jobs expose retry count and dead-letter visibility.

## apps/desktop (Electron)

### Startup and lifecycle

- Startup sequence has explicit readiness phases with timeout handling.
- Single-instance behavior is deterministic and user-safe.
- Crash resilience paths are validated for renderer/main process failures.
- Local service detection and fallback logic are deterministic.

### Update pipeline

- Manifest URL configuration is environment-correct.
- Update metadata signature/integrity checks are validated.
- Update rollback path is documented and tested.
- Release artifacts are versioned and checksum validated.

### Security hardening

- Context isolation, sandboxing, and secure IPC contracts enabled.
- All IPC endpoints validate sender and payload.
- External navigation and protocol handling are allow-listed.
- Developer tooling exposure is disabled for production builds.

## packages/ui

- Shared components have accessibility guarantees and keyboard support.
- Theme tokens are centralized and documented.
- Motion and transition patterns respect performance budgets.

## packages/types

- Shared domain types reflect API contracts and are version-safe.
- Breaking type changes are gated by migration notes.

## packages/config

- Environment schema validation is centralized.
- Feature flags have documented defaults and rollout strategy.

## prisma

- Schema changes include migration plan and rollback notes.
- Indexes are reviewed for query patterns before rollout.
- Data retention and archive strategy are explicit for growth tables.

## scripts and operations

- Release scripts are idempotent and safe to rerun.
- Validation scripts fail fast with actionable output.
- Smoke checks cover health, auth, dashboard load, and update endpoints.

## Cross-Cutting Readiness Checks

## Testing

- Unit tests for critical services and validators.
- Integration tests for auth, project workflows, notifications, and sync.
- End-to-end tests for onboarding, dashboard, and settings.
- Load/soak tests for realtime notifications and sync pipelines.

## Performance

- Startup performance regression gate in CI.
- API p95 latency budgets defined per critical route class.
- Web bundle and route payload budgets enforced.

## Security

- Dependency scan and secret scan in CI.
- Privilege boundary tests for admin and owner surfaces.
- Audit log completeness checks for sensitive operations.

## Release Governance

- Every release candidate includes changelog, known risks, rollback notes.
- Every production incident receives root-cause analysis and permanent corrective action.