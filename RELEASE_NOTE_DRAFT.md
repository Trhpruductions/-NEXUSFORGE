# NexusForge Internal Release Note Draft

## Release Summary
- Fix applied: removed desktop-only / age-gate blocking for web routes.
- New account registration now redirects into `/app` and maintains authenticated session.
- Local web app validated across core routes: `/app`, `/app/profile`, `/app/settings`, `/app/downloads`, `/app/join`, `/app/voice`, `/app/server`, `/app/rewards`, `/app/friends`, `/app/activity`, `/app/games`, `/leaderboards`, and `/search`.

## Build Validation
- `npm --prefix apps/web run build` passed successfully.
- `npm --prefix apps/server run build` passed successfully.
- Desktop manifest validated: `apps/web/public/desktop-update.json`.
- Backend health verified: `http://127.0.0.1:4001/api/health` → `status: ok`.
- Runtime launch mode confirmed: `desktopOnly: false` via `http://127.0.0.1:4001/api/runtime/launch-mode`.
- Discord runtime probe passed for guild `1445242974245228678` using local API base `http://127.0.0.1:4001`.

## Notes
- Public website / domain hosting is intentionally deferred for later; this release is focused on internal app readiness.
- The local service stack is validated and ready for internal desktop release packaging.

## Recommended Next Step
- Keep the current branch/build artifacts for internal distribution.
- Prepare the desktop release packaging flow and distribution notes for the next internal release.

## Discord Status Message Draft
> NexusForge internal release validation completed.
> 
> - Web fix applied: account signup now enters `/app` directly.
> - Web and server builds passed.
> - Backend health ok on `127.0.0.1:4001`.
> - Desktop manifest validated.
> - Discord probe passed for guild `1445242974245228678`.
> 
> Public domain deployment is deferred; focusing on internal release readiness.
