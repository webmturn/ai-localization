# Auto-update to latest versions
# Usage: .\auto-update-versions.ps1

Write-Host "=== Auto-Update to Latest Versions ===" -ForegroundColor Cyan
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

# Read current config
$configPath = Join-Path $PSScriptRoot "..\config\cdn-versions.json"
if (-not (Test-Path $configPath)) {
    Write-Host "Error: cdn-versions.json not found at $configPath" -ForegroundColor Red
    exit 1
}

$config = Get-Content $configPath | ConvertFrom-Json
$updated = $false

# Update Chart.js
Write-Host "[1/2] Checking Chart.js..." -ForegroundColor Yellow
$currentChart = $config.'chart.js'.version
$latestChart = Get-LatestNpmVersion "chart.js"

if ($latestChart -and $latestChart -ne $currentChart) {
    Write-Host "  Updating from v$currentChart to v$latestChart" -ForegroundColor Cyan
    
    # Update config
    $config.'chart.js'.version = $latestChart
    $config.'chart.js'.url = "https://cdn.jsdelivr.net/npm/chart.js@$latestChart/dist/chart.umd.min.js"
    
    $updated = $true
    Write-Host "  Config updated" -ForegroundColor Green
} else {
    Write-Host "  Already up to date (v$currentChart)" -ForegroundColor Gray
}

# Update SheetJS
Write-Host ""
Write-Host "[2/2] Checking SheetJS..." -ForegroundColor Yellow
$currentSheetJS = $config.'sheetjs'.version
$latestSheetJS = Get-LatestNpmVersion "xlsx"

# SheetJS version comparison - handle version format differences
if ($latestSheetJS) {
    # Compare versions properly
    $currentVersion = [version]::new($currentSheetJS)
    $latestVersion = [version]::new($latestSheetJS)
    
    if ($latestVersion -gt $currentVersion) {
        Write-Host "  Updating from v$currentSheetJS to v$latestSheetJS" -ForegroundColor Cyan
        
        # Update config
        $config.'sheetjs'.version = $latestSheetJS
        $config.'sheetjs'.url = "https://cdn.sheetjs.com/xlsx-$latestSheetJS/package/dist/xlsx.full.min.js"
        
        $updated = $true
        Write-Host "  Config updated" -ForegroundColor Green
    } else {
        Write-Host "  Already up to date (v$currentSheetJS)" -ForegroundColor Gray
    }
} else {
    Write-Host "  Could not check latest version" -ForegroundColor Yellow
}

# Save updated config
if ($updated) {
    Write-Host ""
    Write-Host "Saving updated configuration..." -ForegroundColor Yellow
    $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
    Write-Host "Configuration saved!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now run: npm run update-cdn" -ForegroundColor Cyan
    Write-Host "to download the updated resources." -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "No updates available. All packages are up to date!" -ForegroundColor Green
}

