# Node.js 快速安装检查脚本
# 此脚本会检查 Node.js 是否已安装，并提供安装指导

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Node.js 安装检查工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js 是否已安装
$nodeInstalled = $false
$npmInstalled = $false

try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "✅ Node.js 已安装: $nodeVersion" -ForegroundColor Green
        $nodeInstalled = $true
    }
} catch {
    Write-Host "❌ Node.js 未安装" -ForegroundColor Red
}

try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Host "✅ npm 已安装: $npmVersion" -ForegroundColor Green
        $npmInstalled = $true
    }
} catch {
    Write-Host "❌ npm 未安装" -ForegroundColor Red
}

Write-Host ""

if ($nodeInstalled -and $npmInstalled) {
    Write-Host "🎉 Node.js 和 npm 都已安装！" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步操作：" -ForegroundColor Yellow
    Write-Host "1. 运行: npm install" -ForegroundColor White
    Write-Host "2. 运行: npm run build-css" -ForegroundColor White
} else {
    Write-Host "📥 需要安装 Node.js" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "安装步骤：" -ForegroundColor Cyan
    Write-Host "1. 访问: https://nodejs.org/" -ForegroundColor White
    Write-Host "2. 下载 LTS 版本（推荐）" -ForegroundColor White
    Write-Host "3. 运行安装程序，确保勾选 'Add to PATH'" -ForegroundColor White
    Write-Host "4. 安装完成后，关闭并重新打开 PowerShell" -ForegroundColor White
    Write-Host "5. 再次运行此脚本验证安装" -ForegroundColor White
    Write-Host ""
    Write-Host "是否要打开 Node.js 下载页面？(Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'Y' -or $response -eq 'y') {
        Start-Process "https://nodejs.org/"
    }
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

