# Email setup

This is the setup guide for Nexus Forge Gaming email: what the server sends, how it is recorded, and what the
owner must do before real mail goes out. Read `EMAIL_RELEASE_GATE.md` for what has and has not been verified.

Nothing in this document proves that mail reaches an inbox. The server can only see whether the SMTP server
accepted a message. Inbox delivery, bounces and complaints are known only from a provider webhook, and only
after the provider is connected.

## 1. What is sent

| Kind | Category | Notes |
| --- | --- | --- |
| Verification code (sign-up, sign-in, sensitive change, password reset by code) | Essential | 6 digits, 10 minutes |
| Email change code (sent to the NEW address) | Essential | Confirms the new address |
| Verify email (link) | Essential | Template exists. No current flow sends it (registration uses codes) |
| Password reset link | Essential | Single use, 30 minutes. Still sent by the existing inline text in `auth.routes.ts` (see section 9) |
| Password changed (security notice) | Essential | Template exists. Not yet wired (see section 9) |
| Email changed (security notice, sent to the OLD address) | Essential | Wired to the email-change confirm step |
| Welcome | Essential | Template exists. Not yet wired (see section 9) |
| Planned maintenance, service notice | Essential | Service messages. Cannot be unsubscribed from |
| Release notes | Optional | Only to accounts that opted in |
| Product announcement | Optional | Only to accounts that opted in |

Essential mail is never gated by preferences and never carries an unsubscribe link. Optional mail needs an explicit
opt-in (default OFF), stored at `User.preferences.email` as `announcements`, `releaseNotes` and `promotions`.

## 2. Sender identities

- `MAIL_FROM` is the transactional sender, for example `Nexus Forge Gaming <no-reply@your-domain>`. It defaults to
  `Nexus Forge Gaming <no-reply@nfgcord.com>` in code, but `apps/server/.env.example` still shows an older
  `vexora.gg` value. Set the real one in the server environment.
- `SUPPORT_EMAIL`, `SECURITY_EMAIL` and `UPDATES_EMAIL` are shown in email footers only when set. They are never
  invented. Leave them blank until the owner has chosen the addresses.
- **The owner must verify the sending domain** with the SMTP provider before real sends. Gmail only sends as the
  signed-in account (or its verified aliases), so a non-Gmail domain needs a provider that allows it.

## 3. Environment keys

Set these in the server environment (never commit a real value; see `apps/server/.env.example` for names and
placeholders).

| Key | Purpose | Required in production |
| --- | --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Real delivery through an SMTP provider | Yes, unless test mode |
| `MAIL_FROM`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO` | Sender and reply address | `MAIL_FROM` yes |
| `APP_WEB_URL` | Public web origin. Footer and action links are built from it | Yes |
| `API_PUBLIC_URL` | Public API origin. Unsubscribe links point here, because the web app does not proxy `/api` | Yes, for unsubscribe links to work |
| `EMAIL_TEST_MODE` | `true` = nothing leaves the process (see section 6) | No (keep `false`) |
| `EMAIL_WEBHOOK_SECRET` | HMAC secret for provider events, 32+ characters. Unset = webhook off (404) | Yes, once a provider is connected |
| `EMAIL_UNSUBSCRIBE_SECRET` | Signs unsubscribe links, 32+ characters. Unset = derived from `JWT_ACCESS_SECRET` | Recommended |
| `EMAIL_TEST_ALLOWLIST` | Comma-separated addresses the admin test send may use | No |
| `SUPPORT_EMAIL`, `SECURITY_EMAIL`, `UPDATES_EMAIL` | Footer contacts (only when the owner chose them) | No |

Generate the two secrets with a password manager or `openssl rand -base64 48`. Store them in the server environment
or the secrets manager, not in the repository.

## 4. SPF, DKIM and DMARC (owner action, DNS)

These are DNS records on the sending domain. The values come from your SMTP provider. The lines below are
placeholders, not working records.

```
; SPF: one TXT record on the sending domain (or the subdomain used for sending)
example.com.                 TXT  "v=spf1 include:<provider-spf-host> -all"

; DKIM: the provider gives a selector and a public key. Publish it as a TXT record.
<selector>._domainkey.example.com.  TXT  "v=DKIM1; k=rsa; p=<provider-public-key>"

; DMARC: start with monitoring (p=none) and reports, then tighten to quarantine, then reject.
_dmarc.example.com.          TXT  "v=DMARC1; p=none; rua=mailto:<dmarc-report-address>; adkim=s; aspf=s"
```

Rules of thumb: SPF and DKIM must pass for the domain in `MAIL_FROM` before DMARC enforcement. Use `p=none` for
two to four weeks while reviewing reports. Only then move to `p=quarantine` and later `p=reject`. Do not publish
DMARC `rua` to an address you do not control.

## 5. Bounce and complaint webhook

The endpoint is `POST /api/email/webhooks`. It accepts a generic JSON body:

```json
{ "messageId": "<the Message-ID the server sent>", "type": "delivered" | "bounced" | "complained" | "failed", "occurredAt": "2026-10-14T12:00:00Z" }
```

Each request must carry:

- `X-Nexus-Timestamp`: Unix seconds, within 5 minutes of the server clock.
- `X-Nexus-Signature`: `v1=` followed by the hex HMAC-SHA256 of `"<timestamp>." + <raw request body>`, keyed with
  `EMAIL_WEBHOOK_SECRET`.

Replays inside the five-minute window are refused. Unknown message ids are acknowledged with `matched: false`.
A status only moves along the allowed transitions (for example a bounce cannot become a delivery).

**Provider-specific formats are NOT implemented.** Amazon SES, SendGrid, Mailgun, Postmark and others each send their
own payload and signature scheme. To connect one, put a small adapter in front of this endpoint, or add a parser in
`apps/server/src/lib/email-webhook.ts` that converts its payload into the generic shape above, and check its own
signature scheme. Until then, bounces and complaints are NOT recorded.

Steps for the owner:

1. Create the webhook in the provider's console, pointing at `https://<API_PUBLIC_URL>/api/email/webhooks`.
2. Generate a secret of 32+ characters and set it as `EMAIL_WEBHOOK_SECRET` on the server.
3. Make sure the provider echoes the `Message-ID` the server sent (the `providerMessageId` column). Then send a test
   event to a test address and confirm the record changes in the admin page.
4. Keep the provider's suppression list on. A bounced address must not receive more mail.

## 6. Test mode

`EMAIL_TEST_MODE=true` uses nodemailer's JSON transport. Messages are built, recorded and (outside production)
printed to the server console. Nothing opens a connection to a mail server.

- Test mode wins over `SMTP_HOST`. It cannot reach a real inbox while it is on.
- With no `SMTP_HOST` outside production, test mode is used automatically.
- With no `SMTP_HOST` in production, sends fail loudly and are recorded as `FAILED`. Nothing pretends to send.
- The admin status page shows the active mode and a warning when test mode is on in production.

Use test mode for local work and for checking templates and records before the owner has connected a provider.

## 7. Safe production activation

Do these in order. Do not skip ahead: each step is a check on the one before.

1. Apply the schema change listed in `EMAIL_RELEASE_GATE.md` ("Lead must apply"), then restart the API once. Confirm the
   `EmailMessage` table exists. Until this is done, delivery still works but records and the duplicate check are skipped.
2. Set `APP_WEB_URL` and `API_PUBLIC_URL` to the public addresses. Set `EMAIL_UNSUBSCRIBE_SECRET`.
3. Keep `EMAIL_TEST_MODE=false`. Set `SMTP_*` and `MAIL_FROM` from the owner-chosen provider.
4. Verify the sending domain, and publish SPF, DKIM and DMARC (section 4). Wait for DNS to propagate.
5. Send one test email from the admin page to the owner's own verified address. Check the record shows `ACCEPTED`,
   then check the inbox by hand, and check the headers (SPF and DKIM should pass).
6. Connect the provider webhook (section 5) and confirm a test event updates the record.
7. Only then enable real sign-up and reset flows for users. Watch the `FAILED` count for the first day.
8. Do not turn on optional mail (announcements, release notes) until the owner has written the content and the
   opt-in control exists in the settings UI.

## 8. Operations

- The admin page is at `/admin/email`. It shows the mode, configuration booleans, a 7-day count by status, redacted
  recent messages, template previews, and a test send.
- Test sends need the admin's password each time. They go only to the admin's own verified address or to
  `EMAIL_TEST_ALLOWLIST`.
- Records store the recipient as a hash and a masked form, the subject, and a redacted error. They never store a
  body, a code, a token or a link.
- Records are kept indefinitely today. A retention job (for example 180 days) is still to be written; see the gate
  document.
- The webhook's replay guard is in memory. With more than one API process, a replay could be accepted by a second
  process within the five-minute window. Status changes stay safe (they are conditional and idempotent), but add a
  shared store before running more than one process.

## 9. Changes still to be made in files this work does not own

These are one-line or few-line changes for the owner of each file. They are not made here.

- `apps/server/src/routes/auth.routes.ts`, `forgot-password`: replace the inline `sendEmail(...)` with
  `sendTemplateEmail("password-reset", user.email, { username: user.username, link, expiresIn: "30 minutes" }, { userId: user.id })`.
  Before rotating `resetToken`, call `duplicateWaitSeconds(user.id, "password-reset", subject)` and skip both the
  rotation and the email when it is above zero, still answering with the same generic message. Otherwise a second
  request inside the window would invalidate the link the person already has.
- `apps/server/src/routes/auth.routes.ts`, `setNewPassword`: after a successful reset, send
  `sendTemplateEmail("password-changed", email, { username, when: new Date().toUTCString() }, { userId })`.
- `apps/server/src/routes/settings.routes.ts`, the password change handler (around line 335): the same
  `password-changed` notice after the password is updated.
- `apps/server/src/routes/verification.routes.ts`, `POST /email/confirm`: when the email was not verified before and is
  now, send `sendTemplateEmail("welcome", user.email, { username }, { userId })`. Select `username` in the update.
- `apps/server/src/routes/settings.routes.ts`, `PATCH /account` (existing email change): see the risk list in
  `EMAIL_RELEASE_GATE.md`. It changes the address without the new code step.
