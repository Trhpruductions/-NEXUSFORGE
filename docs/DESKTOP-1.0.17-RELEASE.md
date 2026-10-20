# Desktop 1.0.17: release readiness (NOT released)

Built locally on 19 Oct 2026; nothing has been uploaded and the live update manifest still says 1.0.16.
Publishing needs the owner's explicit approval (`-OwnerApproved` on the release script).

## The installer

| | |
|---|---|
| File | `apps/desktop/release/Nexus Forge Gaming Desktop Setup 1.0.17.exe` |
| Size | 103,841,167 bytes (99.03 MiB): under GitHub's 100 MiB per-file limit by about 1 MiB |
| SHA-256 | `dcc7728cba275fb6aff9793d1a3e85bab9dc2a06fb7faaeaeb1935f7e2204859` |
| Electron | 42.11.15 (was 42.3.0: security fixes) |
| Code signing | Not signed (same as every earlier version; Windows SmartScreen may warn) |

The first build was 100.51 MiB, too big for the download host. The cause was 19.6 MB of `date-fns`, a
dependency of the repo root that the desktop code never uses. The build now excludes `node_modules`,
because the desktop app uses only Electron and Node's built-in modules. The app bundle went from 22 MB to
1.7 MB.

## What's new for users

- **Full screen (F11):** the title strip hides properly in full screen.
- **Safer by design:** only the Nexus Forge site can talk to the desktop app. Camera, microphone and screen
  access go only to that site (embedded videos can still go full screen). The app ignores settings that
  could point it at another site or turn off certificate checks.
- **Offline page:** when nfgcord.com can't be reached, the app shows its own offline page with Retry and
  reconnects by itself.
- **Recovers from crashes:** if the page crashes it reloads by itself (after 1, 2, then 4 s), then shows a
  "stopped working" page instead of looping.
- **Updates:** a stalled download fails cleanly and is retried, instead of hanging.
- **Start with Windows is now off by default,** with a "Start with Windows" option in the tray menu.
  Existing users who never changed the setting will **stop** starting with Windows after this update.

## Tests run (19-20 Oct 2026)

- Unit tests: 108/108 desktop.
- Two copies of this desktop code (development build, same `main.js`) on the private test site with test
  accounts:
  - both joined the call with live audio both ways;
  - **screen sharing through the app's own picker: 6/6.** The picker lists screens and windows, Cancel
    shares nothing, the other copy received the shared window (solid green) and saw it change to magenta
    live, and stopping removed it with both still in the call;
  - choosing a speaker (output device) works.
- The **packaged app** (the files in the installer), from a scratch profile, public pages only, no sign-in:
  - opens nfgcord.com and ignores a test-site address in its environment (logged);
  - the desktop bridge is on the page and reports 1.0.17;
  - a dev-only bridge call is **refused**;
  - the Windows title bar overlay is active.
  The offline and clean-exit results are in the session report.
- Crash recovery: checked on the development build by the desktop work (forced renderer crashes reloaded
  after 1, 2 and 4 s, then the stop page). Chrome DevTools can't crash an Electron renderer, so it was not
  repeated on the packaged build.

## Compatibility

- The website already supports everything 1.0.17 reports (`fullscreen-state` was added to the website on 18
  Oct). Users on 1.0.16 or older keep working; they're offered 1.0.17 (not forced).
- Packaged builds can no longer be pointed at a test site with `NEXUSFORGE_DESKTOP_URL`. Test with the
  unpackaged `main.js` instead (see the desktop testing notes).

## How to release (owner approval required)

1. Upload the installer to the download host with the release script (`-OwnerApproved`), keeping every older
   installer.
2. Download it back and check its SHA-256 matches the one above.
3. Only then change `desktop-update.json` to 1.0.17 with that SHA-256 (not forced), validate it with
   `node apps/server/scripts/validate-desktop-manifest.mjs`, and check the live copy.

## Rollback

- Before anyone updates: put the manifest back to 1.0.16. Its installer is still on the download host.
- After people have updated: the updater never downgrades, so put the manifest back to 1.0.16 to stop
  further updates. Anyone who needs 1.0.16 back reinstalls it from the download page; their settings are
  kept.

## Known issues

- Not code-signed (needs a certificate; see the signed-update design in the session report).
- Size margin is only about 1 MiB. The next Electron upgrade may cross the 100 MiB limit. Options: keep
  fewer Chromium language packs (about 47 MB unpacked), or host installers on GitHub Releases (2 GB limit).
- Launching the app a second time reloads the page, which can drop a voice call (unchanged from earlier
  versions).
