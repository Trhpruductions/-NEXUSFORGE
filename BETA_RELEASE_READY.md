# NexusForge Desktop Beta Release Ready

## Current Beta Distribution

The temporary beta release is live and validated via Cloudflare quick tunnel.

- Desktop manifest: https://queens-workshops-protest-russia.trycloudflare.com/desktop-update.json
- Stable installer: https://queens-workshops-protest-russia.trycloudflare.com/NexusForge%20Desktop%20Setup%20Latest.exe
- Versioned installer: https://queens-workshops-protest-russia.trycloudflare.com/NexusForge%20Desktop%20Setup%201.0.11.exe

## Validation Status

- `npm run desktop:update:validate -- --base "https://queens-workshops-protest-russia.trycloudflare.com" --insecure` passed successfully.
- Temporary desktop update host returns both manifest and installer correctly.
- Local build and desktop release package are confirmed working.

## Local Hosting

To host the desktop release locally on `http://127.0.0.1:3200`:

```powershell
npm run desktop:share:local
```

This builds the installer, starts a local file server on `127.0.0.1:3200`, and updates `apps/web/public/desktop-update.json` with the local manifest URL.

Then open the desktop app with `NEXUSFORGE_UPDATE_MANIFEST_URL=http://127.0.0.1:3200/desktop-update.json` if needed.

## Notes

- This is an **ephemeral beta distribution**. The tunnel will remain active only while the current PowerShell session is open.
- The public production host `https://www.nexusforge.app` is not yet published with the desktop release assets.
- Production deployment requires SSH access to the hosted web root and real deploy credentials.

## Next Step for Production Release

Fill in `scripts/desktop-release-deploy.env` with the correct values:

- `NEXUSFORGE_DEPLOY_HOST`
- `NEXUSFORGE_DEPLOY_USER`
- `NEXUSFORGE_DEPLOY_WEBROOT`

Optional:

- `NEXUSFORGE_DEPLOY_SSH_KEY_PATH`
- `NEXUSFORGE_DEPLOY_NGINX_SNIPPET_PATH`

Then run:

```powershell
npm run desktop:release:deploy:env
```

## Internal Validation Update (2026-05-20)

- `apps/web` production build completed successfully with no warnings after cleanup.
- `apps/server` TypeScript build completed successfully.
- `apps/web/public/desktop-update.json` validated as correct and release-ready.
- Local backend health checked successfully at `http://127.0.0.1:4001/api/health`.
- Runtime launch mode confirmed `desktopOnly: false` at `http://127.0.0.1:4001/api/runtime/launch-mode`.
- Discord runtime probe passed for guild `1445242974245228678` using `NEXUSFORGE_API_BASE=http://127.0.0.1:4001`.

## Current Recommendation

Keep public domain hosting deferred until the app and desktop release are ready for external distribution. Focus next on internal desktop release artifacts, packaging, and distribution notes.
