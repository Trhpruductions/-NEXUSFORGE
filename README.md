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

Launch mode defaults from `apps/web/.env.local`:

```bash
NEXUSFORGE_DESKTOP_ONLY=false
```

To enforce desktop-only mode instead, set:

```bash
NEXUSFORGE_DESKTOP_ONLY=true
```

The admin launch-control toggle can override this at runtime through the API and is now persisted in the database. The env value is used as the initial fallback/default.

3. Set `DATABASE_URL` and JWT secrets in `apps/server/.env`.

4. For local development, seed the database with demo accounts and sample profiles:

```bash
cd apps/server
cp .env.example .env
# Update .env values if needed, especially DATABASE_URL and JWT secrets.
npm run prisma:migrate
npm run seed:all
```

A supported demo account is seeded with the email `trhdevelopment@nexusforge.local` and password `Sample!2026`.

5. Configure Stripe billing keys and price IDs in `apps/server/.env`:

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

For remote/off-network users, also set:

- `apps/web/.env.local` (or deployed web env): `NEXT_PUBLIC_API_URL=https://<your-public-api-origin>`
- `apps/web/.env.local` (or deployed web env): `NEXUSFORGE_AGE_GATE_SECRET=<long-random-secret>`
- `apps/server/.env`: `CLIENT_ORIGIN=https://<your-public-web-origin>` (comma-separate multiple origins)

Age-gate hardening note:

- `NEXUSFORGE_AGE_GATE_SECRET` is required in production for signed 18+ verification cookies.
- Keep this secret unique per environment and at least 32 random characters.

For a deployment-ready variable checklist and verification commands, use `DEPLOYMENT_ENV_CHECKLIST.md`.
For platform-specific copy/paste steps (Vercel + Render/Railway), use `DEPLOYMENT_PLATFORM_CHECKLIST.md`.

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
- If local services are unavailable, the desktop shell now auto-recovers to hosted NexusForge when possible.
- To run web + server + desktop together from one command, use:

```bash
npm run desktop:full
```

- To force a hosted/off-network desktop launch path, use:

```bash
npm run desktop:open:hosted
```

- To validate both desktop network paths automatically and record which one connected, use:

```bash
npm run desktop:network:validate
```

- Mode-specific validation commands are also available:
	- `npm run desktop:network:validate:local`
	- `npm run desktop:network:validate:hosted`
- By default, validation is strict: requested mode must match effective mode, or the command fails.
- If you want connectivity-only validation that allows fallback routing, use:
	- `npm run desktop:network:validate:allow-fallback`
- Each validation run writes a JSON report under `apps/desktop/.network-smoke/` with markers and effective connection mode.
- For automation and release hardening, use:

```bash
npm run smoke:release-gate
```

- The release gate runs local smoke + dual desktop connectivity validation (fallback allowed) and writes a stable report to `apps/desktop/.network-smoke/latest-report.json`.
- If you need strict mode matching in CI (requested mode must equal effective mode), use:
	- `npm run smoke:release-gate:strict`
- For one-command operational validation (release gate + bot status/error/alert posting), use:
	- `npm run ops:validate`
	- strict variant: `npm run ops:validate:strict`
- To validate all automation PowerShell scripts for parser correctness, run:
	- `npm run scripts:validate:powershell`
- For repeated durability checks, use:
	- `npm run ops:validate:soak`
	- strict soak: `npm run ops:validate:soak:strict`
	- quick presets: `npm run ops:validate:soak:quick` and `npm run ops:validate:soak:quick:strict`
	- deep presets: `npm run ops:validate:soak:deep` and `npm run ops:validate:soak:deep:strict`
	- deep archived presets: `npm run ops:validate:soak:deep:archive` and `npm run ops:validate:soak:deep:strict:archive`
	- soak report output: `apps/desktop/.network-smoke/ops-soak-latest.json`
	- archived soak reports: `apps/desktop/.network-smoke/history/`
	- trend summaries: `npm run ops:validate:soak:history:summary` and strict-only `npm run ops:validate:soak:history:summary:strict`
	- enforce strict regression guard on latest strict report: `npm run ops:validate:soak:history:guard:strict`
	- enforce full strict guard on latest deep strict report: `npm run ops:validate:soak:history:guard:strict:full`
	- release candidate quick gate (PowerShell parser validation + strict archived soak + strict guard): `npm run ops:validate:candidate:quick`
	- release candidate full gate (PowerShell parser validation + deep strict archived soak + full strict guard): `npm run ops:validate:candidate`
	- release doctor (single-command critical ops gate): `npm run ops:doctor`
	- release doctor with archived output: `npm run ops:doctor:archive`
	- summary output: `apps/desktop/.network-smoke/history/summary-latest.json`
	- release doctor output: `apps/desktop/.network-smoke/release-doctor-latest.json`
	- guard thresholds can target a recent slice of history with `-ThresholdWindowCount` (used by default in guard npm scripts)
	- script supports threshold overrides: `-ThresholdWindowCount`, `-MinReportCount`, `-MinTotalRuns`, `-MinPassRate`, `-MaxWeightedAvgRunDurationMs`, `-MaxLatestAvgRunDurationMs`, `-MaxLatestAvgRunDurationDeltaMs`, `-MaxSampleRunDurationMs`, `-MaxP95RunDurationMs`

- Hosted mode notes:
	- `desktop:open:hosted` sets `NEXUSFORGE_ALLOW_HOSTED_DEV=true` and targets `https://www.nexusforge.app/app`.
	- Electron currently accepts a scoped TLS bypass for `*.nexusforge.app` if the hosted certificate chain is invalid.
	- To enforce strict hosted TLS after the public certificate chain is corrected, set `NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS=false` before launching.

## Desktop Auto-Update (Installed Users)

- Installed desktop users now download updates in the background from `desktop-update.json`.
- On Windows, downloaded updates are staged and auto-installed when the app closes.
- First-time users still install with the public `.exe` link.
- The desktop update manifest may include a `downloadUrls` list so the app can fall back to alternate installer locations.
- When packaged, the app defaults to using the configured desktop host origin for the update manifest, or `NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL` if set.

Recommended environment variables for durable updates:

```bash
NEXUSFORGE_UPDATE_MANIFEST_URL=https://your-domain.com/desktop-update.json
NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL=https://downloads.your-domain.com
NEXUSFORGE_AUTO_INSTALL_ON_CLOSE=true
```

If your public host is not yet serving `/desktop-update.json` from root, set `NEXUSFORGE_UPDATE_MANIFEST_URL` to the shared manifest URL until your durable release host is configured.

Free durable hosting options:
- GitHub Pages or Cloudflare Pages are good no-cost hosts for `desktop-update.json` and installer static assets.
- GitHub Releases can also serve installer binaries for free; host `desktop-update.json` on Pages or another static host, then point `downloadUrl` to the release asset URL.
- Set `NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL` to the static host root for repeatable in-app updates.

GitHub Pages example:
1) Build installer and publish release assets:
   - `npm run desktop:installer`
   - copy `apps/desktop/release/NexusForge Desktop Setup Latest.exe` and `apps/desktop/release/NexusForge Desktop Setup 1.0.11.exe` into a GitHub Pages branch or folder.
2) Publish `apps/web/public/desktop-update.json` to the same Pages root as `/desktop-update.json`.
3) Use `NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL=https://<username>.github.io/<repo>`.
4) Confirm:
   - `https://<username>.github.io/<repo>/desktop-update.json`
   - `https://<username>.github.io/<repo>/NexusForge%20Desktop%20Setup%20Latest.exe`

Alternatively, create and publish the bundle with the helper script:
- `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/publish-desktop-release-gh-pages.ps1 -Force`

If you prefer GitHub Releases for binary hosting:
- Upload the `.exe` asset to the release.
- Set `downloadUrl` in `desktop-update.json` to the GitHub Releases asset URL.
- Keep `desktop-update.json` on a stable static host with `NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL` pointing to that host.

Release publishing:

- `npm run desktop:share:none` updates `apps/web/public/desktop-update.json` with version, download URL, notes, and `sha256`.
- `npm run desktop:share:force` publishes a required update (`forceUpdate: true`) with a patched desktop version.
- `desktop-release-share.ps1` now runs `npm run ops:doctor:archive` before packaging/publishing; release is blocked if doctor fails.
- `npm run desktop:release:bundle` creates a deployment-ready bundle (manifest + stable/versioned installers + nginx snippet + verify instructions) in `apps/desktop/.network-smoke/deploy-bundles/`.
- The bundle manifest is rewritten for root-relative static hosting so you can upload `desktop-update.json` and the installer files together to GitHub Pages or another static root.
- In this bundle form, `desktop-update.json` may use a relative `downloadUrl` such as `NexusForge%20Desktop%20Setup%20Latest.exe`, so the installer binary must be published to the same host root as the manifest.
- No domain/server yet: use temporary publishing with Cloudflare quick tunnel:
	- `npm run desktop:share:temp` (keeps current version, generates temporary download URLs)
	- `npm run desktop:share:temp:patch` (bumps patch version, then publishes temporary URLs)
	- If your network cannot resolve temporary tunnel DNS, use emergency override:
		- `npm run desktop:share:temp:force`
		- This bypasses tunnel DNS/download URL validation and still writes/share links.
	- Keep the terminal session open while sharing temporary URLs, or the tunnel will go offline.
	- This is for beta/testing distribution only, not durable production auto-update hosting.
- Durable release hosting is available once you configure a persistent download base URL:
	- `npm run desktop:share:persistent`
	- `npm run desktop:share:persistent:patch`
	- `npm run desktop:share:persistent:force`
- For durable hosting, set `NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL` to your stable public download host (for example `https://downloads.your-domain.com`).
- The packaged desktop app resolves the manifest to `https://downloads.your-domain.com/desktop-update.json` when this env var is set.
- If your public app host is not serving `/desktop-update.json` directly, set `NEXUSFORGE_UPDATE_MANIFEST_URL` to the shared manifest URL until durable hosting is configured.
- Emergency bypass exists for manual ops only: pass `-SkipDoctor` to `desktop-release-share.ps1`.
- Transport/certificate emergency overrides are available for manual ops only:
	- `-AllowInsecureTlsValidation` allows URL probe with local TLS certificate bypass.
	- `-SkipDownloadUrlValidation` skips installer URL probe entirely.
	- These are non-default and should only be used when host reachability is confirmed through separate checks.
- If `NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL` is not set, release uses a Cloudflare quick tunnel URL (ephemeral).
- Releases also publish a stable installer URL: `.../NexusForge%20Desktop%20Setup%20Latest.exe`.
- `desktop-update.json` always points to this stable URL, so users keep one download link while still receiving new versions.

Post-publish validation (required):

```bash
npm run desktop:release:verify
npm run desktop:update:validate:persistent
npm run desktop:update:validate:insecure
curl -kI "https://your-domain.com/desktop-update.json"
curl -kI "https://your-domain.com/NexusForge%20Desktop%20Setup%20Latest.exe"
```

If your local machine has certificate-chain issues, run:

```bash
npm run desktop:release:verify:insecure
```

One-command deploy (upload + optional nginx reload + verify):

```bash
npm run desktop:release:deploy
```

Env-driven one-click deploy (recommended for repeat releases):

1. Copy [scripts/desktop-release-deploy.env.sample](scripts/desktop-release-deploy.env.sample) to [scripts/desktop-release-deploy.env](scripts/desktop-release-deploy.env).
2. Fill in your host/user/path values.
3. Run:

```bash
npm run desktop:release:deploy:env
```

If your local machine needs TLS bypass for verification:

```bash
npm run desktop:release:deploy:env:insecure
```

Required deployment env vars:

- `NEXUSFORGE_DEPLOY_HOST` (example: `www.nexusforge.app`)
- `NEXUSFORGE_DEPLOY_USER` (remote SSH user)
- `NEXUSFORGE_DEPLOY_WEBROOT` (remote public web root path)

Optional deployment env vars:

- `NEXUSFORGE_DEPLOY_SSH_KEY_PATH` (private key path for SSH/SCP)
- `NEXUSFORGE_DEPLOY_PORT` (SSH/SCP port, default `22`)
- `NEXUSFORGE_DEPLOY_NGINX_SNIPPET_PATH` (remote path to upload `nginx-desktop-release.conf`; when set, script runs `sudo nginx -t && sudo systemctl reload nginx` unless `-SkipNginxReload` is passed)

The deploy command automatically selects the latest bundle from `apps/desktop/.network-smoke/deploy-bundles/`.
You can override inputs manually, for example:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/deploy-desktop-web-release.ps1 -BundleDir ./apps/desktop/.network-smoke/deploy-bundles/desktop-release-20260514-190635 -RemoteHost your-host -RemoteUser your-user -RemoteWebRoot /var/www/nexusforge -RemoteNginxSnippetPath /etc/nginx/snippets/nexusforge-desktop-release.conf -VerifyInsecure
```

Expected:

- `desktop-update.json` returns JSON (not HTML)
- installer URL returns `application/octet-stream` (not HTML)
- To auto-refresh the Discord `app-downloads` embed on every release, set:
	- `DISCORD_BOT_TOKEN=<bot-token>`
	- `DISCORD_DOWNLOAD_TARGET_ID=<guild-or-category-id>`
	- optional: `DISCORD_DOWNLOAD_CHANNEL_NAME=app-downloads`

## Discord Bot Setup

The API server can run an integrated Discord bot with slash commands.

Bot runtime and issue-notification probe:

- Run `npm run discord:probe` to verify the bot is connected and able to post status/error/alert messages.
- You can optionally pass a guild/category/channel ID: `npm run discord:probe -- <targetId>`.
- Target resolution order: argv target, `DISCORD_REPORT_GUILD_ID`, `DISCORD_GUILD_ID`, then `DISCORD_DOWNLOAD_TARGET_ID`.
- This probe checks `/api/health/discord` and posts test messages to:
	- `DISCORD_REPORT_CHANNEL_STATUS` (default `bot-status`)
	- `DISCORD_REPORT_CHANNEL_ERRORS` (default `bot-errors`)
	- `DISCORD_REPORT_CHANNEL_ALERTS` (default `bot-alerts`)

Environment variables (apps/server/.env):

```bash
DISCORD_BOT_ENABLED=true
DISCORD_BOT_TOKEN=<bot-token>
DISCORD_CLIENT_ID=<application-client-id>
DISCORD_PUBLIC_KEY=<application-public-key>
DISCORD_REGISTER_COMMANDS_ON_START=true
DISCORD_GUILD_ID=<optional-fast-dev-guild-id>
DISCORD_INSTALL_URL=https://discord.com/oauth2/authorize?client_id=<application-client-id>&scope=bot%20applications.commands
DISCORD_REPORT_ENABLED=true
DISCORD_REPORT_GUILD_ID=<optional-reporting-guild-id>
DISCORD_REPORT_CHANNEL_STATUS=bot-status
DISCORD_REPORT_CHANNEL_ERRORS=bot-errors
DISCORD_REPORT_CHANNEL_ALERTS=bot-alerts
```

Notes:

- `DISCORD_GUILD_ID` is optional. If provided, commands register instantly in that guild.
- Without `DISCORD_GUILD_ID`, commands are registered globally and can take longer to appear.
- The bot starts automatically with the API when `DISCORD_BOT_ENABLED=true`.
- Set `DISCORD_REGISTER_COMMANDS_ON_START=false` if you want to run the bot without command auto-registration.
- If `DISCORD_INSTALL_URL` is not set, the generated install URL is pinned to `DISCORD_GUILD_ID` when provided.
- If reporting is enabled, the bot posts startup and error events to the configured ops channels.

Discord interactions webhook endpoint:

- `POST /api/discord/interactions`
- Signature verified using `DISCORD_PUBLIC_KEY`.
- Keep this endpoint public only behind HTTPS when used with Discord Interactions URL.

Included slash commands:

- `/ping` - bot latency check
- `/app` - app and install links
- `/status` - API launch mode summary

Preflight check before starting the API:

```bash
npm run discord:whoami -w @nexusforge/server
npm run discord:verify -w @nexusforge/server
```

`discord:whoami` prints which bot user the token belongs to.
`discord:verify` verifies `DISCORD_BOT_TOKEN` belongs to `DISCORD_CLIENT_ID` and fails fast on mismatches.
If `DISCORD_GUILD_ID` is set, it also verifies the bot can access that target.
`DISCORD_GUILD_ID` (or argv[2]) can be a guild ID, category ID, or channel ID; verification resolves channel/category targets to their parent guild.

Mismatch remediation:

- If `discord:verify` reports token/client mismatch, run `discord:whoami` and align `DISCORD_CLIENT_ID` to the reported bot ID.
- If you intended a different application, rotate `DISCORD_BOT_TOKEN` for that intended application instead of changing client ID.

Discord release channel automation:

- `npm run discord:setup:channels -w @nexusforge/server -- <guild-or-category-or-channel-id>` ensures ops channels exist and creates a NexusForge role plus a protected NexusForge Ops category.
- `npm run discord:post:download -w @nexusforge/server -- <guild-or-category-id> app-downloads` posts the latest installer/launcher/update-manifest embed from `apps/web/public/desktop-update.json`.
- `npm run desktop:manifest:validate -w @nexusforge/server` validates `apps/web/public/desktop-update.json` schema before posting/releasing.

## QA Automation Commands

- `npm run brand:verify` validates required logo and badge assets in `apps/web/public/brand`.
- `npm run admin:badge:smoke` performs an end-to-end admin badge grant and revoke check against the API.
- `npm run age:gate:validate:local` validates 18+ gate security controls locally (cross-origin blocking, no-store headers, cookie issuance, and rate limiting).
- `npm run build` runs the resilient workspace build pipeline (brand verify + web build with one-time transient Next.js retry + server build).
- `npm run desktop:installer` runs resilient desktop installer packaging (workspace build + Windows package with one lock-recovery retry).
- `npm run desktop:release:checklist` runs release readiness checks in one command: build/package, launch unpacked app, launch installed app, and summary.

Desktop packaging resilience details:

- The build pipeline retries web build once only for known transient Next.js page-module lookup failures (such as `/favicon.ico` and `/_document`).
- The installer pipeline retries packaging once if `win-unpacked` is file-locked (`Access is denied` / `ERR_ELECTRON_BUILDER_CANNOT_EXECUTE`) after targeted Windows process cleanup.

Admin badge smoke test auth inputs:

- Option 1: set `NEXUSFORGE_ADMIN_ACCESS_TOKEN`
- Option 2: set `NEXUSFORGE_ADMIN_EMAIL` and `NEXUSFORGE_ADMIN_PASSWORD`
- Optional target pin: `NEXUSFORGE_BADGE_TEST_USER_ID`

## CI Workflows

- `.github/workflows/brand-verify.yml`: runs `npm run brand:verify` on push and pull requests.
- `.github/workflows/admin-badge-smoke.yml`: runs `npm run admin:badge:smoke` on `main`/`master` pushes and manual dispatch when smoke secrets are configured.
- `.github/workflows/discord-download-link-sync.yml`: runs on `main`/`master` pushes when `apps/web/public/desktop-update.json` changes (or manual dispatch) and upserts the Discord `app-downloads` embed with the latest installer/manifest links.
- `.github/workflows/release-pr-guard.yml`: runs on release-related pull requests and fails fast when `desktop-update.json` is malformed or Discord sync secrets are missing.

Repository secrets for admin badge smoke CI:

- `NEXUSFORGE_SMOKE_API_URL`
- `NEXUSFORGE_SMOKE_ADMIN_ACCESS_TOKEN` (or `NEXUSFORGE_SMOKE_ADMIN_EMAIL` + `NEXUSFORGE_SMOKE_ADMIN_PASSWORD`)
- Optional: `NEXUSFORGE_SMOKE_BADGE_TEST_USER_ID`

Repository secrets for Discord download-link sync CI:

- `DISCORD_BOT_TOKEN`
- One of: `DISCORD_DOWNLOAD_TARGET_ID` or `DISCORD_REPORT_GUILD_ID` or `DISCORD_GUILD_ID` (guild/category/channel ID for release-channel resolution)

Release PR guard enforcement:

- Pull requests touching release-link automation fail unless `DISCORD_BOT_TOKEN` and at least one target secret (`DISCORD_DOWNLOAD_TARGET_ID` or `DISCORD_REPORT_GUILD_ID` or `DISCORD_GUILD_ID`) are configured.
- Pull requests touching release-link automation fail if `apps/web/public/desktop-update.json` is invalid JSON or has invalid field types/values.

Repository variables for Discord download-link sync CI:

- Optional: `DISCORD_DOWNLOAD_CHANNEL_NAME` (default: `app-downloads`)
- Optional: `APP_WEB_URL` (used by the embed script to compute launcher URL when provided)
- Optional: `DISCORD_DOWNLOAD_MESSAGE_ID` (forces update of a specific existing download embed message to prevent duplicate posts)
