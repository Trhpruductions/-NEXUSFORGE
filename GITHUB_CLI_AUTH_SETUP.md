# GitHub Release Setup - Authentication Required
**Date:** 2026-07-02  
**Status:** READY - Awaiting GitHub CLI authentication  
**Purpose:** Create GitHub Releases distribution channel as backup to GitHub Pages

---

## PROBLEM

The GitHub Releases setup script requires GitHub CLI authentication:

```
[ERROR] Failed to create release: To get started with GitHub CLI, please run: gh auth login
```

---

## SOLUTION (Choose One)

### Option 1: GitHub CLI Authentication (Recommended)

**Steps:**
1. Open PowerShell or terminal
2. Run: `gh auth login`
3. Select: "GitHub.com"
4. Select: "HTTPS"
5. Select: "Paste an authentication token" or "Yes" for web browser login
6. Either provide a Personal Access Token or follow the browser login flow
7. Confirm: `gh auth status` should show you're logged in

**Verification:**
```powershell
gh auth status
```

**Once authenticated, re-run setup:**
```powershell
cd "d:\NEXUSFORGE GAMGING APP"
powershell -ExecutionPolicy Bypass -File "scripts/setup-github-releases.ps1" -Version "1.0.11"
```

---

### Option 2: Manual GitHub Release Creation (Alternative)

If CLI authentication is problematic, create the release manually:

1. Go to: `https://github.com/Trhpructions/-NEXUSFORGE/releases/new`
2. Tag version: `v1.0.11`
3. Release title: `NexusForge Desktop v1.0.11`
4. Description:
```
## NexusForge v1.0.11 - Production Release

Deterministic window handoff from splash to full app
Automatic local URL recovery retry before fallback
Version-aware cinematic launch screen enhancements
Premium diagnostics panel redesign for recovery mode
Installed-launch resolver and startup telemetry hardening

**SHA256 Checksum:**
c204f8eeed65e3f76a222118ef3be1b390308602158d5daeb7e54da52a649117
```
5. Attach binary: Select `NexusForge Desktop Setup 1.0.11.exe` from `apps/desktop/release/`
6. Click "Publish release"

**Result:** Release v1.0.11 will be created with download URL:
```
https://github.com/Trhpructions/-NEXUSFORGE/releases/download/v1.0.11/NexusForge%20Desktop%20Setup%201.0.11.exe
```

---

### Option 3: Use Personal Access Token (PAT)

If environment variable auth is preferred:

```powershell
# Set GitHub token (get from https://github.com/settings/tokens)
$env:GH_TOKEN = "your_personal_access_token_here"

# Verify
gh auth status

# Run setup
powershell -ExecutionPolicy Bypass -File "scripts/setup-github-releases.ps1" -Version "1.0.11"
```

**Scopes required for PAT:**
- `repo` (full control of private/public repos)
- `workflow` (to update actions)

---

## CURRENT STATE

| Component | Status | Notes |
|-----------|--------|-------|
| **Release v1.0.11** | ⏳ PENDING | Awaiting GitHub CLI auth |
| **Installation Script** | ✅ READY | `scripts/setup-github-releases.ps1` ready to run |
| **Manifest Updated** | ✅ READY | All three channels configured |
| **GitHub Pages** | ⏳ PENDING | Awaiting manual web UI enablement |
| **Raw GitHub CDN** | ✅ ACTIVE | Emergency fallback always available |

---

## PRODUCTION STATUS

**Current Distribution Channels:**
- Channel 1 (GitHub Pages): ❌ Not enabled (requires manual setup)
- Channel 2 (GitHub Releases): ⏳ Awaiting CLI auth
- Channel 3 (raw.githubusercontent.com): ✅ ACTIVE

**Workaround:** Users can currently download from Channel 3 (raw CDN) or manually from GitHub.

---

## RECOMMENDED NEXT STEPS

1. **Authenticate GitHub CLI** (5 minutes)
   ```powershell
   gh auth login
   ```

2. **Run setup script** (1 minute)
   ```powershell
   cd "d:\NEXUSFORGE GAMGING APP"
   powershell -ExecutionPolicy Bypass -File "scripts/setup-github-releases.ps1" -Version "1.0.11"
   ```

3. **Verify release created**
   ```powershell
   gh release view v1.0.11 --repo Trhpructions/-NEXUSFORGE
   ```

4. **Enable GitHub Pages** (5 minutes, manual web UI)
   - Go to: Settings > Pages
   - Select: Deploy from a branch
   - Branch: gh-pages
   - Folder: /
   - Save

5. **Verify all channels**
   ```powershell
   # All three should respond HTTP 200 (2xx)
   Invoke-WebRequest -Uri "https://Trhpructions.github.io/-NEXUSFORGE/desktop-update.json" -UseBasicParsing
   Invoke-WebRequest -Uri "https://github.com/Trhpructions/-NEXUSFORGE/releases/download/v1.0.11/NexusForge%20Desktop%20Setup%201.0.11.exe" -UseBasicParsing
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Trhpructions/-NEXUSFORGE/gh-pages/desktop-update.json" -UseBasicParsing
   ```

---

## ISSUE RESOLUTION

If you see errors during GitHub Release creation:

**Error: "Not Found" (404)**
- Verify repository path: `Trhpructions/-NEXUSFORGE` (case-sensitive)
- Check: `gh repo view Trhpructions/-NEXUSFORGE`

**Error: "Authentication failed"**
- Run: `gh auth logout` then `gh auth login` to re-authenticate
- Check token scopes: needs at least `repo` scope

**Error: "Release already exists"**
- Delete: `gh release delete v1.0.11 -y`
- Re-run setup script

---

## DOCUMENTATION REFERENCES

- **Distribution Strategy:** [DISTRIBUTION_STRATEGY.md](DISTRIBUTION_STRATEGY.md)
- **Resolution Summary:** [RESOLUTION_ALL_PROBLEMS_FIXED.md](RESOLUTION_ALL_PROBLEMS_FIXED.md)
- **Phase 1 Monitoring:** [PHASE_1_KPI_DASHBOARD.md](PHASE_1_KPI_DASHBOARD.md)
