# Auto-detect latest versions from CDN/npm
# Usage: .\check-latest-versions.ps1

Write-Host "=== Checking Latest Versions ===" -ForegroundColor Cyan
Write-Host ""

# Function to get latest version from npm registry
function Get-LatestNpmVersion {
    param([string]$PackageName)
    try {
        $response = Invoke-RestMethod -Uri "https://registry.npmjs.org/$PackageName/latest" -UseBasicParsing
        return $response.version
    } catch {
        return $null
    }
}

# Function to get latest version from jsDelivr
function Get-LatestJsDelivrVersion {
    param([string]$PackageName)
    try {
        $response = Invoke-RestMethod -Uri "https://data.jsdelivr.com/v1/packages/npm/$PackageName" -UseBasicParsing
        if ($response.tags.latest) {
            return $response.tags.latest
        }
        return $null
    } catch {
        return $null
    }
}

# Read current config
$configPath = Join-Path $PSScriptRoot "..\config\cdn-versions.json"
if (-not (Test-Path $configPath)) {
    Write-Host "Error: cdn-versions.json not found at $configPath" -ForegroundColor Red
    exit 1
}

$config = Get-Content $configPath | ConvertFrom-Json

# Check Font Awesome
Write-Host "[1/3] Font Awesome" -ForegroundColor Yellow
$currentFA = $config.'font-awesome'.version
Write-Host "  Current: v$currentFA" -ForegroundColor Gray

# Font Awesome 4.7.0 is the last version of v4, check for v5/v6
$latestFA = Get-LatestNpmVersion "@fortawesome/fontawesome-free"
if ($latestFA) {
    Write-Host "  Latest (v5/v6): v$latestFA" -ForegroundColor Cyan
    Write-Host "  Note: Font Awesome v4.7.0 is the last v4 release" -ForegroundColor Yellow
    Write-Host "        v5/v6 requires code changes (different class names)" -ForegroundColor Yellow
} else {
    Write-Host "  Latest: v4.7.0 (last v4 release)" -ForegroundColor Green
}

# Check Chart.js
Write-Host ""
Write-Host "[2/3] Chart.js" -ForegroundColor Yellow
$currentChart = $config.'chart.js'.version
Write-Host "  Current: v$currentChart" -ForegroundColor Gray

$latestChart = Get-LatestNpmVersion "chart.js"
if ($latestChart) {
    Write-Host "  Latest: v$latestChart" -ForegroundColor Cyan
    if ($latestChart -ne $currentChart) {
        Write-Host "  Update available!" -ForegroundColor Green
    } else {
        Write-Host "  Already up to date" -ForegroundColor Green
    }
} else {
    Write-Host "  Could not check latest version" -ForegroundColor Yellow
}

# Check SheetJS
Write-Host ""
Write-Host "[3/3] SheetJS (xlsx)" -ForegroundColor Yellow
$currentSheetJS = $config.'sheetjs'.version
Write-Host "  Current: v$currentSheetJS" -ForegroundColor Gray

$latestSheetJS = Get-LatestNpmVersion "xlsx"
if ($latestSheetJS) {
    Write-Host "  Latest: v$latestSheetJS" -ForegroundColor Cyan
    # Compare versions properly
    try {
        $currentVersion = [version]::new($currentSheetJS)
        $latestVersion = [version]::new($latestSheetJS)
        if ($latestVersion -gt $currentVersion) {
            Write-Host "  Update available!" -ForegroundColor Green
        } else {
            Write-Host "  Already up to date" -ForegroundColor Green
        }
    } catch {
        # If version comparison fails, just check if different
        if ($latestSheetJS -ne $currentSheetJS) {
            Write-Host "  Note: Version format may differ" -ForegroundColor Yellow
        } else {
            Write-Host "  Already up to date" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  Could not check latest version" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan

$updates = @()

if ($latestChart -and $latestChart -ne $currentChart) {
    $updates += @{
        Name = "Chart.js"
        Current = $currentChart
        Latest = $latestChart
    }
}

if ($latestSheetJS) {
    try {
        $currentVersion = [version]::new($currentSheetJS)
        $latestVersion = [version]::new($latestSheetJS)
        if ($latestVersion -gt $currentVersion) {
            $updates += @{
                Name = "SheetJS"
                Current = $currentSheetJS
                Latest = $latestSheetJS
            }
        }
    } catch {
        # Skip if version comparison fails
    }
}

if ($updates.Count -eq 0) {
    Write-Host "All packages are up to date!" -ForegroundColor Green
} else {
    Write-Host "Available updates:" -ForegroundColor Yellow
    foreach ($update in $updates) {
        Write-Host "  - $($update.Name): v$($update.Current) -> v$($update.Latest)" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "To auto-update, run: .\auto-update-versions.ps1" -ForegroundColor Cyan
}

