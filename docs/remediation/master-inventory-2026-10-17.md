# Master inventory: Nexus Forge Gaming, 2026-10-17

This is the working inventory for the community-feedback brief. It extends `full-audit-2026-10-16.md`; it does not replace it.

Status key:
- **Verified**: exercised end to end, or covered by an automated test that runs in this repo.
- **Code present**: implemented in source and read in this pass, not exercised end to end.
- **Partial**: some of it works; the gap is named.
- **Not connected**: shown in the interface without working behaviour behind it.
- **Missing**: advertised or required, not implemented.
- **Blocked**: needs a second person, an external service, or authorization this session does not have.
- **Decided**: a product or security decision recorded here, with the reason.

Branch `feat/community-feed`, on top of `9124369`. Commit and push state is recorded in the commit itself.

## 1. Work completed

| Area | Change | Evidence |
|---|---|---|
| Server rail | Right-click on a server opens a context menu: Open server, Mark as read (when there is unread activity), the settings tabs the person may use, and Leave or Delete server. Settings items open the existing panel on the matching tab. | `apps/web/src/components/layout/server-context-menu.tsx`, `server-menu-model.ts`, `vexora-shell.tsx`. Model tests: 10 of 10. Browser check: **not yet run**. |
| Settings tabs | One shared tab list for the panel and the menu. | `apps/web/src/components/chat/forge-manage-tabs.ts`. |
| Deep links | `?manage=` accepted six tab ids, so Bans, Emoji, Stickers and Soundboard opened Overview. All tab ids are now accepted. | `chat-page.tsx`, `isManageTab`. |
| Transfer ownership | Authorisation now runs before payload validation. Before, a non-owner with an incomplete body got 400 and learned the payload rules; now they get 403. Ownership was never transferred in either version. | `apps/server/src/routes/forge-management.routes.ts` (`POST /:id/transfer`). Covered by the two-account check. |
| Avatar Studio | Emote playback on the figure (three emotes, blend in and out, reduced-motion hold) and a Preview button on owned emotes. | `emote-poses.ts`, `avatar-viewer.tsx`, `studio-panels.tsx`. Timeline tests: 18 of 18. Browser check: **not yet run**. |
| Avatar Studio | "Community merch" look, snapback cap, oversized tee, mullet, cross chain, rebuilt figure. | `base-model.ts`, `design.ts`, `avatar-design.ts`. Parity test: 16 of 16. |
| Upload limits | Pinned the free and open-beta upload decisions in tests. | `apps/server/tests/plan-upload-limits.test.ts`, 4 of 4. |
| End-to-end scripts | Two repeatable checks against a local API (refuse non-local hosts, need `NF_E2E_ALLOW_WRITES=1`). | `scripts/e2e/two-factor-check.mjs`, `scripts/e2e/two-account-check.mjs`. |

## 2. Checks run

| Check | Result | Notes |
|---|---|---|
| Two-factor, end to end (`scripts/e2e/two-factor-check.mjs`) | **14 of 14** | Register, enable app, sign in with a code, challenge token refused as bearer, wrong code refused, replayed code refused, recovery code signs in once and is refused the second time, app turned off, sign-in without a second factor. |
| Two accounts, end to end (`scripts/e2e/two-account-check.mjs`) | **21 of 21** | Owner, member and outsider. Messages flow both ways. Outsider refused read, post and open. Signed-out refused. Member refused edit, delete, rename, channel create, ban and transfer; ownership unchanged afterwards. Owner can delete a member's message. |
| Server test suite, against the test database | **347 of 347** | Four files need the test database URL at import time (`feature-consumption`, `vac-bans`, `billing-enforcement`, `webhook-headers`). Run with `DATABASE_URL` pointing at `nexusforge_test`. Without it, those four fail on the environment, not on the code. |
| Web test suite | 67 of 67 (earlier in the pass) | Includes the avatar model, emote timelines and server menu model. |
| Web typecheck and ESLint on changed files | Pass (earlier in the pass) | Re-run before commit. |
| Browser check: right-click server menu | **Not run** | Blocked on this machine: the Studio and chat routes did not finish compiling in the dev server under load. |
| Browser check: emote Preview in the Studio | **Not run** | Same block. The emote motion has only been seen in offline renders (`scripts/avatar-harness`, not in the repo). |

## 3. Security and moderation

| Feature | Status | Notes |
|---|---|---|
| Two-factor sign-in gate | **Verified** | Two-factor check, steps 3-4 and 6-14. |
| Two-factor recovery codes | **Verified** | Ten codes at setup; each signs in once; regenerate and disable need a current app code or a recovery code. |
| Two-factor lock-out (no device and no codes left) | **Open decision** | No self-service path. Needs a new table or column, which changes the production schema, so it waits for your approval. See section 8. |
| Challenge token used as a bearer token | **Verified** | Refused with 401. Also in `tests/access-token.test.ts`. |
| Email verification | Code present | Not exercised end to end. |
| Session revocation on password change, sign-out-everywhere, deletion | Verified (Oct 16) | `tests/session-revocation.test.ts`, 4 of 4. |
| Protected routes without credentials | Verified (Oct 16) | Route probe, 320 routes. Object-level checks covered by the two-account check for the server case. |
| Object-level authorisation, server case | **Verified** | Two-account check. Direct messages and friends are not covered yet. |
| AutoMod on channel messages | **Verified** | Create, forum post and edit all call `runAutoMod`. `tests/automod.test.ts`. |
| AutoMod on direct messages | **Decided: not applied** | DMs are between two people and have no server rules. Reports cover DMs and staff review them. |
| Reports: submit | Code present | `POST /api/reports`, schema-checked, rate-limited to 20 an hour. |
| Reports: review and resolve | Code present | Staff and forge moderators handle reports. Not exercised end to end. |
| Audit log | Code present | `lib/forge-audit.ts`, `routes/admin-audit.ts`, `middleware/audit-middleware.ts`. Not read line by line. |
| Free-tier upload limit, 50 MB | **Verified (tests)** | Free plan is 50 MB and enforced once billing is on. Open beta keeps at least 50 MB for free users. |
| Open-beta premium upload allowance | **Decided** | Premium users keep the pre-plans allowance during open beta (`PREMIUM_UPLOAD_MAX_BYTES`, 150 MB by default), so nobody loses an upload size they already had. Once billing is on, each premium user gets their tier's limit. Pinned by `plan-upload-limits.test.ts`. Change it in `plans.ts` if you want a different beta cap. |
| Profile image limits | Code present | Avatar 2 MB, banner 6 MB, dimension checks. |

## 4. Performance and real-time communication

| Item | Status |
|---|---|
| Live API response times | Measured lightly on Oct 16-17: `/api/health` 0.3-10 ms; authenticated reads 15-280 ms under light load. Not a baseline. |
| Database connections | The live backend holds up to 40 connections (`DB_POOL_MAX`); Postgres allows 100. A second API at the default pool exhausted it and crashed the live backend on 2026-10-16. Test APIs use `DB_POOL_MAX=8`. Rule saved to memory. |
| Messaging between two accounts (server channel) | **Verified** over the API, by the two-account check. Real-time delivery over the socket is not yet checked. |
| Voice connection and reconnection | **Blocked**: needs two participants and a voice service. |
| Screen sharing (root cause and fix) | **Blocked**: needs two participants. No root cause identified. |
| Startup and bundle size | Not measured. |

## 5. Website and desktop

| Item | Status |
|---|---|
| Public pages at mobile, tablet and desktop widths | Not audited. |
| Authenticated Studio and server menu | Not checked in a browser this pass (section 2). |
| Desktop app (Electron) startup, session restore, shutdown, media permissions | Not verified. |
| Windows installer signing | Not checked. No signing step has been verified; do not claim signing until a signed artifact can be verified. |

## 6. Developer ecosystem

| Item | Status |
|---|---|
| API documentation | Missing. The route probe lists 320 routes; there is no public reference. |
| Bot authentication and scoped permissions | Not verified. Owner-only `bots` tab exists. |
| Webhooks | Tab exists for `manageChannels`. Not exercised. |
| Developer portal | Not started, by design: it depends on the API and bot foundations above. |

## 7. Community features

| Feature | Status |
|---|---|
| Owner right-click management menu | **Built** (section 1). Browser check pending. |
| Avatar Studio: collection, emotes, profile card | Emote playback built (browser check pending). Collection tab is still the owned-items list. Profile stats: no data source yet. |
| Feeds, leaderboards, rewards, forums, polls, discovery | Not audited. |

## 8. Decisions

**Open, needs your approval: two-factor lock-out recovery.**
If someone loses their phone and has used every recovery code, nothing in the app can sign them in. The only route is a manual reset, and there is no staff tool for it yet.

Proposed design, which needs a schema change:
- A new table, `TwoFactorResetRequest`, holding a hashed email code, the request time, and a cancel token.
- The user signs in with their password, requests a reset, and gets an email with a code and a cancel link.
- The reset takes effect 24 hours after the request, so an attacker who controls the email has a day during which the owner can cancel. The owner is emailed at the same time.
- Each reset is written to the audit log.

This adds a production table, so it needs your go-ahead before the migration runs.

**Decided and recorded:**
- AutoMod is not applied to direct messages (section 3).
- Premium open-beta upload allowance keeps the pre-plans size (section 3).
- Jackpot and cryptocurrency assets: disabled, unchanged.
- Government ID: not collected, unchanged.
- Earned rank badges: unchanged.
- Smoke and test accounts: hidden from normal user views, unchanged. The preview accounts `previewcheck@preview.test` and the three accounts the two-account check creates live only in the test database.

## 9. Remaining backlog, in priority order

P0
1. Decide on two-factor lock-out recovery (section 8). Blocked on your approval for the schema change.
2. Voice connection, reconnection and screen sharing between two accounts. Blocked on a second participant and a working voice service.
3. Object-level authorisation for direct messages and friends.

P1
4. Browser check of the server right-click menu, including keyboard use. Blocked on machine load.
5. Browser check of the emote Preview in the Studio. Blocked on machine load.
6. Real-time delivery over the socket between two accounts.

P2
7. Responsive audit of public and authenticated pages at phone and tablet widths.
8. Performance baseline on a quiet machine: startup, page weight, API timings under a fixed load.
9. Desktop app: startup, session restore, shutdown, media permissions, packaging.
10. Avatar Studio: collection view; emote playback in voice rooms and on profiles.

P3
11. Scoped bot tokens and a public API reference.
12. Installer signing plan, after a certificate decision.
