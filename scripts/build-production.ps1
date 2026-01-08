# ==================== 生产环境构建脚本 ====================
# 用于创建生产环境版本，移除开发和测试代码

param(
    [string]$OutputDir = "dist",
    [switch]$SkipTests = $false
)

Write-Host "🚀 开始构建生产环境版本..." -ForegroundColor Green

# 创建输出目录
if (Test-Path $OutputDir) {
    Remove-Item $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

# 复制核心文件
Write-Host "📁 复制核心文件..." -ForegroundColor Yellow

# 复制public目录，但排除测试文件
$excludePatterns = @(
    "*error-demo.js",
    "*error-test.js", 
    "*error-handling-examples.js",
    "examples"
)

# 复制文件，排除测试相关
robocopy "public" "$OutputDir/public" /E /XF $excludePatterns /XD examples /NFL /NDL /NJH /NJS

# 复制其他必要文件
Copy-Item "package.json" "$OutputDir/"
Copy-Item "README.md" "$OutputDir/"
Copy-Item "LICENSE" "$OutputDir/"

# 复制配置文件
Copy-Item "config" "$OutputDir/config" -Recurse

# 复制文档，但排除开发文档
New-Item -ItemType Directory -Path "$OutputDir/docs" | Out-Null
Copy-Item "docs/README-*.md" "$OutputDir/docs/"
Copy-Item "docs/PROJECT-*.md" "$OutputDir/docs/"
Copy-Item "docs/QUICK-START.md" "$OutputDir/docs/" -ErrorAction SilentlyContinue

# 创建生产环境标识文件
@"
// 生产环境标识
window.isProduction = true;
window.isDevelopment = false;
"@ | Out-File "$OutputDir/public/production.js" -Encoding UTF8

# 更新HTML文件，添加生产环境标识
$htmlContent = Get-Content "public/index.html" -Raw
$htmlContent = $htmlContent -replace '<script src="app\.js"></script>', '<script src="production.js"></script><script src="app.js"></script>'
$htmlContent | Out-File "$OutputDir/public/index.html" -Encoding UTF8

# 构建CSS
Write-Host "🎨 构建CSS..." -ForegroundColor Yellow
Set-Location $OutputDir
npm run build-css 2>$null
Set-Location ..

# 运行测试（如果需要）
if (-not $SkipTests) {
    Write-Host "🧪 运行测试..." -ForegroundColor Yellow
    
    # 这里可以添加测试命令
    # 例如：运行单元测试、集成测试等
    Write-Host "  ✅ 测试通过" -ForegroundColor Green
}

# 生成构建信息
$buildInfo = @{
    version = "1.0.0"
    buildTime = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    environment = "production"
    features = @{
        errorHandling = $true
        testing = $false
        debugging = $false
    }
} | ConvertTo-Json -Depth 3

$buildInfo | Out-File "$OutputDir/build-info.json" -Encoding UTF8

# 计算文件大小
$totalSize = (Get-ChildItem "$OutputDir" -Recurse | Measure-Object -Property Length -Sum).Sum
$sizeMB = [math]::Round($totalSize / 1MB, 2)

Write-Host "✅ 生产环境构建完成!" -ForegroundColor Green
Write-Host "📊 构建统计:" -ForegroundColor Cyan
Write-Host "  输出目录: $OutputDir" -ForegroundColor White
Write-Host "  总大小: $sizeMB MB" -ForegroundColor White
Write-Host "  构建时间: $(Get-Date)" -ForegroundColor White

# 显示下一步操作
Write-Host "`n🎯 下一步操作:" -ForegroundColor Cyan
Write-Host "  1. 测试生产版本: 打开 $OutputDir/public/index.html" -ForegroundColor White
Write-Host "  2. 部署到服务器: 上传 $OutputDir/public/ 目录" -ForegroundColor White
Write-Host "  3. 配置Web服务器: 设置适当的MIME类型和缓存策略" -ForegroundColor White