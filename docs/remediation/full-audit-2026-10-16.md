# Full-stack audit inventory: 2026-10-16

Repository state at the start: branch `feat/community-feed`, HEAD `525c341` (pushed), no uncommitted source. The earlier reported HEAD `e03bc6c` is superseded.

This document records what was checked, what was changed, and what is still open. Anything not listed as verified below is **not verified**.

## 1. Verified this round

| ID | Area | Finding | Severity | Status |
|---|---|---|---|---|
| A-01 | Authentication (route coverage) | Probed 320 API routes with no credentials against the test API. 294 refused (401/403). 11 answered 2xx; all 11 are public by design (health, delivery capabilities, logout, legal text, runtime mode, age reject, error reporting, invite availability). 15 returned 400 from input validation before any data was touched. **No protected route answered without credentials.** Probe: `docs/remediation/route-auth-probe.mjs`; raw results: `route-auth-probe-results.json`. | P0 check | Verified (no bypass found). Limitation: dummy IDs only; object-level checks (user A reading user B's data) are not covered. |
| A-02 | Sign-in security | Login, register, reset-password, VAC appeal and both forgot-password forms had no `method`, so a form submitted before its scripts loaded fell back to GET and put the email and password in the URL. Observed in the browser on 2026-10-16. | P0 | **Fixed locally** (`method="post"` on all six forms). Regression guard: `apps/web/tests/auth-forms.test.ts` (5/5 pass; confirmed it fails on the committed version). Not deployed. |
| A-03 | Test-environment CSRF | Local preview served from `localhost` with the API on `127.0.0.1` (different sites) made every cookie-authenticated write fail with "CSRF validation failed". | Test-env only | Explained; not a production defect (web and API share a site in production). |
| A-04 | Route probe tooling | Probe script added; it refuses any base URL that looks like production. | — | Added. |

## 2. Feature status inventory

Status key: **Verified** = exercised end to end this round. **Code present** = implemented in source but not exercised this round. **Gap** = missing or represented only in the UI.

| Feature | Status | Notes |
|---|---|---|
| Sign-in, sign-out, session restore | Partly verified | Sign-in and redirect verified in the local preview; form fix above. Expiry and refresh paths not exercised. |
| Protected API routes | Verified (no bypass) | See A-01. |
| Account verification (email/SMS) | Not verified | Test mode records emails; flow not run end to end. |
| Avatar Studio: categories, inventory, lock states, emote equip, save, persistence | Verified (local preview) | Equip/unequip and save-then-reload verified. Collections cards, profile stats, emote playback in the figure: **Gap**. |
| Screen sharing | **Code present, not verified** (P0) | `media-store.ts`, `voice-engine.tsx`, `mesh-voice.ts`, `voice-room-panel.tsx`. Needs two participants to test. |
| Voice channels | Code present, not verified | Needs two participants. |
| Messaging and real-time updates | Not verified this round | Needs two participants. |
| Server settings dialog | Code present | `forge-settings-panel.tsx`; not exercised this round. |
| Server owner right-click menu | **Gap** (P1) | The only context menu in the shell is for the server rail's unread markers. No owner menu on a server. |
| Profile privacy and badge grants | Not verified | |
| Desktop app startup, packaging | Not verified this round | `apps/desktop` has packaged output under `release/`. |

## 3. Remaining work, in priority order

1. **P0 — Screen sharing.** Two-account test: one user shares, the other sees it. Check track cleanup and reconnection. Blocked on a second participant.
2. **P0 — Object-level authorization.** Authenticated tests with two accounts: profile edits, DM and channel access, server admin actions, cosmetics and loadout ownership.
3. **P0 — Account verification and recovery.** Register, verify, reset, sign out everywhere, with the email test mode.
4. **P1 — Server owner context menu.** Right-click a server: settings, channels, members, roles, moderation, invites, audit log, leave/delete. Keep the server's own interface on screen.
5. **P1 — Messaging.** Two participants: ordering, real-time delivery, edit/delete permissions, failed-send recovery.
6. **P2 — Avatar Studio gaps:** collection cards, emote playback in the figure, profile card stats once those systems exist.
7. **P2 — Website and desktop layout pass** at desktop, tablet and phone widths, plus the desktop packaging check.

## 4. Changes made this round (uncommitted)

- `apps/web/src/app/(auth)/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `components/auth/reset-password-client.tsx`, `components/auth/vac-appeal-form.tsx`: `method="post"` on every form.
- `apps/web/tests/auth-forms.test.ts`: regression guard.
- `docs/remediation/route-auth-probe.mjs`, `route-auth-probe-results.json`, this document.

## 5. Checks run

- Web typecheck: pass. Web lint on changed files: pass.
- `auth-forms.test.ts`: 5 of 5 pass.
- Route probe against the test API: 320 routes, no protected route answered without credentials.
- Not run this round: server test suite (no server source changed), desktop tests, end-to-end messaging, screen sharing, packaging.
