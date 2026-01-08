# 自动将 cdn-versions.json 更新为最新版本号（入口：调用 tools.ps1）
# Usage: .\auto-update-versions.ps1  或  npm run auto-update（会再执行 update-cdn）
& (Join-Path $PSScriptRoot 'tools.ps1') -Action UpdateConfig
