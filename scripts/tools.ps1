# 项目工具脚本（整合：Node 检查、版本检查、配置更新、CDN 下载）
# 用法：.\tools.ps1 -Action <NodeCheck|CheckVersions|UpdateConfig|UpdateCdn|All> [-CheckOnly] [-NonInteractive]
# 或通过包装脚本调用：check-node-install.ps1 / update-cdn.ps1 / check-latest-versions.ps1 / auto-update-versions.ps1

param(
    [AllowEmptyString()]
    [ValidateSet('NodeCheck', 'CheckVersions', 'UpdateConfig', 'UpdateCdn', 'All')]
    [string]$Action = '',
    [switch]$CheckOnly,   # 仅与 UpdateCdn 一起使用：只显示版本不下载
    [switch]$NonInteractive  # NodeCheck 时不等待按键、不提示打开浏览器
)

$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot 'config\cdn-versions.json'

function Get-LatestNpmVersion {
    param([string]$PackageName)
    try {
        $response = Invoke-RestMethod -Uri ('https://registry.npmjs.org/' + $PackageName + '/latest') -UseBasicParsing
        return $response.version
    } catch {
        return $null
    }
}

function Invoke-NodeCheck {
    param([bool]$Interactive = $true)
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host 'Node.js 安装检查工具' -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host ''

    $nodeInstalled = $false
    $npmInstalled = $false

    if (Get-Command node -ErrorAction SilentlyContinue) {
        try {
            $nodeVersion = & node --version 2>$null
            if ($nodeVersion) {
                Write-Host ('Node.js 已安装: ' + $nodeVersion) -ForegroundColor Green
                $nodeInstalled = $true
            }
        } catch {
            Write-Host 'Node.js 检查失败' -ForegroundColor Red
        }
    }
    if (-not $nodeInstalled) {
        Write-Host 'Node.js 未安装或不在 PATH 中' -ForegroundColor Red
    }

    if (Get-Command npm -ErrorAction SilentlyContinue) {
        try {
            $npmVersion = & npm --version 2>$null
            if ($npmVersion) {
                Write-Host ('npm 已安装: ' + $npmVersion) -ForegroundColor Green
                $npmInstalled = $true
            }
        } catch {
            Write-Host 'npm 检查失败' -ForegroundColor Red
        }
    }
    if (-not $npmInstalled) {
        Write-Host 'npm 未安装或不在 PATH 中' -ForegroundColor Red
    }

    Write-Host ''

    if ($nodeInstalled -and $npmInstalled) {
        Write-Host 'Node.js 与 npm 已就绪。' -ForegroundColor Green
        Write-Host '下一步：执行 npm install，然后 npm run build-css' -ForegroundColor Yellow
    }
    if (-not $nodeInstalled -or -not $npmInstalled) {
        Write-Host '请从 https://nodejs.org/ 安装 Node.js（建议 LTS）' -ForegroundColor Yellow
        Write-Host '安装时请勾选【添加到 PATH】，安装后重启 PowerShell。' -ForegroundColor Gray
        if ($Interactive) {
            $response = Read-Host '是否打开 Node.js 下载页？(Y/N)'
            if ($response -eq 'Y' -or $response -eq 'y') {
                Start-Process 'https://nodejs.org/'
            }
        }
    }

    if ($Interactive) {
        Write-Host ''
        Write-Host '按任意键退出...' -ForegroundColor Gray
        try {
            if ($Host.UI.RawUI) {
                $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
            }
        } catch { }
    }
}

function Invoke-CheckVersions {
    if (-not (Test-Path $configPath)) {
        Write-Host ('错误：未找到 cdn-versions.json，路径：' + $configPath) -ForegroundColor Red
        exit 1
    }
    $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json

    Write-Host '=== 正在检查最新版本 ===' -ForegroundColor Cyan
    Write-Host ''

    Write-Host '[1/3] Font Awesome' -ForegroundColor Yellow
    $currentFA = $config.'font-awesome'.version
    Write-Host ('  当前: v' + $currentFA) -ForegroundColor Gray
    $latestFA = Get-LatestNpmVersion '@fortawesome/fontawesome-free'
    if ($latestFA) {
        Write-Host ('  最新 (v5/v6): v' + $latestFA) -ForegroundColor Cyan
        Write-Host '  说明：Font Awesome v4.7.0 为最后 v4 版本' -ForegroundColor Yellow
        Write-Host '        升级 v5/v6 需修改代码（类名不同）' -ForegroundColor Yellow
    } else {
        Write-Host '  最新：v4.7.0（最后 v4 版本）' -ForegroundColor Green
    }

    Write-Host ''
    Write-Host '[2/3] Chart.js' -ForegroundColor Yellow
    $currentChart = $config.'chart.js'.version
    Write-Host ('  当前: v' + $currentChart) -ForegroundColor Gray
    $latestChart = Get-LatestNpmVersion 'chart.js'
    if ($latestChart) {
        Write-Host ('  最新: v' + $latestChart) -ForegroundColor Cyan
        if ($latestChart -ne $currentChart) { Write-Host '  有可用更新！' -ForegroundColor Green }
        else { Write-Host '  已是最新' -ForegroundColor Green }
    } else {
        Write-Host '  无法获取最新版本' -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host '[3/3] SheetJS (xlsx)' -ForegroundColor Yellow
    $currentSheetJS = $config.'sheetjs'.version
    Write-Host ('  当前: v' + $currentSheetJS) -ForegroundColor Gray
    $latestSheetJS = Get-LatestNpmVersion 'xlsx'
    if ($latestSheetJS) {
        Write-Host ('  最新: v' + $latestSheetJS) -ForegroundColor Cyan
        try {
            $cv = [version]::new($currentSheetJS)
            $lv = [version]::new($latestSheetJS)
            if ($lv -gt $cv) { Write-Host '  有可用更新！' -ForegroundColor Green }
            else { Write-Host '  已是最新' -ForegroundColor Green }
        } catch {
            if ($latestSheetJS -ne $currentSheetJS) { Write-Host '  说明：版本格式可能不同' -ForegroundColor Yellow }
            else { Write-Host '  已是最新' -ForegroundColor Green }
        }
    } else {
        Write-Host '  无法获取最新版本' -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host '=== 汇总 ===' -ForegroundColor Cyan
    $updates = @()
    if ($latestChart -and $latestChart -ne $currentChart) {
        $updates += @{ Name = 'Chart.js'; Current = $currentChart; Latest = $latestChart }
    }
    if ($latestSheetJS) {
        try {
            $cv = [version]::new($currentSheetJS)
            $lv = [version]::new($latestSheetJS)
            if ($lv -gt $cv) { $updates += @{ Name = 'SheetJS'; Current = $currentSheetJS; Latest = $latestSheetJS } }
        } catch { }
    }
    if ($updates.Count -eq 0) {
        Write-Host '所有依赖已是最新！' -ForegroundColor Green
    } else {
        Write-Host '可用更新：' -ForegroundColor Yellow
        foreach ($u in $updates) { Write-Host ('  - ' + $u.Name + ': v' + $u.Current + ' -> v' + $u.Latest) -ForegroundColor Cyan }
        Write-Host ''
        Write-Host '一键更新配置并下载请运行：.\tools.ps1 -Action All' -ForegroundColor Cyan
    }
}

function Invoke-UpdateConfig {
    if (-not (Test-Path $configPath)) {
        Write-Host ('错误：未找到 cdn-versions.json，路径：' + $configPath) -ForegroundColor Red
        exit 1
    }
    $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $updated = $false

    Write-Host '=== 自动更新到最新版本 ===' -ForegroundColor Cyan
    Write-Host ''

    Write-Host '[1/2] 正在检查 Chart.js...' -ForegroundColor Yellow
    $currentChart = $config.'chart.js'.version
    $latestChart = Get-LatestNpmVersion 'chart.js'
    if ($latestChart -and $latestChart -ne $currentChart) {
        Write-Host ('  正在从 v' + $currentChart + ' 更新到 v' + $latestChart) -ForegroundColor Cyan
        $config.'chart.js'.version = $latestChart
        $config.'chart.js'.url = 'https://cdn.jsdelivr.net/npm/chart.js@' + $latestChart + '/dist/chart.umd.min.js'
        $updated = $true
        Write-Host '  配置已更新' -ForegroundColor Green
    } else {
        Write-Host ('  已是最新 (v' + $currentChart + ')') -ForegroundColor Gray
    }

    Write-Host ''
    Write-Host '[2/2] 正在检查 SheetJS...' -ForegroundColor Yellow
    $currentSheetJS = $config.'sheetjs'.version
    $latestSheetJS = Get-LatestNpmVersion 'xlsx'
    if ($latestSheetJS) {
        try {
            $cv = [version]::new($currentSheetJS)
            $lv = [version]::new($latestSheetJS)
            if ($lv -gt $cv) {
                Write-Host ('  正在从 v' + $currentSheetJS + ' 更新到 v' + $latestSheetJS) -ForegroundColor Cyan
                $config.'sheetjs'.version = $latestSheetJS
                $config.'sheetjs'.url = 'https://cdn.sheetjs.com/xlsx-' + $latestSheetJS + '/package/dist/xlsx.full.min.js'
                $updated = $true
                Write-Host '  配置已更新' -ForegroundColor Green
            } else {
                Write-Host ('  已是最新 (v' + $currentSheetJS + ')') -ForegroundColor Gray
            }
        } catch {
            Write-Host '  无法比较版本' -ForegroundColor Yellow
        }
    } else {
        Write-Host '  无法获取最新版本' -ForegroundColor Yellow
    }

    if ($updated) {
        Write-Host ''
        Write-Host '正在保存配置...' -ForegroundColor Yellow
        $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 10), $utf8NoBom)
        Write-Host '配置已保存！' -ForegroundColor Green
        Write-Host ''
        Write-Host '请执行：.\tools.ps1 -Action UpdateCdn（或 npm run update-cdn）' -ForegroundColor Cyan
    } else {
        Write-Host ''
        Write-Host '无可用更新，所有依赖已是最新！' -ForegroundColor Green
    }
}

function Invoke-UpdateCdn {
    param([bool]$CheckOnlyMode = $false)
    if (-not (Test-Path $configPath)) {
        Write-Host ('错误：未找到 cdn-versions.json，路径：' + $configPath) -ForegroundColor Red
        exit 1
    }
    $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $config.'font-awesome'.localPath.css = Join-Path $projectRoot $config.'font-awesome'.localPath.css
    $config.'font-awesome'.localPath.font = Join-Path $projectRoot $config.'font-awesome'.localPath.font
    $config.'chart.js'.localPath = Join-Path $projectRoot $config.'chart.js'.localPath
    $config.'sheetjs'.localPath = Join-Path $projectRoot $config.'sheetjs'.localPath

    $libDirs = @(
        (Join-Path $projectRoot 'public\lib\font-awesome\fonts'),
        (Join-Path $projectRoot 'public\lib\chart.js'),
        (Join-Path $projectRoot 'public\lib\sheetjs')
    )
    foreach ($dir in $libDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
            Write-Host ('已创建目录：' + $dir) -ForegroundColor Green
        }
    }

    Write-Host '=== CDN 资源更新工具 ===' -ForegroundColor Cyan
    Write-Host ''

    Write-Host ('[1/3] Font Awesome v' + $config.'font-awesome'.version) -ForegroundColor Yellow
    if ($CheckOnlyMode) {
        Write-Host ('  当前版本: ' + $config.'font-awesome'.version) -ForegroundColor Gray
        Write-Host ('  CSS: ' + $config.'font-awesome'.css) -ForegroundColor Gray
        Write-Host ('  Font: ' + $config.'font-awesome'.font) -ForegroundColor Gray
    } else {
        try {
            Write-Host '  正在下载 CSS...' -ForegroundColor Gray
            Invoke-WebRequest -Uri $config.'font-awesome'.css -OutFile $config.'font-awesome'.localPath.css -UseBasicParsing
            Write-Host '  正在下载字体...' -ForegroundColor Gray
            Invoke-WebRequest -Uri $config.'font-awesome'.font -OutFile $config.'font-awesome'.localPath.font -UseBasicParsing
            Write-Host '  正在修复字体路径...' -ForegroundColor Gray
            $cssContent = Get-Content $config.'font-awesome'.localPath.css -Raw -Encoding UTF8
            $cssContent = $cssContent -replace '\.\./fonts/', './fonts/'
            $sq = [char]39
            $urlPat = 'url\(' + $sq + '\./fonts/fontawesome-webfont\.woff2\?v=' + $sq + '[^' + $sq + ']+' + $sq + '\)'
            $urlRepl = 'url(' + $sq + './fonts/fontawesome-webfont.woff2' + $sq + ')'
            $cssContent = $cssContent -replace $urlPat, $urlRepl
            $dq = [char]34
            $fontPat = '@font-face\s*\{[^}]*font-family:\s*[' + $sq + $dq + ']FontAwesome[' + $sq + $dq + '][^}]*\}'
            $fontFaceRegex = [regex]$fontPat
            if ($fontFaceRegex.IsMatch($cssContent)) {
                $nl = [char]10
                $newFontFace = '@font-face {' + $nl + '    font-family: ' + $sq + 'FontAwesome' + $sq + ';' + $nl + '    src: url(' + $sq + './fonts/fontawesome-webfont.woff2' + $sq + ') format(' + $sq + 'woff2' + $sq + ');' + $nl + '    font-weight: normal; font-style: normal; font-display: swap;' + $nl + '}'
                $cssContent = $fontFaceRegex.Replace($cssContent, $newFontFace)
            }
            $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
            [System.IO.File]::WriteAllText($config.'font-awesome'.localPath.css, $cssContent, $utf8NoBom)
            Write-Host '  Font Awesome 更新成功' -ForegroundColor Green
        } catch {
            Write-Host ('  Font Awesome 更新失败：' + $_) -ForegroundColor Red
        }
    }

    Write-Host ''
    Write-Host ('[2/3] Chart.js v' + $config.'chart.js'.version) -ForegroundColor Yellow
    if ($CheckOnlyMode) {
        Write-Host ('  当前版本: ' + $config.'chart.js'.version) -ForegroundColor Gray
        Write-Host ('  URL: ' + $config.'chart.js'.url) -ForegroundColor Gray
    } else {
        try {
            Write-Host '  正在下载 Chart.js...' -ForegroundColor Gray
            Invoke-WebRequest -Uri $config.'chart.js'.url -OutFile $config.'chart.js'.localPath -UseBasicParsing
            Write-Host '  Chart.js 更新成功' -ForegroundColor Green
        } catch {
            Write-Host ('  Chart.js 更新失败：' + $_) -ForegroundColor Red
        }
    }

    Write-Host ''
    Write-Host ('[3/3] SheetJS v' + $config.'sheetjs'.version) -ForegroundColor Yellow
    if ($CheckOnlyMode) {
        Write-Host ('  当前版本: ' + $config.'sheetjs'.version) -ForegroundColor Gray
        Write-Host ('  URL: ' + $config.'sheetjs'.url) -ForegroundColor Gray
    } else {
        try {
            Write-Host '  正在下载 SheetJS...' -ForegroundColor Gray
            Invoke-WebRequest -Uri $config.'sheetjs'.url -OutFile $config.'sheetjs'.localPath -UseBasicParsing
            Write-Host '  SheetJS 更新成功' -ForegroundColor Green
        } catch {
            Write-Host ('  SheetJS 更新失败：' + $_) -ForegroundColor Red
        }
    }

    if (-not $CheckOnlyMode) {
        Write-Host ''
        Write-Host '=== 更新完成 ===' -ForegroundColor Cyan
        Write-Host ''
        Write-Host '提示：若遇问题可查看各库更新说明' -ForegroundColor Yellow
        Write-Host '  - Font Awesome: https://fontawesome.com/v4.7.0/' -ForegroundColor Gray
        Write-Host '  - Chart.js: https://www.chartjs.org/docs/latest/getting-started/installation.html' -ForegroundColor Gray
        Write-Host '  - SheetJS: https://docs.sheetjs.com/' -ForegroundColor Gray
        Write-Host ''
        Write-Host '仅查看版本请运行：.\tools.ps1 -Action UpdateCdn -CheckOnly' -ForegroundColor Cyan
    } else {
        Write-Host ''
        Write-Host '=== 版本检查完成 ===' -ForegroundColor Cyan
    }
}

# Main
$usageLines = @(
    '用法：.\tools.ps1 -Action NodeCheck|CheckVersions|UpdateConfig|UpdateCdn|All [-CheckOnly] [-NonInteractive]',
    '  NodeCheck     - 检查 Node/npm 是否已安装',
    '  CheckVersions - 检查依赖最新版本',
    '  UpdateConfig  - 将 cdn-versions.json 更新为最新',
    '  UpdateCdn     - 下载 CDN 资源（-CheckOnly 仅列出版本）',
    '  All           - 依次执行 NodeCheck、CheckVersions、UpdateConfig、UpdateCdn'
)

if (-not $Action) {
    Write-Host ''
    Write-Host '========== 项目工具 ==========' -ForegroundColor Cyan
    Write-Host '  1. 检查 Node/npm 是否已安装' -ForegroundColor White
    Write-Host '  2. 检查依赖最新版本' -ForegroundColor White
    Write-Host '  3. 将 cdn-versions.json 更新为最新' -ForegroundColor White
    Write-Host '  4. 下载 CDN 资源' -ForegroundColor White
    Write-Host '  5. 一键执行全部' -ForegroundColor White
    Write-Host '  0. 退出' -ForegroundColor Gray
    Write-Host ''
    $choice = (Read-Host '请选择 (0-5)').Trim()
    switch ($choice) {
        '1' { $Action = 'NodeCheck' }
        '2' { $Action = 'CheckVersions' }
        '3' { $Action = 'UpdateConfig' }
        '4' { $Action = 'UpdateCdn' }
        '5' { $Action = 'All' }
        '0' { Write-Host '已退出。' -ForegroundColor Gray; exit 0 }
        default {
            Write-Host '无效选择，显示用法。' -ForegroundColor Yellow
            Write-Host $usageLines[0] -ForegroundColor Yellow
            foreach ($line in $usageLines[1..($usageLines.Length-1)]) { Write-Host $line -ForegroundColor Gray }
            Write-Host ''
            Write-Host '按任意键退出...' -ForegroundColor Gray
            try { if ($Host.UI.RawUI) { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } } catch { }
            exit 0
        }
    }
    Write-Host ''
}

if ($Action) {
switch ($Action) {
    'NodeCheck'     { Invoke-NodeCheck -Interactive (-not $NonInteractive) }
    'CheckVersions' { Invoke-CheckVersions }
    'UpdateConfig'  { Invoke-UpdateConfig }
    'UpdateCdn'     { Invoke-UpdateCdn -CheckOnlyMode $CheckOnly }
    'All'           {
        Invoke-NodeCheck -Interactive $false
        Write-Host ''
        Invoke-CheckVersions
        Write-Host ''
        Invoke-UpdateConfig
        Write-Host ''
        Invoke-UpdateCdn -CheckOnlyMode $false
    }
}
}

# 直接运行（如双击）时保持窗口，直到用户按键
if ($Action -and -not $NonInteractive -and $Action -ne 'NodeCheck') {
    Write-Host ''
    Write-Host '按任意键退出...' -ForegroundColor Gray
    try { if ($Host.UI.RawUI) { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } } catch { }
}
