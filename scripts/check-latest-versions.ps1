# 检查第三方库最新版本（入口：调用 tools.ps1）
# Usage: npm run check-versions 或 .\check-latest-versions.ps1
& (Join-Path $PSScriptRoot 'tools.ps1') -Action CheckVersions
