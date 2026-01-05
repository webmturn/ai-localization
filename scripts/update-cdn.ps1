# CDN Resource Update Script
# Usage: npm run update-cdn or .\update-cdn.ps1

param(
    [switch]$CheckOnly
)

Write-Host "=== CDN Resource Update Tool ===" -ForegroundColor Cyan
Write-Host ""

# Get project root directory (parent of scripts directory)
$projectRoot = Split-Path $PSScriptRoot -Parent

# Read version configuration
$configPath = Join-Path $projectRoot "config\cdn-versions.json"
if (-not (Test-Path $configPath)) {
    Write-Host "Error: cdn-versions.json not found at $configPath" -ForegroundColor Red
    exit 1
}

$config = Get-Content $configPath | ConvertFrom-Json

# Resolve local paths relative to project root
$config.'font-awesome'.localPath.css = Join-Path $projectRoot $config.'font-awesome'.localPath.css
$config.'font-awesome'.localPath.font = Join-Path $projectRoot $config.'font-awesome'.localPath.font
$config.'chart.js'.localPath = Join-Path $projectRoot $config.'chart.js'.localPath
$config.'sheetjs'.localPath = Join-Path $projectRoot $config.'sheetjs'.localPath

# Create directories if they don't exist
$libDirs = @(
    (Join-Path $projectRoot "public\lib\font-awesome\fonts"),
    (Join-Path $projectRoot "public\lib\chart.js"),
    (Join-Path $projectRoot "public\lib\sheetjs")
)

foreach ($dir in $libDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Green
    }
}

# Update Font Awesome
Write-Host ""
Write-Host "[1/3] Font Awesome v$($config.'font-awesome'.version)" -ForegroundColor Yellow
if ($CheckOnly) {
    Write-Host "  Current version: $($config.'font-awesome'.version)" -ForegroundColor Gray
    Write-Host "  CSS: $($config.'font-awesome'.css)" -ForegroundColor Gray
    Write-Host "  Font: $($config.'font-awesome'.font)" -ForegroundColor Gray
} else {
    try {
        Write-Host "  Downloading CSS..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $config.'font-awesome'.css -OutFile $config.'font-awesome'.localPath.css -UseBasicParsing
        
        Write-Host "  Downloading font..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $config.'font-awesome'.font -OutFile $config.'font-awesome'.localPath.font -UseBasicParsing
        
        # Fix font paths in CSS
        Write-Host "  Fixing font paths..." -ForegroundColor Gray
        $cssContent = Get-Content $config.'font-awesome'.localPath.css -Raw -Encoding UTF8
        $cssContent = $cssContent -replace "\.\./fonts/", "./fonts/"
        $cssContent = $cssContent -replace "url\('\./fonts/fontawesome-webfont\.woff2\?v=[^']+'\)", "url('./fonts/fontawesome-webfont.woff2')"
        
        # Simplify @font-face rule
        if ($cssContent -match "@font-face\s*\{[^}]*font-family:\s*['""]FontAwesome['""][^}]*\}") {
            $newFontFace = "@font-face {`n    font-family: 'FontAwesome';`n    src: url('./fonts/fontawesome-webfont.woff2') format('woff2');`n    font-weight: normal;`n    font-style: normal;`n    font-display: swap;`n}"
            $cssContent = $cssContent -replace "@font-face\s*\{[^}]*font-family:\s*['""]FontAwesome['""][^}]*\}", $newFontFace
        }
        
        Set-Content $config.'font-awesome'.localPath.css -Value $cssContent -Encoding UTF8 -NoNewline
        
        Write-Host "  Font Awesome updated successfully" -ForegroundColor Green
    } catch {
        Write-Host "  Font Awesome update failed: $_" -ForegroundColor Red
    }
}

# Update Chart.js
Write-Host ""
Write-Host "[2/3] Chart.js v$($config.'chart.js'.version)" -ForegroundColor Yellow
if ($CheckOnly) {
    Write-Host "  Current version: $($config.'chart.js'.version)" -ForegroundColor Gray
    Write-Host "  URL: $($config.'chart.js'.url)" -ForegroundColor Gray
} else {
    try {
        Write-Host "  Downloading Chart.js..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $config.'chart.js'.url -OutFile $config.'chart.js'.localPath -UseBasicParsing
        Write-Host "  Chart.js updated successfully" -ForegroundColor Green
    } catch {
        Write-Host "  Chart.js update failed: $_" -ForegroundColor Red
    }
}

# Update SheetJS
Write-Host ""
Write-Host "[3/3] SheetJS v$($config.'sheetjs'.version)" -ForegroundColor Yellow
if ($CheckOnly) {
    Write-Host "  Current version: $($config.'sheetjs'.version)" -ForegroundColor Gray
    Write-Host "  URL: $($config.'sheetjs'.url)" -ForegroundColor Gray
} else {
    try {
        Write-Host "  Downloading SheetJS..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $config.'sheetjs'.url -OutFile $config.'sheetjs'.localPath -UseBasicParsing
        Write-Host "  SheetJS updated successfully" -ForegroundColor Green
    } catch {
        Write-Host "  SheetJS update failed: $_" -ForegroundColor Red
    }
}

if (-not $CheckOnly) {
    Write-Host ""
    Write-Host "=== Update Complete ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Tip: Check library changelogs if issues occur" -ForegroundColor Yellow
    Write-Host "  - Font Awesome: https://fontawesome.com/v4.7.0/" -ForegroundColor Gray
    Write-Host "  - Chart.js: https://www.chartjs.org/docs/latest/getting-started/installation.html" -ForegroundColor Gray
    Write-Host "  - SheetJS: https://docs.sheetjs.com/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To check versions only, run: npm run update-cdn -- -CheckOnly" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "=== Version Check Complete ===" -ForegroundColor Cyan
}
