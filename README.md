# NexusForge

NexusForge is a futuristic communication platform foundation for gamers, creators, and online communities.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, Framer Motion, Zustand, Socket.IO client
- Backend: Node.js, Express, Socket.IO, Prisma ORM, PostgreSQL, Redis, JWT auth
- Planned media layer: WebRTC + LiveKit/mediasoup + FFmpeg integration
- Storage targets: AWS S3 or Cloudflare R2

## Monorepo Apps

- `apps/web`: Next.js frontend with landing page, app shell mock layout, and auth pages
- `apps/server`: Express API with auth, forge, messaging, and realtime routes

## Shared Packages

- `packages/ui`: shared UI primitives placeholder
- `packages/types`: shared types package
- `packages/config`: shared config placeholder

## Implemented Auth Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/verify-email?token=...`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/health`

## Implemented Forge Endpoints

- `GET /api/forges`
- `POST /api/forges`
- `POST /api/forges/join`
- `GET /api/forges/:id`

## Implemented Message Endpoints

- `GET /api/messages/:channelId`
- `POST /api/messages`
- `PATCH /api/messages/:id`
- `DELETE /api/messages/:id`
- `POST /api/messages/:id/reactions`

## Implemented Friends + DM Endpoints

- `GET /api/friends`
- `POST /api/friends/request`
- `PATCH /api/friends/:id`
- `DELETE /api/friends/:id`
- `GET /api/dms/threads`
- `POST /api/dms/threads`
- `POST /api/dms/groups`
- `GET /api/dms/threads/:threadId/messages`
- `POST /api/dms/threads/:threadId/messages`

## Implemented Voice Endpoints

- `POST /api/voice/token`
- `POST /api/voice/state`

## Implemented Upload + Search Endpoints

- `POST /api/uploads/presign`
- `GET /api/search/messages?q=...`
- `GET /api/search/users?q=...`
- `GET /api/search/forges?q=...`

## Implemented Billing Endpoints

- `GET /api/billing/status`
- `GET /api/billing/entitlements`
- `POST /api/billing/checkout/session`
- `POST /api/billing/portal/session`
- `POST /api/billing/features/advanced-moderation-ai/consume`
- `POST /api/billing/features/creator-campaign-slot/consume`
- `POST /api/billing/webhook` (Stripe webhook)
- `GET /api/admin/revenue`

## Data Models

Prisma schema includes:

- `User`
- `RefreshToken`
- `Forge`
- `ForgeMember`
- `Channel`
- `Message`
- `MessageReaction`
- `Thread`
- `Role`
- `MemberRole`
- `Friend`
- `DirectMessageThread`
- `DirectMessageParticipant`
- `Medal`
- `UserMedal`
- `ShopItem`
- `DirectMessage`
- `BillingSubscription`
- `PaymentTransaction`
- `FeatureEntitlement`

## Security Hardenings

- Helmet headers
- Global + auth + message rate limiting
- Password hashing via bcryptjs
- Payload validation via zod
- XSS sanitization for message content
- Anti-spam duplicate/cooldown guard for chat messages
- CSRF double-submit protection (`nf_csrf` cookie + `x-csrf-token` header)
- Presigned object uploads for AWS S3 or Cloudflare R2
- LiveKit token minting for voice channel sessions

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment files:

```bash
copy apps\server\.env.example apps\server\.env
copy apps\web\.env.example apps\web\.env.local
```

Desktop-only launch mode defaults from `apps/web/.env.local`:

```bash
NEXUSFORGE_DESKTOP_ONLY=true
```

When you are ready to launch browser/mobile access, set:

```bash
NEXUSFORGE_DESKTOP_ONLY=false
```

The admin launch-control toggle can override this at runtime through the API and is now persisted in the database. The env value is used as the initial fallback/default.

3. Set `DATABASE_URL` and JWT secrets in `apps/server/.env`.

4. Configure Stripe billing keys and price IDs in `apps/server/.env`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CORE_MONTHLY`
- `STRIPE_PRICE_CORE_YEARLY`
- `STRIPE_PRICE_PLUS_MONTHLY`
- `STRIPE_PRICE_PLUS_YEARLY`
- `STRIPE_PRICE_ELITE_MONTHLY`
- `STRIPE_PRICE_ELITE_YEARLY`
- `STRIPE_PRICE_INFINITE_MONTHLY`
- `STRIPE_PRICE_INFINITE_YEARLY`
- `STRIPE_PRICE_FORGE_BOOST_PACK`
- `STRIPE_PRICE_CREATOR_CAMPAIGN_SLOT`
- `STRIPE_PRICE_EVENT_TICKET_PASS`
- `STRIPE_PRICE_TEAM_BRANDING_KIT`
- `STRIPE_PRICE_ADVANCED_MODERATION_AI`

Set `APP_WEB_URL` to your deployed frontend base URL.

Verify billing readiness before checkout testing:

```bash
curl http://localhost:4000/api/billing/status
```

`ready: true` means Stripe key + all required price IDs are configured.

5. Run migrations for the expanded schema:

```bash
npm run prisma:migrate -w @nexusforge/server
```

6. Generate Prisma client:

```bash
npm run prisma:generate -w @nexusforge/server
```

7. Start both frontend and backend:

```bash
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

8. Launch the desktop shell (Electron):

```bash
npm run desktop:open
```

- Desktop shell target: `http://localhost:3000/app`
- Desktop requests are auto-tagged with `NexusForgeDesktop/<version>` so web middleware can allow desktop-only traffic.
- To run web + server + desktop together from one command, use:

```bash
npm run desktop:full
```

## Desktop Auto-Update (Installed Users)

- Installed desktop users now download updates in the background from `desktop-update.json`.
- On Windows, downloaded updates are staged and auto-installed when the app closes.
- First-time users still install with the public `.exe` link.

Recommended environment variables for durable updates:

```bash
NEXUSFORGE_UPDATE_MANIFEST_URL=https://your-domain.com/desktop-update.json
NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL=https://downloads.your-domain.com
NEXUSFORGE_AUTO_INSTALL_ON_CLOSE=true
```

Release publishing:

- `npm run desktop:share:none` updates `apps/web/public/desktop-update.json` with version, download URL, notes, and `sha256`.
- `npm run desktop:share:force` publishes a required update (`forceUpdate: true`) with a patched desktop version.
- If `NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL` is not set, release uses a Cloudflare quick tunnel URL (ephemeral).

## QA Automation Commands

- `npm run brand:verify` validates required logo and badge assets in `apps/web/public/brand`.
- `npm run admin:badge:smoke` performs an end-to-end admin badge grant and revoke check against the API.

Admin badge smoke test auth inputs:

- Option 1: set `NEXUSFORGE_ADMIN_ACCESS_TOKEN`
- Option 2: set `NEXUSFORGE_ADMIN_EMAIL` and `NEXUSFORGE_ADMIN_PASSWORD`
- Optional target pin: `NEXUSFORGE_BADGE_TEST_USER_ID`

## CI Workflows

- `.github/workflows/brand-verify.yml`: runs `npm run brand:verify` on push and pull requests.
- `.github/workflows/admin-badge-smoke.yml`: runs `npm run admin:badge:smoke` on `main`/`master` pushes and manual dispatch when smoke secrets are configured.

Repository secrets for admin badge smoke CI:

- `NEXUSFORGE_SMOKE_API_URL`
- `NEXUSFORGE_SMOKE_ADMIN_ACCESS_TOKEN` (or `NEXUSFORGE_SMOKE_ADMIN_EMAIL` + `NEXUSFORGE_SMOKE_ADMIN_PASSWORD`)
- Optional: `NEXUSFORGE_SMOKE_BADGE_TEST_USER_ID`
