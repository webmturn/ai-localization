# CDN 资源更新（入口：调用 tools.ps1）
# Usage: npm run update-cdn 或 .\update-cdn.ps1 [-CheckOnly]
& (Join-Path $PSScriptRoot 'tools.ps1') -Action UpdateCdn @args
