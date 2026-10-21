# Release approval on GitHub

A new desktop version reaches players in two ways: the installer and `desktop-update.json` on the download
site, and a "new version" post in the Discord `#app-downloads` channel. The owner approves both.

- On this PC, every release script refuses to run without `-OwnerApproved` (see the README).
- On GitHub, the Discord post is made by the **discord-download-link-sync** workflow after a merge to `main`
  that changes `apps/web/public/desktop-update.json`. That job waits for the **release-approval** environment.

**Created on 21 Oct 2026** (owner's request): environment `release-approval` with **Trhpruductions** as
required reviewer (self-review allowed, since there is one reviewer) and deployments only from `main`. It has
no secrets yet. Step 1 below is done; the Discord secrets (step 6) go into this environment, never into
repository secrets.

## 1. Create the environment (owner, about 3 minutes)

1. Open https://github.com/Trhpruductions/-NEXUSFORGE and click **Settings**.
2. In the left menu click **Environments**, then **New environment**.
3. Name it exactly `release-approval` and click **Configure environment**.
4. Under **Deployment protection rules**, tick **Required reviewers**, type `Trhpruductions` (add anyone else
   who may approve releases) and click **Save protection rules**.
   Leave **Prevent self-review** unticked if you are the only reviewer, or you could never approve.
5. Under **Deployment branches and tags**, choose **Selected branches and tags**, click
   **Add deployment branch or tag rule**, enter `main` and save. Runs from other branches can then never use it.
6. Under **Environment secrets**, click **Add environment secret** for each of these (they are only
   handed to a run after you approve it, unlike repository secrets):
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_DOWNLOAD_TARGET_ID` (or `DISCORD_REPORT_GUILD_ID` / `DISCORD_GUILD_ID`)
7. Optional, under **Environment variables**: `DISCORD_DOWNLOAD_CHANNEL_NAME` (default `app-downloads`),
   `APP_WEB_URL` (for example `https://nfgcord.com`), `DISCORD_DOWNLOAD_MESSAGE_ID`.

Do not add the Discord secrets under **Settings > Secrets and variables > Actions > Repository secrets**: every
workflow on every branch can read those, with no approval.

## 2. Approving a release

1. After the merge, open the **Actions** tab. The **discord-download-link-sync** run shows
   **Waiting** with a yellow "Review deployments" banner.
2. Check the version and notes, click **Review deployments**, tick **release-approval**, then
   **Approve and deploy** (or **Reject**). Nothing is posted until you approve.

The **Release PR Guard** check on the pull request only warns when it cannot see the Discord secrets; that is
expected once they are environment secrets.

## 3. Protect the main branch (recommended)

**Settings > Rules > Rulesets > New ruleset > New branch ruleset**, name `main`, **Enforcement status: Active**,
**Target branches: Add target > Include default branch**, then tick:

- **Restrict deletions** and **Block force pushes**.
- **Require a pull request before merging**. Set **Required approvals** to 0 while you are the only maintainer
  (GitHub does not let you approve your own pull request); raise it to 1 when a second maintainer joins.
- **Require status checks to pass**, and add these checks (they appear after one CI run on a pull request):
  `Server (typecheck, tests, build)`, `Web (typecheck, lint, unit tests, build)`, `Desktop (unit tests)`,
  `brand-verify`. Do not add the Release PR Guard checks: they only run when release files change, so they
  would block every other pull request.

Leave yourself in the **Bypass list** (Repository admin) so you can still fix an emergency.

Also worth adding: a second branch ruleset for `gh-pages` (the download site) with **Restrict deletions** and
**Block force pushes**. Normal release pushes still work; a force push that replaces the whole download site
(as `scripts/publish-desktop-release-gh-pages.ps1` does) is then refused by GitHub.

## 4. Actions settings (already correct, keep them)

**Settings > Actions > General**:

- **Workflow permissions**: "Read repository contents and packages permissions" (currently set), and
  "Allow GitHub Actions to create and approve pull requests" off (currently off).
- Optional: tick **Require actions to be pinned to a full-length commit SHA**. Every workflow in this repo is
  already pinned that way.
