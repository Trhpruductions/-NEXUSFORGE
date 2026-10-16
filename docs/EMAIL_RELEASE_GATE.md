# Email release gate

One row per requirement in the email brief. Status meanings:

- **VERIFIED (test)**: an automated test in `apps/server/tests/email-*.test.ts` checks it. The test is named.
- **IMPLEMENTED - NOT VERIFIED**: the code is written and compiles (server `tsc`, web `tsc`, web ESLint), but nothing
  checks it at runtime. Usually this needs a database, a running server or a real provider.
- **BLOCKED / NOT VERIFIED**: needs something this repository cannot provide (credentials, DNS, a database change,
  an owner decision). The reason is given.

Automated run: `cd apps/server && npx --yes tsx --test tests/email-*.test.ts` (88 tests in 10 files, all passing at the time of
writing). The suite uses in-memory fakes and nodemailer's JSON transport. It never opens a database connection or
a mail connection.

## Requirements

| # | Requirement | Status | Evidence or reason |
| --- | --- | --- | --- |
| 1 | Delivery record (`EmailMessage`): fields, status rules, `sendEmail` keeps its return shape | IMPLEMENTED - NOT VERIFIED (records need the schema applied) | Transitions: VERIFIED (test `email-status.test.ts`: "the pipeline may record...", "only a webhook may set DELIVERED..."). Pipeline records QUEUED, then ACCEPTED or FAILED: VERIFIED with a fake store (`email-retry.test.ts`). Legacy call sites type-check unchanged. Writes to Postgres: NOT VERIFIED, the table does not exist until `prisma db push` runs. |
| 2 | Retries (transient only, max 2, backoff) and duplicate suppression (essential, same kind and user, 60 s) | VERIFIED (test) for the logic. The Postgres duplicate query is IMPLEMENTED - NOT VERIFIED. | Retry classes: `email-status.test.ts` ("4xx SMTP replies..."). Retry behaviour: `email-retry.test.ts` ("a transient 4xx reply is retried..."). Duplicates: `email-duplicate.test.ts` ("an identical essential email... is suppressed"; "two identical sends racing..."). Duplicate guard: a DB query over `EmailMessage` (`latestSendAt`) plus an in-process in-flight guard. The DB query has no test (needs a database). |
| 3 | Test mode: `EMAIL_TEST_MODE` or no SMTP uses JSON transport, records still written; visible in status | VERIFIED (test) for the mode rules and the JSON transport. Status display IMPLEMENTED - NOT VERIFIED. | Mode rules: `email-optional.test.ts` ("the mode rules: test mode wins..."). JSON transport: `email-optional.test.ts` ("the test transport builds the message..."). Test-mode records: `email-retry.test.ts` ("test mode uses its own transport..."). `deliveryStatus()` and `/api/admin/email/status` show the mode: type-checked only. |
| 4 | Provider webhook: HMAC-SHA256 over the raw body, `timingSafeEqual`, 5-minute timestamp, replay refused, disabled = 404 | VERIFIED (test) for signature, timestamp, replay, disabled and status rules. Mount order in `index.ts` IMPLEMENTED - NOT VERIFIED. Provider formats BLOCKED. | `email-webhook.test.ts`: valid, wrong signature, tampered body, other secret, replayed, stale, future, missing headers, disabled, bad JSON, unknown event, unknown message, bounce after delivery. Provider-specific parsers are NOT implemented (by design; see `EMAIL_SETUP.md` section 5). BLOCKED on the owner choosing a provider. |
| 5 | Templates: one per kind (11), `{subject, text, html}`, shared frame, footer links from `APP_WEB_URL`, logo only if the file exists, escaping | VERIFIED (test) | `email-templates.test.ts`: every kind renders both parts; escaping of user text; footer links; contacts only when configured; logo header switching; subject line cannot break headers. The file-exists probe itself is IMPLEMENTED - NOT VERIFIED (the test passes an explicit context). |
| 6 | Sender identities: `MAIL_FROM` for transactional; optional `SUPPORT_EMAIL`, `SECURITY_EMAIL`, `UPDATES_EMAIL`, never invented; sending domain verified by owner | VERIFIED (test) for footer omission. Domain verification BLOCKED. | `email-templates.test.ts` ("the footer shows only the contacts that are configured"). BLOCKED: the owner must verify the sending domain with the SMTP provider, and publish SPF, DKIM and DMARC (DNS). Not possible from this repository. |
| 7 | Preferences and unsubscribe: essential never gated or unsubscribable; optional default OFF in `User.preferences`; signed unsubscribe `GET /api/email/unsubscribe`, idempotent, no login | VERIFIED (test) for the policy, tokens and idempotence. Settings schema and the GET route IMPLEMENTED - NOT VERIFIED. | Token valid, tampered, expired, malformed, wrong category, derived key: `email-unsubscribe.test.ts`. Idempotence and "off by default": `email-unsubscribe.test.ts` ("opting out is idempotent...", "optional mail is OFF by default..."). Essential mail never gated or given an unsubscribe header: `email-optional.test.ts`. Route, settings zod and PUT merge: type-checked only. |
| 8 | Email change: `CHANGE_EMAIL` purpose; authenticated, password re-check, rate limit; code to NEW address; same answer for taken or free; confirm; race handled; notice to OLD address | VERIFIED (test) for the flow. Routes, rate limits and the enum value IMPLEMENTED - NOT VERIFIED / BLOCKED until the schema is applied. | Flow with stubbed database: `email-change.test.ts` (request sends to the new address only; taken and current addresses get the same answer; cooldown identical for taken and free; right code switches and notifies the old address; wrong code changes nothing; unique-constraint race returns 409; unknown account 404). The real Prisma calls, rate limits and `CHANGE_EMAIL` in Postgres are NOT verified: BLOCKED until `prisma db push`. |
| 9 | Security notices: templates for password changed and email changed; wire the email-change notice; list changes needed in `auth.routes.ts` and `sessions.ts` | Templates VERIFIED (test). Email-change notice call IMPLEMENTED - NOT VERIFIED. Other wiring BLOCKED (other agents own those files). | Templates: `email-templates.test.ts`. Notice call: `email-change.test.ts` ("...tells the OLD address") checks the call with a stub. The real send is not checked. `auth.routes.ts` and `sessions.ts` were not edited. Exact changes are in `EMAIL_SETUP.md` section 9. |
| 10 | Admin area: `/api/admin/email` (status, messages, stats, test send, staff only), admin page with iframe preview (sandbox), client API in a new file | IMPLEMENTED - NOT VERIFIED | Server routes type-check; web page and component pass `tsc` and ESLint with zero errors. Nothing was run in a browser or against a database. Test-send rules (own verified address or allowlist, reauth, rate limit) are written but untested. |
| 11 | Config: new keys in `env.ts` (zod, optional where appropriate) and `.env.example` (placeholders only) | VERIFIED (test) | Every `email-*` test loads `env.ts`, so the schema parses at test time. `.env.example` holds names and blank placeholders. The stale `MAIL_FROM` example (`vexora.gg`) differs from the code default (`nfgcord.com`) and was left as is. |
| 12 | Documentation: `docs/EMAIL_SETUP.md` and `docs/EMAIL_RELEASE_GATE.md` | IMPLEMENTED - NOT VERIFIED | Written. The setup steps have not been run against a provider. |
| 13 | Tests: `email-*.test.ts` covering transitions, webhook, unsubscribe, templates, masking and redaction, retries, duplicates, email change | VERIFIED (test) | 88 tests pass across 10 files: the nine new files plus the existing `email-template.test.ts`: `email-status`, `email-webhook`, `email-unsubscribe`, `email-templates`, `email-redaction`, `email-retry`, `email-duplicate`, `email-optional`, `email-change`. Database-backed code is covered by injected fakes at the module boundary, not by a database. |

## Blocked items (owner or lead)

| Item | Why it is blocked | Owner or lead |
| --- | --- | --- |
| Real mail delivery | No SMTP provider credentials in this repository. | Owner |
| SPF, DKIM, DMARC | DNS access and the provider's values are needed. | Owner |
| Sending domain verification | Done with the provider's console. | Owner |
| Bounce and complaint events | Provider webhook not created, and no provider-specific parser exists. | Owner, then a developer |
| Postgres schema change | Lead runs `prisma db push` (see below). | Lead |
| `EmailMessage` table and `CHANGE_EMAIL` enum in the live database | Same as above. Until then, email change returns an error and records are skipped. | Lead |
| Password-changed notice, reset via template, welcome notice | Files owned by other agents (`auth.routes.ts`, `verification.routes.ts`, `settings.routes.ts` password handler). Exact changes listed in `EMAIL_SETUP.md` section 9. | Lead |
| Opt-in toggles and email-change form in the settings UI | `settings-page.tsx` is owned by another agent. The API exists. | Lead or settings owner |
| Admin navigation link to `/admin/email` | `admin/page.tsx` is not in this work's files. | Lead |

## Lead must apply

1. **Schema.** From `apps/server`, after reviewing the change list it prints:
   `npx prisma db push`
   The change is additive: two new enums (`EmailMessageStatus`, `EmailCategory`), one new table `EmailMessage`
   with four indexes, and one new value `CHANGE_EMAIL` on the `VerificationPurpose` enum. Nothing existing is
   removed. Check the planned changes it prints before confirming, in case the live database has drifted and something would be dropped. The Prisma client has
   already been regenerated in this working tree (`npx prisma generate`, no database connection). Restart the API
   after the push. Restarting is the lead's call; this work did not restart any process.
2. **Environment (server only, never in git).** Set `API_PUBLIC_URL` and `APP_WEB_URL` to the public addresses,
   `EMAIL_UNSUBSCRIBE_SECRET` (32+ characters), and `EMAIL_WEBHOOK_SECRET` (32+ characters) once a provider is
   connected. Set `SMTP_*` and `MAIL_FROM` from the owner's provider. Keep `EMAIL_TEST_MODE=false` in production.
   Optional: `SUPPORT_EMAIL`, `SECURITY_EMAIL`, `UPDATES_EMAIL`, `EMAIL_TEST_ALLOWLIST`.
3. **Wiring in files owned by others.** See `EMAIL_SETUP.md` section 9.
4. **Decide on the existing email change in `PATCH /api/settings/account`** (risk 1 below).

## Risks

1. **Existing bypass.** `PATCH /api/settings/account` still changes the email with the password and, if two-factor
   is on, a code. It does not send a code to the new address. That makes the new, verified flow optional for an
   attacker who has the password. Recommend removing `email` from that route's schema, so it returns 400 and points
   to `/api/account/email/change`. This was not changed, because it alters existing behaviour the web app may rely on.
2. **Email change marks the new address verified.** That is a decision: the code proved control of the address, so
   it counts as verified. The settings `PATCH` route sets it to unverified instead. Pick one rule and apply it everywhere.
3. **Retention and deletion.** `EmailMessage` rows are kept indefinitely, and they carry `userId` and a masked
   address. Account anonymisation does not clear them. A retention job (for example 180 days) and clearing
   `userId` on anonymisation are still to be written.
4. **Tokens in logs.** Morgan logs the full request URL, so unsubscribe and reset links (`?token=`) land in access
   logs. The reset flow already did this. Strip query strings from the access log.
5. **Duplicate guard fails open.** If the database check fails, the email is sent. This avoids blocking sign-in
   but can produce a duplicate. The duplicate check depends on the schema being applied.
6. **Retries can duplicate.** A timeout may happen after the provider accepted the message. The retry can then
   send a second copy. Accepted trade-off for the transient class. Status changes are unaffected, because they are conditional.
7. **Recipient hash is unkeyed.** `recipientHash` is a plain SHA-256 of the address. Anyone with the table and a
   list of candidate addresses can confirm membership. Consider an HMAC with a server secret.
8. **Webhook replay guard is per process.** Two API processes would each accept a replay once. Status changes stay
   safe (conditional and idempotent). Use a shared store before running more than one process.
9. **Test mode in production.** `deliveryStatus().email` reports `unconfigured`, which hides email options on the
   sign-in pages. Verification still runs and "succeeds" into the JSON transport. The admin status warns about this.
10. **Behaviour changes.** SMTP error text returned to the browser is now redacted. The dev console now prints codes
    through the test transport (the same effect as before). `maintenance` and `service-notice` are classed as
    ESSENTIAL, so they cannot be unsubscribed from. That is a decision for the owner to confirm.
11. **Provider formats.** No provider-specific webhook parser exists. Until one is written, bounces and complaints are
    not recorded, and the statuses stay QUEUED, ACCEPTED or FAILED.
