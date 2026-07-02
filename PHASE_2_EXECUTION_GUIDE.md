# PHASE 2 EXECUTION GUIDE — Manual Setup (20 Minutes)
**Status:** Diagnostics Complete, Ready for Execution  
**Date:** 2026-07-02  
**Prerequisites:** ✓ GitHub CLI installed, ✓ Installer file present, ⏳ GitHub CLI auth needed

---

## STEP 1: GitHub CLI Authentication (5 minutes)

### Why This Step
GitHub CLI needs authentication to create GitHub Releases and upload files.

### How to Authenticate

**Run this command in PowerShell:**
```powershell
gh auth login
```

**Follow the prompts:**
1. **First prompt - "What account do you want to log into?"**
   - Select: **GitHub.com** (just press Enter or select option 1)

2. **Second prompt - "What is your preferred protocol for Git operations?"**
   - Select: **HTTPS** (press Enter or select option 2)

3. **Third prompt - "Authenticate Git with your GitHub credentials?"**
   - Select: **Yes**

4. **Final prompt - "How would you like to authenticate GitHub CLI?"**
   - Select: **Login with a web browser** (easiest option)
   - Your browser will open automatically
   - Log in with your GitHub credentials
   - Authorize the GitHub CLI application
   - Return to PowerShell window (should confirm success)

### Verify Success
```powershell
gh auth status
```

**Expected output:**
```
Logged in to github.com as Trhpructions (keyring)
  Git operations for github.com uses the keyring credential helper
  Token: gho_****...
```

### Troubleshooting
- **Browser doesn't open:** Visit the URL shown in terminal manually
- **Already logged in to wrong account:** Run `gh auth logout` then `gh auth login` again
- **Token expired:** Run `gh auth logout` then `gh auth login` to refresh

---

## STEP 2: Create GitHub Release v1.0.11 (1 minute)

### Why This Step
Creates GitHub Release as backup distribution channel.

### Prerequisites
✓ GitHub CLI must be authenticated (Step 1 complete)

### How to Execute

**Run this command:**
```powershell
cd "d:\NEXUSFORGE GAMGING APP"
powershell -ExecutionPolicy Bypass -File "scripts/setup-github-releases.ps1" -Version "1.0.11"
```

### Expected Output
```
=== GitHub Releases Distribution Setup ===
[INFO] Installer: apps/desktop/release/NexusForge Desktop Setup 1.0.11.exe
[INFO] Size: 98.7 MB

[STEP 1] Checking if release v1.0.11 exists...
[OK] Release v1.0.11 does not exist (new release)

[STEP 2] Creating GitHub release...
[OK] Release v1.0.11 created successfully
  Title: NexusForge Desktop v1.0.11
  Tag: v1.0.11

[STEP 3] Computing SHA256...
[OK] SHA256: c204f8eeed65e3f76a222118ef3be1b390308602158d5daeb7e54da52a649117

[STEP 4] Uploading installer...
[OK] Asset 'NexusForge Desktop Setup 1.0.11.exe' uploaded successfully
  Size: 98.7 MB
  Download URL: https://github.com/Trhpructions/-NEXUSFORGE/releases/download/v1.0.11/NexusForge%20Desktop%20Setup%201.0.11.exe

=== SUCCESS ===
Release v1.0.11 created and ready for distribution
GitHub Releases Channel: ACTIVE ✓
```

### Verify Success
```powershell
# Check release was created
gh release view v1.0.11 --repo Trhpructions/-NEXUSFORGE

# Open in browser
https://github.com/Trhpructions/-NEXUSFORGE/releases/tag/v1.0.11
```

### Troubleshooting
**Error: "Release already exists"**
```powershell
# Delete and recreate
gh release delete v1.0.11 -y
# Then re-run the setup script
```

**Error: "Not Found"**
- Verify repository name: `Trhpructions/-NEXUSFORGE` (case-sensitive)
- Check authentication: `gh auth status`

---

## STEP 3: Enable GitHub Pages (5 minutes)

### Why This Step
Activates primary CDN distribution channel.

### Prerequisites
✓ Have GitHub repository access  
✓ Can use web browser

### How to Execute (Manual Web UI)

**1. Navigate to Repository Settings**
```
URL: https://github.com/Trhpructions/-NEXUSFORGE/settings/pages
Or: Repository > Settings > Pages (in left sidebar)
```

**2. Configure GitHub Pages**

**Build and Deployment Section:**
- Source: Select **"Deploy from a branch"**
- Branch: Select **"gh-pages"**
- Folder: Select **"/ (root)"**
- Click: **Save**

**3. Wait for Deployment**
- GitHub will begin building (30 seconds to 2 minutes)
- You'll see a yellow/blue status banner at top
- When complete, banner turns green with link:
  ```
  Your site is live at https://Trhpructions.github.io/-NEXUSFORGE/
  ```

### Verify Success

**Visit these URLs (should both return content):**
```
https://Trhpructions.github.io/-NEXUSFORGE/
https://Trhpructions.github.io/-NEXUSFORGE/desktop-update.json
```

**Expected responses:**
- First URL: Directory listing or index.html
- Second URL: JSON manifest with download channels

**If still showing 404:**
- Verify Settings > Pages shows "Deploy from a branch" with gh-pages selected
- Wait 5-10 minutes (GitHub sometimes takes longer)
- Force refresh browser (Ctrl+Shift+R)
- Check `.nojekyll` file exists on gh-pages branch

### Screenshots/Help
- [GitHub Pages documentation](https://docs.github.com/en/pages)
- [GitHub Pages deployment guide](https://docs.github.com/en/pages/getting-started-with-github-pages)

---

## STEP 4: Verify All Distribution Channels (5 minutes)

### Why This Step
Confirm all three channels are accessible before declaring Phase 2 complete.

### How to Execute

**Run this PowerShell script:**

```powershell
Write-Host "=== Distribution Channel Verification ===" -ForegroundColor Cyan

$channels = @(
    @{
        name = "Channel 1: GitHub Pages CDN"
        url = "https://Trhpructions.github.io/-NEXUSFORGE/desktop-update.json"
        priority = 1
    },
    @{
        name = "Channel 2: GitHub Releases"
        url = "https://github.com/Trhpructions/-NEXUSFORGE/releases/download/v1.0.11/NexusForge%20Desktop%20Setup%201.0.11.exe"
        priority = 2
    },
    @{
        name = "Channel 3: Raw GitHub CDN"
        url = "https://raw.githubusercontent.com/Trhpructions/-NEXUSFORGE/gh-pages/desktop-update.json"
        priority = 3
    }
)

$passed = 0
$failed = 0

foreach ($channel in $channels) {
    try {
        $response = Invoke-WebRequest -Uri $channel.url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "[✓ PASS] $($channel.name)" -ForegroundColor Green
            Write-Host "         HTTP $($response.StatusCode), Size: $($response.RawContentLength) bytes" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "[✗ FAIL] $($channel.name)" -ForegroundColor Red
            Write-Host "         HTTP $($response.StatusCode)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "[✗ FAIL] $($channel.name)" -ForegroundColor Red
        Write-Host "         Error: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "=== RESULTS ===" -ForegroundColor Cyan
Write-Host "Passed: $passed / Failed: $failed" -ForegroundColor $(if ($passed -ge 2) { "Green" } else { "Red" })

if ($passed -ge 2) {
    Write-Host "✓ Production ready: At least 2 channels operational" -ForegroundColor Green
} elseif ($passed -eq 1) {
    Write-Host "⚠ Degraded: Only 1 channel operational (should be 2-3)" -ForegroundColor Yellow
} else {
    Write-Host "✗ Critical: No channels responding (should be 2-3)" -ForegroundColor Red
}
```

### Expected Results

**Perfect (3/3):**
```
[✓ PASS] Channel 1: GitHub Pages CDN - HTTP 200
[✓ PASS] Channel 2: GitHub Releases - HTTP 200
[✓ PASS] Channel 3: Raw GitHub CDN - HTTP 200

Results: Passed 3/3 ✓ EXCELLENT
```

**Acceptable (2+/3):**
```
[✓ PASS] Channel 2: GitHub Releases - HTTP 200
[✓ PASS] Channel 3: Raw GitHub CDN - HTTP 200
[✗ FAIL] Channel 1: GitHub Pages CDN - 404 (pending enablement)

Results: Passed 2/3 ✓ PRODUCTION READY
```

**Not Acceptable (<2):**
- Indicates Channel 2 and/or 3 not working
- Check GitHub Releases setup and raw CDN URLs
- Troubleshoot using documentation

### Troubleshooting

**If Channel 1 (GitHub Pages) still 404:**
- Verify Settings > Pages has gh-pages selected
- Wait 5-10 minutes (sometimes takes longer)
- Check .nojekyll file exists
- Fallback: Channels 2-3 always available

**If Channel 2 (GitHub Releases) fails:**
- Verify release was created: `gh release view v1.0.11 --repo Trhpructions/-NEXUSFORGE`
- Check URL has correct version: v1.0.11
- Confirm installer filename is correct

**If Channel 3 (Raw CDN) fails:**
- This should never fail - always available
- If failing, check internet connectivity
- Try in incognito/private browser

---

## STEP 5: Run Final Production Validation (1 minute)

### Why This Step
Confirms all production systems operational with multi-channel distribution active.

### How to Execute

```powershell
cd "d:\NEXUSFORGE GAMGING APP"
powershell -ExecutionPolicy Bypass -File "scripts/phase-1-daily-validation.ps1"
```

### Expected Output
```
=== Phase 1 Daily Validation ===
Started: 2026-07-02 XX:XX:XX UTC

[PASS] Backend API: HTTP 200
[PASS] Web Frontend: HTTP 200
[PASS] Installer: Verified
[PASS] PM2 Processes: 2 online
[PASS] Discord Bot: Connected
[PASS/FAIL] GitHub Pages: (depends on Step 3)
[PASS] Raw GitHub CDN: HTTP 200

=== Summary ===
[PASS] 6-8 tests
[FAIL] 0-2 tests (expected: GitHub Pages if not enabled yet)

Overall: ✓ PRODUCTION READY
```

### Success Criteria
- ✅ Backend API: PASS
- ✅ Web Frontend: PASS
- ✅ PM2 Processes: PASS
- ✅ Discord Bot: PASS
- ✅ At least 2 distribution channels: PASS

---

## EXECUTION TIMELINE

| Step | Task | Time | Status |
|------|------|------|--------|
| 1 | GitHub CLI auth | 5 min | ⏳ PENDING |
| 2 | Create GitHub Release | 1 min | ⏳ BLOCKED (needs Step 1) |
| 3 | Enable GitHub Pages | 5 min | ⏳ PENDING |
| 4 | Verify channels | 5 min | ⏳ BLOCKED (needs Steps 2-3) |
| 5 | Run validation | 1 min | ⏳ BLOCKED (needs Steps 2-4) |

**Total Time:** ~20 minutes  
**Blocking Item:** GitHub CLI authentication (Step 1)

---

## IMMEDIATE ACTION ITEMS

### RIGHT NOW:
1. Open PowerShell or Terminal
2. Run: `gh auth login`
3. Follow browser prompts to authenticate
4. Verify: `gh auth status` (should show logged in)

### THEN (Sequential):
1. Run setup script (Step 2)
2. Enable GitHub Pages (Step 3)
3. Test channels (Step 4)
4. Run validation (Step 5)

---

## SUCCESS CRITERIA (All Must Pass)

✅ GitHub CLI authenticated  
✅ GitHub Release v1.0.11 created  
✅ GitHub Pages enabled (or will enable shortly)  
✅ At least 2/3 distribution channels HTTP 200  
✅ Phase 1 validation: 6+ PASS  

**When all criteria met:** Phase 2 COMPLETE → Production 100% Ready

---

## DOCUMENTATION REFERENCES

- **Setup Checklist:** [PRODUCTION_MANUAL_SETUP_CHECKLIST.md](PRODUCTION_MANUAL_SETUP_CHECKLIST.md)
- **GitHub CLI Help:** [GITHUB_CLI_AUTH_SETUP.md](GITHUB_CLI_AUTH_SETUP.md)
- **Distribution Strategy:** [DISTRIBUTION_STRATEGY.md](DISTRIBUTION_STRATEGY.md)
- **Troubleshooting:** [PRODUCTION_MANUAL_SETUP_CHECKLIST.md](PRODUCTION_MANUAL_SETUP_CHECKLIST.md) - Step-by-step help

---

## READY TO START?

**Next Command to Run:**
```powershell
gh auth login
```

This opens the GitHub authentication flow. Once complete, all remaining steps can proceed automatically or with minimal web UI interaction.

---

**Status:** 🟡 READY FOR EXECUTION  
**First Blocker:** GitHub CLI authentication needed  
**Est. Time to Complete:** 20 minutes from now
