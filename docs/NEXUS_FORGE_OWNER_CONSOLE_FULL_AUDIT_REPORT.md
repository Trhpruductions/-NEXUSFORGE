# Nexus Forge Gaming — Owner Console Full Audit Report

**Status: PARTIAL.** Phase 1 (PM2 status and log tails) is **not fixed**. The Owner Console code that produces the reported PM2 error is not in this checkout, and the PM2 daemon runs on the operator's PC, which this audit could not reach. Phase 2 (the audit) was performed against the checked-out code and the running sandbox instance only.

Verification run: 2026-10-17 02:26 UTC (sandbox clock). All times are UTC.

---

## 1. Executive summary

- The Owner Console in this repository is a **finance-and-operations console for the Vexora/Nexus Forge platform**: 14 pages, 17 owner-only API routes, and no PM2 integration.
- Every API route rejects anonymous requests with 401 and returns data only to the OWNER role. Automated tests cover the ADMIN, EXEC, and member rejections (403).
- The **automated suites pass**: server 102/102, owner-console 7/7, web type-check clean, owner-file lint clean, production web build passes.
- **Verified gaps:** the PM2 section, tickets, incidents, bugs, email delivery status, legal acceptance, and an activity database that the brief lists do **not exist** in this codebase. They are missing capabilities, not broken features.
- **One policy conflict needs your decision:** processing fees are displayed whenever Stripe reports them, which contradicts the recorded decision that fees stay unavailable in the console.
- **Not verified:** the desktop owner window (it rendered blank under a headless Linux display), the Windows PowerShell launchers, live Stripe test-mode traffic, and any PM2 behaviour.

---

## 2. Current system and build status

| Item | Value (verified) |
|---|---|
| Repository | `Trhpruductions/-nexusforge` |
| Branch | `feat/owner-console-live-command-center` |
| HEAD | `cddc1e1` (pushed; matches `origin`) |
| Working tree | Clean at audit start (0 changed files) |
| Open PR | #7 (ready for review, CI `brand-verify` green) |
| Other open PR | #6 on `feat/owner-console-financials`, green |
| Environment | Linux sandbox; API `localhost:4001`, web `localhost:3100`, local Postgres 16 |
| Live services on the operator's PC | **Not reachable from this audit** |

No application code was changed during this audit phase. The only file added is this report.

---

## 3. PM2 issue — status: NOT FIXED (blocked)

**Reported symptom:** `pm2 status: pm2 jlist exited with code 1` and `pm2 has not reported its app list yet`.

**Verified findings**
- Neither error string exists anywhere in this repository (searched `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.json`, and `.ps1`/`.cmd` scripts).
- No Owner Console route, page, or component calls `pm2`. A search of all 14 owner pages, the owner components, `owner-api.ts`, `owner.routes.ts`, and `owner-health.ts` returned 0 references.
- The repository's only `pm2 jlist` callers are operational scripts: `scripts/validate-24h-stability.ps1` (parses the first JSON array in the output) and `scripts/vexora-autostart.cmd` (calls `pm2 jlist` through `node -e`).
- `pm2` is not installed in the sandbox, so the command, exit code, stderr, and daemon state could not be captured.

**Root cause:** not established. The failing code is in an operator's local copy that is not on this branch.

**Required to close Phase 1**
1. The location of the PM2 panel code on the operator's PC, or confirmation that it should be committed to a branch.
2. Read-only output from the PC: `where.exe pm2`, `pm2 --version`, `pm2 ping`, `pm2 jlist` (first lines, redacted), and the effective `PATH` for the process that runs the console.

**Hypothesis to test (unverified):** a desktop process spawned without a shell may fail to resolve the npm `pm2.cmd` shim, while PowerShell resolves it. This is not confirmed.

**Safety:** nothing was stopped, restarted, saved, or deleted. `pm2 save` was not run.

---

## 4. Inventory of Owner Console sections

### 4.1 Pages present (verified in `apps/web/src/app/owner/`)

| Route | Section | Primary data source |
|---|---|---|
| `/owner` | Overview | `/api/owner/overview` (user counts, forges, subscriptions, revenue, services, alerts) |
| `/owner/status` | Live status | `/api/owner/services` (live probes, host metrics) |
| `/owner/users` | Users | `/api/owner/users` (`User` table) |
| `/owner/users/[id]` | User detail | `/api/owner/users/:id` (user, subscriptions, payments, audit) |
| `/owner/communities` | Communities | `/api/owner/communities` (`Forge`, member and channel counts) |
| `/owner/memberships` | Memberships | `/api/owner/memberships` (`User`, `BillingSubscription`, `PaymentTransaction`) |
| `/owner/finance` | Finance | `/api/owner/finance/summary` (`PaymentTransaction`, `PaymentRefund`, `PaymentDispute`, `Expense`) |
| `/owner/transactions` | Transactions | `/api/owner/finance/transactions` (+ detail) |
| `/owner/expenses` | Expenses and profit | `/api/owner/finance/expenses` (create, update, delete, audited) |
| `/owner/support` | Support and reports | `/api/owner/support` (**returns "not available"**) |
| `/owner/developer` | Developer platform | `/api/owner/developer` (`ApiKey`, `WebhookSubscription`, `BotApp`) |
| `/owner/store` | Store and purchases | `/api/owner/store` (`CosmeticItem`, `UserCosmetic`, `ShopItem`, `PaymentTransaction`) |
| `/owner/incidents` | Logs and incidents | `/api/owner/overview` alerts and `/api/owner/finance/webhooks` (`WebhookEvent`) |
| `/owner/audit` | Security and audit | `/api/owner/audit` (`AuditLog`) |
| `/owner/release` | Releases and legal | `/api/owner/release` (package version; legal fields "not recorded") |

Navigation is a side menu defined in `apps/web/src/components/owner/owner-nav.tsx` (14 entries).

### 4.2 Sections in the brief that do NOT exist in this codebase (missing capability)

| Brief section | Status | Evidence |
|---|---|---|
| PM2 applications, status, log tails | Missing | 0 references (section 3) |
| Activity database | Missing | No activity model beyond `UserActivity` (not surfaced) |
| Tickets and ticket management | Missing | No ticket model; `/support` returns "not available" |
| Bugs and error reports | Missing | No error log table; only `WebhookEvent` and `AuditLog` |
| Incidents (management workflow) | Missing | Only derived alerts; no incident records |
| Email delivery and status | Missing | `email` row shows "Not Configured" until SMTP is set; no delivery log |
| Legal document versions and acceptance | Missing | `/release` reports "Not recorded" |
| Disk usage and storage | Partial | Disk used percent is on Live status; no storage breakdown |
| Settlement balance | Missing by design | Shown as "Not connected" |
| Administrative action history | Partial | `AuditLog` (expenses and other writes that create audit rows) |

### 4.3 Owner actions available

The console performs **create, update, and delete on expenses only**, each written to `AuditLog`. All other sections are read-only. No suspend, role-change, or refund action exists in the console.

---

## 5. Findings by section

Ranked within each section. Evidence is from code inspection or runtime checks in this audit.

**Overview.** Works: counts, alerts, service summary, recent admin activity. Verified data from the database. Issue: "online now" uses `lastSeenAt` within 5 minutes, and `lastSeenAt` is written on every authenticated request (`requireAuth`), so it is request activity, not presence (Low).

**Live status.** Works: real database query, real HTTP probe of the website, host metrics from the OS. Verified: the API probe reports `Online`; the database reports `Online` with a measured latency; the website reported `Offline` with the fetch error, because this sandbox has no outbound route to `nfgcord.com`. Issues: each open owner page calls the probe every 15 seconds with no cache or deduplication (Medium); probe error text, including Prisma messages, is returned to the UI (Low, owner-only).

**Users and user detail.** Works: search, pagination, detail with subscriptions and payments. Passwords and tokens are not selected. Issue: search is `contains` on username and email with no index (Low at current scale).

**Communities.** Works: forge list with member and channel counts. Message and voice activity is not shown (Missing).

**Memberships.** Works: reconciliation categories, each backed by a query. Verified by the test suite that a manual premium flag without a billing record is not counted as a paid subscriber. Lifetime membership is "Not tracked" (no model).

**Finance.** Works: periods, previous-period comparison, live/test separation, MRR and ARR, expenses, profit. Verified by tests: test-mode money excluded from live totals, PAYMENT_PROCESSING excluded from operating expenses, MRR of a yearly charge divided by 12, totals equal the sum of raw rows. Issues are listed in section 7.

**Transactions.** Works: filters, pagination, detail with refunds, disputes, and subscription. Net per row. Issue: fee shown when Stripe reports it (policy conflict, see section 7).

**Expenses.** Works: create, update, delete, audit trail with changed fields. Verified by test. Issue: no receipts or attachments (Low). A PATCH that sent only one field previously reset defaults; fixed and covered by test in this branch.

**Support and reports.** Explicitly unavailable. This is correct behaviour, not a fault.

**Developer platform.** Works: counts only. Secrets and hashes are never returned. Issue: no per-delivery webhook health (Low).

**Store.** Works: catalog and purchase counts. Apple and Google billing shows "Not Configured", correct because no integration exists.

**Logs and incidents.** Works: webhook ledger with status filter; derived alerts. Issue: no incident lifecycle (open, acknowledge, resolve) (Missing).

**Audit.** Works: filterable by record type; shows changed fields. Issue: sign-in and session events are not in the audit log (Medium).

**Releases and legal.** Works: application version from `npm_package_version`, which is set only when the server is started through npm. Deployment and legal fields are "not recorded" (Missing).

---

## 6. Live service and infrastructure health

Snapshot taken during this audit, from `GET /api/owner/services` on the sandbox API:

| Service | Status | Detail |
|---|---|---|
| Backend API | Online | Serving the request |
| Database (PostgreSQL) | Online | Responding, measured latency |
| Main website `https://nfgcord.com/` | Offline | No response from this sandbox (no outbound route) |
| Payments (Stripe) | Not Configured or Degraded | Depends on keys in the environment; sandbox has no Stripe key |
| Payment webhook ledger | Online | No unresolved failures in the sandbox |
| Authentication, realtime, background jobs | Unknown | No probe exists |
| Email, SMS, storage, LiveKit, Discord | Not Configured | Settings missing in the sandbox |
| Gateway, store billing | Unknown or Not Configured | No integration exists |

**Distinguishing health from journeys.** A healthy `/api/health` response only proves that the API process answers. It does not prove login, checkout, or message delivery work. This audit did not run a user journey against the live site.

**Unverified:** the operator's PC services, the PM2 processes, the VEXORA gateway and tunnel, and the watchdog. These were not observed.

**Recovery.** The console handles a failed refresh by keeping the last good data and showing a stale warning. This was verified in code. A live outage was not induced, so it is not verified end to end.

---

## 7. Finance and billing audit

**Verified (read-only, plus existing tests)**
- Live and test mode are separated at every query (`livemode` filter), tested.
- Pending and failed payments are never counted in gross or net, tested.
- Refund and dispute handlers do not change `User.premium`. Confirmed by grep: 0 premium writes in `applyRefund` and `applyDispute`, consistent with the recorded policy.
- Webhook processing is idempotent: a `WebhookEvent` ledger row is committed in the same serializable transaction as the writes, and redelivery is a no-op, tested.
- Subscription updates ignore older events, tested.
- The sandbox database currently holds no live payments, so the live totals are $0 by construction. The totals were reconciled against raw rows in tests, not against production data.

**Policy conflict (needs your decision)**
- The recorded decision says processing fees remain unavailable in the Owner Console and must not be fabricated.
- The implementation writes `feeCents` from the Stripe balance transaction whenever Stripe reports it (`fetchFeeCents` in `billing-webhook.ts`).
- The fees are real Stripe data, not fabricated, but the console displays them. Options: keep the display and record a decision change, or hide fee values from the UI and keep them in the database. **No change was made.**

**Other financial findings**
- Existing rows default to `livemode = false`. Live figures are correct only after a backfill from Stripe events. Until then, production history can show as Test (High before production).
- MRR assumes the last captured charge reflects current price. Discounts, prorations, and tax are not modelled. This is disclosed on the page.
- "Recorded profit" depends entirely on the expenses entered. The page labels it "based on available data".
- Date windows are UTC. Refunds and disputes are dated by the day they were recorded, not the original sale. Disclosed on the page.
- No end-to-end Stripe test-mode checkout has been run, so webhook behaviour is verified only through stubbed events.

**Not done, as required:** no checkout, charge, refund, dispute, or subscription change was initiated. No live payment was made.

---

## 8. Security and permissions

**Verified**
- Every owner endpoint returns 401 without a token. With the owner token, the endpoints return 200 (or 404 for unknown IDs). Matrix recorded in section 10.
- Automated tests verify 403 for ADMIN, EXEC, and ordinary users on every owner endpoint, and 403 for an owner whose account is suspended.
- Role is checked against the database on each request (`requireOwner`), not against the token alone.
- Secrets: webhook signing secrets, API key hashes, and payment credentials are not returned by any route. Verified by reading the select lists.
- Expense writes produce `AuditLog` rows that include before and after values and the actor.

**Findings**
- **Owner session token is stored in `localStorage`** (`auth-store.ts`, persist mode `local`). Any script injection on the site could read it (Medium; this is the existing app design, not introduced here).
- **Writes do not use the CSRF check** used elsewhere in the app (`requireCsrf`). Owner writes authenticate with a bearer header, which browsers do not attach automatically, so CSRF risk is low (Low).
- **Service error text reaches the UI** (`owner-health.ts`), including Prisma error messages up to 160 characters (Low, owner-only).
- **Desktop owner window:** the launcher sets `NEXUSFORGE_DESKTOP_URL` to a local URL. Not verified on Windows (Medium).
- No destructive or penetration testing was performed. No production permissions were changed.

---

## 9. UI, usability, and accessibility

**Verified in a logged-in browser (Chromium, 1440×1000)**
- All 14 owner pages render with no runtime errors or console errors (0 reported).
- Loading, empty, and stale states render. Empty states say why data is absent (for example, "No captured payments in this period").
- Live/Test toggle, period selector, and custom date range are present and labelled.
- Destructive expense deletion requires a second click ("Confirm delete").

**Findings**
- Tables are wide and scroll horizontally at narrower widths (Low). Mobile layout was not verified.
- No keyboard shortcuts exist (Low).
- Transaction table rows are clickable with the mouse only; no keyboard activation was added (Medium for accessibility).
- Freshness labels use "Live" when the last refresh is recent, which can be read as a guarantee. The label says "refreshes every N seconds", and the stale state is shown after three missed intervals (Low).

---

## 10. Automated test results (run during this audit)

| Check | Command | Result |
|---|---|---|
| Server type-check | `npx tsc --noEmit` (apps/server) | Pass |
| Full server tests | `npm test` (apps/server) | **102 pass, 0 fail, 0 cancelled, 0 skipped** |
| Owner-console suite | `tsx --test tests/owner-console.test.ts` | **7 pass, 0 fail** |
| Web type-check | `npx tsc --noEmit` (apps/web) | Pass (ignoring generated `.next-dev` cache) |
| Owner lint | `eslint src/app/owner src/components/owner src/lib/owner-api.ts` | 0 problems |
| Production build | `npx next build` (earlier in this work) | Pass; all owner routes compiled |
| Access matrix | `curl` each owner endpoint, anonymous vs owner | Anonymous 401 on 17 of 17; owner 200/404 as expected |
| Browser pass | Playwright over 14 owner pages | 14 render, 0 errors |

**Not run or not possible**
- Web unit or end-to-end tests: none exist in `apps/web` (no test runner).
- Admin, EXEC, and member 403s via HTTP: covered in the automated suite, not re-run in this matrix.
- PM2 tests: not possible (no PM2 code in the checkout).
- Stripe test-mode integration: not run (no test keys).

---

## 11. Prioritized issue register

| ID | Severity | Section | Issue | Status | Evidence | Approval needed |
|---|---|---|---|---|---|---|
| ISS-01 | High | PM2 status, log tails | Reported `pm2 jlist` failure; code not in checkout | Open | Section 3 | Operator to supply code and output |
| ISS-02 | High | Finance | Fees displayed; conflicts with decision to keep them unavailable | Open (policy) | Section 7 | Owner decision |
| ISS-03 | High | Finance | Existing rows default to test mode; production history can be mislabelled | Open | Section 7 | Backfill approval |
| ISS-04 | High | Operations | Tickets, incidents, bugs, email status, legal acceptance, activity DB are missing | Missing capability | Section 4.2 | Scope decision |
| ISS-05 | Medium | Live status | Probes run per open page every 15 s, with no cache | Open | `owner-health.ts` | None |
| ISS-06 | Medium | Security | Owner token in `localStorage` | Open (app design) | `auth-store.ts` | Design decision |
| ISS-07 | Medium | Audit | Sign-in and session events are not audited | Missing | Section 5 | Scope decision |
| ISS-08 | Medium | Desktop | Owner window not verified; Linux render blank | Unverified | Section 8 | Operator test on Windows |
| ISS-09 | Medium | Finance | Stripe checkout and webhook not run end to end in test mode | Unverified | Section 7 | Test keys |
| ISS-10 | Medium | Accessibility | Clickable rows not keyboard operable | Open | Section 9 | None |
| ISS-11 | Low | Security | Service error text returned to UI | Open | `owner-health.ts` | None |
| ISS-12 | Low | Security | Owner writes do not use the CSRF check | Open | `owner.routes.ts` | None |
| ISS-13 | Low | Overview | "Online now" measures request activity, not presence | Open | `requireAuth` | Definition decision |
| ISS-14 | Low | Expenses | No receipts | Missing | Section 5 | Scope decision |
| ISS-15 | Low | Developer | No webhook delivery health | Missing | Section 5 | Scope decision |
| ISS-16 | Low | Web | No automated UI tests | Gap | `apps/web` | None |
| ISS-17 | Low | Store | Store billing not integrated | Missing (correct) | Section 5 | None |

---

## 12. Recommended roadmap

**Phase A — Critical fixes**
- Close ISS-01 once the operator provides the PM2 code and output. Acceptance: process list and log tails load in the console, with a stale warning on failure and no effect on live services.
- Resolve ISS-02 and ISS-03 with the owner. Acceptance: fee policy recorded and implemented; a backfill plan approved and verified against Stripe events.

**Phase B — Reliability**
- Cache or deduplicate service probes (ISS-05). Acceptance: one probe per interval regardless of open tabs.
- Redact or shorten error text in service details (ISS-11).

**Phase C — Management**
- Incident records with open, acknowledge, and resolve (ISS-04 subset).
- Sign-in and session audit events (ISS-07).

**Phase D — Finance and reporting**
- Run a Stripe test-mode checkout, refund, and dispute end to end (ISS-09). Acceptance: each event produces the expected ledger rows and totals.

**Phase E — Quality**
- Keyboard operation for table rows (ISS-10).
- Add a web test runner for the owner pages (ISS-16).

---

## 13. Changes made during this task

- Restarted the local API (`localhost:4001`) and web (`localhost:3100`) dev servers, which had stopped. No code changed.
- Added this report at `docs/NEXUS_FORGE_OWNER_CONSOLE_FULL_AUDIT_REPORT.md`. The file is new and uncommitted.
- Nothing was committed, pushed, deployed, or published.
- No PM2 process was touched. No production configuration or credential changed.

---

## 14. Outstanding risks, limitations, and owner decisions

**Decisions needed**
1. Fee display (ISS-02): show Stripe-reported fees, or keep fees unavailable in the console as recorded?
2. Backfill approval for `livemode` on existing production rows (ISS-03).
3. Scope for tickets, incidents, legal acceptance, and email status (ISS-04). Each is a new data model and should be approved before it is built.
4. Owner token storage (ISS-06): keep `localStorage` or move to an HTTP-only cookie.

**Limitations**
- This audit cannot observe the operator's PC, PM2, the gateway, the tunnel, or the watchdog.
- Stripe behaviour is verified with stubbed events only.
- The sandbox cannot reach `nfgcord.com`.

**Not changed (by instruction):** billing mode, payment policy, email webhook secret, legal text, production configuration.

---

## 15. Final operational readiness assessment

| Area | Assessment |
|---|---|
| Owner access control | **Ready** (verified by matrix and tests) |
| Finance calculations | **Ready for test use**; production needs the livemode backfill (ISS-03) |
| Live status | **Ready for the probes it has**; coverage gaps are marked Unknown |
| PM2 monitoring | **Not ready** (ISS-01) |
| Operations workflow (tickets, incidents, legal, email) | **Not built** |
| Desktop owner window | **Unverified** on Windows |
| Overall | **Not ready for production operations** until ISS-01 to ISS-03 are resolved |
