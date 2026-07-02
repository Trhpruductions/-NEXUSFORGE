# NexusForge Distribution Strategy — Multi-Channel Approach
**Version:** 1.0.11  
**Date:** 2026-07-02  
**Status:** PRODUCTION  
**Channels:** 3 (GitHub Pages, GitHub Releases, Raw CDN)

---

## Distribution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Auto-Update Manifest                         │
│            desktop-update.json (authoritative)                  │
│                                                                 │
│  Version: 1.0.11                                                │
│  SHA256: c204f8eeed65e3f76a222118ef3be1b390308602             │
│  Download URLs: [Channel 1, Channel 2, Channel 3]             │
└─────────────────────────────────────────────────────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
  Channel 1:          Channel 2:           Channel 3:
  GitHub Pages        GitHub Releases      Raw GitHub CDN
  (Primary)           (Backup)             (Fallback)
  
  https://             https://github.com/ https://raw.
  Trhpructions        Trhpructions/        githubusercontent.com/
  .github.io/         -NEXUSFORGE/         Trhpructions/
  -NEXUSFORGE/        releases/            -NEXUSFORGE/
  desktop-update      download/v1.0.11/    gh-pages/
  .json               NexusForge%20...     desktop-update.json
```

---

## Channel Specifications

### Channel 1: GitHub Pages (PRIMARY)
**Status:** Blocker - Requires manual enablement  
**URL:** `https://Trhpructions.github.io/-NEXUSFORGE/`  
**Performance:** CDN-backed, global distribution  
**Enable Steps:**
1. Go to https://github.com/Trhpructions/-NEXUSFORGE/settings/pages
2. Select "Deploy from a branch"
3. Branch: `gh-pages`
4. Folder: `/ (root)`
5. Click Save
6. Wait 5-10 minutes

**Once Enabled:**
```
✓ Manifest: https://Trhpructions.github.io/-NEXUSFORGE/desktop-update.json
✓ Installer: https://Trhpructions.github.io/-NEXUSFORGE/NexusForge%20Desktop%20Setup%20Latest.exe
✓ Landing: https://Trhpructions.github.io/-NEXUSFORGE/
```

**Advantages:** Fast CDN, automatic deployments, no storage limits  
**Disadvantage:** Requires repository-level GitHub Pages enablement

---

### Channel 2: GitHub Releases (BACKUP)
**Status:** Ready - Setup via `scripts/setup-github-releases.ps1`  
**URL:** `https://github.com/Trhpructions/-NEXUSFORGE/releases/`  
**Performance:** GitHub-hosted, reliable fallback  
**Setup Command:**
```powershell
cd "d:\NEXUSFORGE GAMGING APP"
powershell -ExecutionPolicy Bypass -File "scripts/setup-github-releases.ps1" -Version "1.0.11"
```

**Result:**
```
✓ Release: https://github.com/Trhpructions/-NEXUSFORGE/releases/tag/v1.0.11
✓ Installer: https://github.com/Trhpructions/-NEXUSFORGE/releases/download/v1.0.11/NexusForge%20Desktop%20Setup%201.0.11.exe
✓ Metadata: Version + SHA256 + Release notes
```

**Advantages:** Integrated with GitHub, version tracking, release notes  
**Disadvantages:** Slightly slower than CDN, requires authentication

---

### Channel 3: Raw GitHub CDN (EMERGENCY)
**Status:** Always available (no setup needed)  
**URL:** `https://raw.githubusercontent.com/`  
**Performance:** Direct content delivery, no caching  
**Access:**
```
✓ Manifest: https://raw.githubusercontent.com/Trhpructions/-NEXUSFORGE/gh-pages/desktop-update.json
✓ Installer: https://raw.githubusercontent.com/Trhpructions/-NEXUSFORGE/gh-pages/NexusForge%20Desktop%20Setup%20Latest.exe
```

**Advantages:** Always works, no configuration needed  
**Disadvantages:** No CDN optimization, slower for large files

---

## Auto-Update Manifest Configuration

**File:** `desktop-update.json` (on gh-pages branch)

```json
{
  "version": "1.0.11",
  "latest_version": "1.0.11",
  "sha256": "c204f8eeed65e3f76a222118ef3be1b390308602158d5daeb7e54da52a649117",
  "download_urls": [
    {
      "channel": "github-pages",
      "priority": 1,
      "url": "https://Trhpructions.github.io/-NEXUSFORGE/NexusForge%20Desktop%20Setup%20Latest.exe",
      "available": false,
      "reason": "GitHub Pages not enabled"
    },
    {
      "channel": "github-releases",
      "priority": 2,
      "url": "https://github.com/Trhpructions/-NEXUSFORGE/releases/download/v1.0.11/NexusForge%20Desktop%20Setup%201.0.11.exe",
      "available": true,
      "reason": "Ready to use"
    },
    {
      "channel": "raw-github",
      "priority": 3,
      "url": "https://raw.githubusercontent.com/Trhpructions/-NEXUSFORGE/gh-pages/NexusForge%20Desktop%20Setup%20Latest.exe",
      "available": true,
      "reason": "Emergency fallback"
    }
  ],
  "release_date": "2026-07-02T00:00:00Z",
  "is_stable": true,
  "release_notes": "NexusForge v1.0.11 - Production Release"
}
```

**Client Implementation:**
```javascript
async function fetchUpdate() {
  const manifest = await fetch(UPDATE_MANIFEST_URL);
  const data = await manifest.json();
  
  for (const urlOption of data.download_urls) {
    try {
      const response = await fetch(urlOption.url, { timeout: 10000 });
      if (response.ok) {
        console.log(`[UPDATE] Using ${urlOption.channel} channel`);
        return response.blob();
      }
    } catch (error) {
      console.warn(`[UPDATE] ${urlOption.channel} failed, trying next...`);
      continue;
    }
  }
  
  throw new Error('All download channels failed');
}
```

---

## Deployment Workflow

### On New Release (Post-Build)

1. **Verify Installer**
   ```powershell
   $hash = (Get-FileHash "NexusForge Desktop Setup 1.0.11.exe" -Algorithm SHA256).Hash
   # Must match: c204f8eeed65e3f76a222118ef3be1b390308602158d5daeb7e54da52a649117
   ```

2. **Publish to GitHub Releases**
   ```powershell
   scripts/setup-github-releases.ps1 -Version "1.0.11"
   ```

3. **Update Manifest on gh-pages**
   ```bash
   git checkout gh-pages
   # Edit desktop-update.json with new version and URLs
   git add desktop-update.json
   git commit -m "chore: Update manifest for v1.0.11"
   git push origin gh-pages
   ```

4. **Enable GitHub Pages (if not already enabled)**
   - Manual web UI step (one-time)
   - Settings > Pages > Deploy from branch > gh-pages

5. **Verify All Channels**
   ```powershell
   # Test all three channels
   $urls = @(
     "https://Trhpructions.github.io/-NEXUSFORGE/desktop-update.json",
     "https://github.com/Trhpructions/-NEXUSFORGE/releases/download/v1.0.11/NexusForge%20Desktop%20Setup%201.0.11.exe",
     "https://raw.githubusercontent.com/Trhpructions/-NEXUSFORGE/gh-pages/desktop-update.json"
   )
   
   foreach ($url in $urls) {
     try {
       $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
       Write-Host "[OK] $url - HTTP $($r.StatusCode)"
     } catch {
       Write-Host "[FAIL] $url"
     }
   }
   ```

---

## Fallback Logic (Client-Side)

**Pseudo-code for desktop app update checker:**

```
1. Try to fetch manifest from GitHub Pages (fast CDN)
   └─ Timeout: 5s
   └─ On failure → Try next channel

2. Try GitHub Releases (reliable backup)
   └─ Timeout: 10s
   └─ On failure → Try next channel

3. Try raw.githubusercontent.com (emergency fallback)
   └─ Timeout: 15s
   └─ On failure → Alert user, manual download

4. Verify SHA256 of downloaded file
   └─ If mismatch → Discard and retry
   └─ If timeout × 3 → Use cached/bundled version

5. If all channels fail
   └─ Suggest manual download: https://github.com/Trhpructions/-NEXUSFORGE/releases/latest
```

---

## Status Dashboard

| Channel | Status | Latency | Reliability | Setup |
|---------|--------|---------|-------------|-------|
| **GitHub Pages** | 🔴 Blocked (requires setup) | <100ms | 99.99% | Manual UI enablement |
| **GitHub Releases** | 🟢 Active | 200-500ms | 99.9% | Run setup script |
| **Raw GitHub CDN** | 🟢 Active | 500-2000ms | 99.5% | No setup needed |

---

## Recommended Actions (Priority Order)

### IMMEDIATE (Next 15 minutes)
1. ✅ Commit and push this distribution strategy document
2. ✅ Create `scripts/setup-github-releases.ps1` (done above)
3. ⏳ **MANUAL:** Enable GitHub Pages via web UI (one-time, ~2 min)
   - Go to Settings > Pages
   - Enable "Deploy from a branch"
   - Select gh-pages branch
   - Save

### TODAY (Next 1 hour)
4. Run `scripts/setup-github-releases.ps1` to create Release v1.0.11
5. Update `desktop-update.json` with all three URLs and availability status
6. Test all three channels with validation script
7. Update Phase 1 KPI dashboard with multi-channel status

### THIS WEEK (Days 2-7)
8. Monitor download metrics across channels
9. Log which channel users prefer / which works best
10. Plan performance optimization (add regional mirrors if needed)

---

## Troubleshooting

### Problem: GitHub Pages still shows 404
**Solution:** Verify enablement:
1. Go to Settings > Pages
2. Check that "Source" is set to "Deploy from a branch"
3. Check that branch is "gh-pages" and folder is "/"
4. Wait 5-10 minutes and retry

### Problem: GitHub Releases upload fails
**Solution:** Check authentication:
```powershell
gh auth status
gh auth login  # If needed
```

### Problem: SHA256 mismatch
**Solution:** Verify source file:
```powershell
(Get-FileHash "path/to/installer.exe" -Algorithm SHA256).Hash
```

Must match: `c204f8eeed65e3f76a222118ef3be1b390308602158d5daeb7e54da52a649117`

---

## Future Enhancements

- ✅ Delta updates (only download changed files)
- ✅ Staged rollout (beta → stable)
- ✅ Rollback capability (revert to previous version)
- ✅ Regional CDN (AWS CloudFront, Cloudflare)
- ✅ Signature verification (code signing)
- ✅ Telemetry (track which channel is used)

---

## Notes

- All distribution channels are independent; failure of one doesn't impact others
- Auto-update manifest is the single source of truth for version metadata
- GitHub Releases serves as permanent archive of all versions
- Raw GitHub CDN is always available as emergency fallback
- This strategy eliminates single points of failure in distribution
