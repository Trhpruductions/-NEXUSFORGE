# Master audit, baseline and local remediation: 2026-10-15

Scope: the whole Nexus Forge Gaming monorepo (apps/server, apps/web, apps/desktop, tools/owner-console) and the live site at https://nfgcord.com.
Rules followed: no commits, pushes, releases, deployments, production restarts or production configuration changes in this pass. All code changes are local, uncommitted, and tested against the isolated `nexusforge_test` database. Production was only read, never written.

## 1. Baseline

### Present and verified

| Area | State | Evidence |
|---|---|---|
| Monorepo builds | Server typecheck clean (`tsc --noEmit`) after this pass | run 2026-10-15 |
| Test database | `nexusforge_test` exists on Postgres 5433; live `nexusforge` database untouched by tests | database list; leftover-row check: 0 test rows in both |
| VAC ban system | Deployed earlier (see production-plans-2026-10-15.md, sections J and K) | prior session record |
| Webhook header fix | Deployed earlier | prior session record |
| Owner Console actor attribution | Code and tests in place from prior session; the console itself is not running (see O9) | prior session record |
| Production live entitlements | **0 rows** in `FeatureEntitlement` on the live database | read-only count |

### Broken before this pass (now fixed locally, not deployed)

| ID | Problem | Evidence before fix |
|---|---|---|
| B1 | Add-on "consume" debited nothing and reported `remaining: 9999` for every request | `apps/server/src/routes/billing.routes.ts` stub at lines 38–44 |
| B2 | Signing out everywhere, resetting a password, and deleting an account did not close live sockets | `io.use` in `apps/server/src/index.ts` checks only the token; no revocation path touched sockets |
| B3 | Age-gate origin check used substring matching, so `https://nexusforge.app.attacker.example` passed, and the public web origin `https://nfgcord.com` matched none of the four substrings and would be refused with 403 | `apps/server/src/routes/age.routes.ts` line 14 (old); `apps/web/src/app/age-gate/age-gate-client.tsx` posts to `/api/age/verify` from the page origin |

B3 is a probable production break for anonymous age confirmation. It follows from the code (the browser sends `Origin` on POST, and `https://nfgcord.com` contains none of the old substrings). It has not been reproduced against the live site, because that requires a state-changing request to production. The new test in `tests/origin-allowlist.test.ts` covers the exact path, and the owner can confirm it on the live site.

### Incomplete or open (not fixed in this pass)

| ID | Item | Why it is not fixed here |
|---|---|---|
| O1 | Age policy is enforced only on some routes; chat, DMs, voice and forges are not gated; the `nexusforge_age18` cookie is set but no route reads it | Scope decision for the owner (see section 4) |
| O2 | Stale-token reconnect window: a socket or API call can still use an access token issued before a revocation, until it expires (`ACCESS_TOKEN_EXPIRES_IN`, default 15m) | Closing it needs a `sessionsRevokedAt` column on `User` and a check against token issue time. That is a production schema change, so it needs approval |
| O3 | Single-session sign-out (`DELETE /api/settings/sessions/:id`) and `POST /api/auth/logout` do not close that device's socket | Sockets are not mapped to refresh sessions. Same fix as O2 |
| O4 | `POST /api/billing/features/*/consume` has no idempotency key, so a retried request debits twice | Needs a client request id and a table or unique key; design decision |
| O5 | Mining and jackpot still active on the server and in Discord | Owner decision; disable plan exists in production-plans-2026-10-15.md |
| O6 | Hidden duplicate page content (React streaming, S:0) on every page, including live | Not investigated in this pass |
| O7 | `SUPPORT_EMAIL` unset in production | Production configuration; needs owner approval to change |
| O8 | Second watchdog defined but not running; Free City startup entries ambiguous | Do not touch without owner approval (other bots and Free City must not be disturbed) |
| O9 | Owner Console not running | Needs owner go-ahead to restart |
| O10 | 8 open message reports | Human moderation review |
| O11 | Desktop installer unsigned | Needs a code-signing certificate and owner approval for release |
| O12 | Voice has no TURN server | Infrastructure decision |
| O13 | Web UI changes not deployed; production runs uncommitted code | Release decision; needs commit and owner approval |
| O14 | Texas legal documents held for attorney review | Publish only with owner approval after review |

## 2. Changes made in this pass (local, uncommitted)

### F1. Add-on consumption debits units atomically (fixes B1)

- New module `apps/server/src/lib/feature-consumption.ts`. One conditional `updateMany` that requires `active`, `quantity >= requested`, and not expired, then decrements. Concurrent requests cannot take more units than exist. Returns `null` for anything that fails the check, which the route turns into 402.
- `apps/server/src/routes/billing.routes.ts`: the stub is removed and the three consume routes use the module.
- Tests: `apps/server/tests/feature-consumption.test.ts`, 9 passing against `nexusforge_test`. Covers: normal debit, insufficient balance, exhaustion, 10 simultaneous requests against 3 units (exactly 3 accepted), expired, inactive, no row (no free unit), invalid quantities, and isolation between add-ons.
- Behaviour change to note: in development and test (no Stripe key), `requirePaidFeature` lets everyone through, but the debit now refuses a user with no entitlement row with 402. That is intended: no free debit should remain.

### F2. Live sockets close when sessions are revoked (fixes B2, part of O2/O3)

- `apps/server/src/lib/realtime.ts`: `disconnectUserSockets(userId, { reason, exceptAccessJti })` emits `session:revoked`, then closes the sockets after 250 ms (same pattern as suspensions). `socketsToDisconnect` keeps the requesting device when its token id is given.
- The access token id (`jti`) is now carried on `req.user.jti` (`middleware/auth.ts`, `types/express.d.ts`) and `socket.data.jti` (`index.ts`).
- Wired into: password reset by email and by SMS (`auth.routes.ts`, `setNewPassword`); password change in settings (keeps this device); sign out everywhere in settings (keeps this device); account deletion scheduled (`lib/account-deletion.ts`).
- Tests: `apps/server/tests/session-revocation.test.ts`, 4 passing (no-op without a socket server; all sockets told and closed; the requesting device kept; filter behaviour).
- Not covered: O2 and O3 above.

### F3. Age gate matches origins exactly (fixes B3)

- New module `apps/server/src/lib/origins.ts`: `allowedOriginList` and `isAllowedOrigin`. The list is the same one CORS uses. `index.ts` now calls the shared function; its list values are unchanged (the same expression, moved).
- `apps/server/src/routes/age.routes.ts`: exact match against the list. The `Referer` is parsed as a URL before the check. A missing origin is still allowed (non-browser callers). The literal `null` origin is refused.
- Tests: `apps/server/tests/origin-allowlist.test.ts`, 6 passing, including real HTTP requests to the mounted route for lookalike domains, `localhost` in the path, a bad referer, and the app's own origin.

## 3. Verification

| Check | Result |
|---|---|
| `tsc --noEmit` (apps/server) | Clean, exit 0, after all changes |
| `feature-consumption.test.ts` | 9 / 9 pass (test DB) |
| `session-revocation.test.ts` | 4 / 4 pass |
| `origin-allowlist.test.ts` | 6 / 6 pass |
| Full server suite (`tests/**/*.test.ts`, test DB) | 343 / 343 pass, exit 0 (section 5) |
| Leftover test rows | 0 in live and test databases |

## 4. Decisions needed from the owner (not acted on)

1. **Add-on debit rules.** The original code said consumption was "free to facilitate rapid cluster scale-up". The brief and this pass debit real units. Confirm the rules before selling add-ons. No live entitlements exist today, so nothing changes for real users yet.
2. **Age policy scope.** Which surfaces must enforce the 18+ gate (chat, DMs, voice, forges), and whether the age cookie should be enforced at all.
3. **Stale-token window (O2).** Approve the `sessionsRevokedAt` column (additive, nullable) so revocations take effect immediately, not after up to 15 minutes.
4. **Idempotency for consume (O4).** Approve a request-id scheme.
5. **Mining and jackpot (O5), Free City startup (O8), second watchdog (O8), Owner Console restart (O9).**
6. **Production release.** Git commit timing (Option A), desktop signing (O11), uploads storage, TURN (O12), legal review (O14), `SUPPORT_EMAIL` (O7), and deploying the local fixes in this document (B1–B3).
7. **Housekeeping.** Delete the pm2 dump backup copy and the test API log containing test codes and links, after confirming no production secrets are in them. Keep `test-account.txt` unless confirmed.

## 5. Full server suite

Run: `npx tsx --test "tests/**/*.test.ts"` from `apps/server`, with `DATABASE_URL` pointing at `nexusforge_test`, Stripe and SMTP blank, `NODE_ENV=test`.

Result: **343 tests, 343 pass, 0 fail, 0 cancelled, 0 skipped**, exit code 0. Output saved to the session scratchpad as `full-suite-2026-10-15.txt`.

## 6. Deployment status

| Change | Local | Deployed |
|---|---|---|
| F1 add-on debit | Yes, tested | No |
| F2 session revocation sockets | Yes, tested | No |
| F3 age gate exact origin + shared origin list | Yes, tested | No |
| Earlier web UI rounds (L, M) | Yes | No |
| VAC bans, webhook headers | Yes | Yes (earlier) |

Production currently runs uncommitted code. Nothing in this pass was committed, pushed, built into production, or restarted.
