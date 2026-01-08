# Split monolithic app.js into modular files. Must be run from project root (parent of scripts/).
param(
  [string]$SourcePath = "public/app.js",
  [string]$OutputDir = "public/app",
  [string]$BackupPath = ""
)

$ErrorActionPreference = 'Stop'

function Find-LineIndex([string[]]$arr, [string]$pattern) {
  return [Array]::FindIndex($arr, [Predicate[string]]{ param($l) $l -match $pattern })
}

function Find-NearestSectionHeader([string[]]$arr, [int]$startIndex) {
  if ($startIndex -lt 0) { return -1 }
  for ($i = $startIndex; $i -ge 0; $i--) {
    if ($arr[$i] -match '^\s*//\s*=+') {
      return $i
    }
  }
  return -1
}

function Write-Utf8NoBom([string]$path, [string]$content) {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $parent = Split-Path -Parent $path
  if ($parent -and !(Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $full = [System.IO.Path]::GetFullPath($path)
  [System.IO.File]::WriteAllText($full, $content, $utf8NoBom)
}

function Read-Utf8([string]$path) {
  return Get-Content -LiteralPath $path -Encoding UTF8
}

if (!(Test-Path -LiteralPath $SourcePath)) {
  throw "Source not found: $SourcePath"
}

$lines = Read-Utf8 $SourcePath

# If already converted to loader, prefer backup
$joinedHead = ($lines | Select-Object -First 30) -join "`n"
$sourceIsLoader = $joinedHead -match "__APP_SPLIT_LOADER__"
$hasMonolith = $true
if ($sourceIsLoader) {
  $hasMonolith = $false
  if ($BackupPath -and (Test-Path -LiteralPath $BackupPath)) {
    $backupLines = Read-Utf8 $BackupPath
    $backupHead = ($backupLines | Select-Object -First 30) -join "`n"
    if ($backupHead -notmatch "__APP_SPLIT_LOADER__") {
      $lines = $backupLines
      $hasMonolith = $true
    }
  }
}

if (!(Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

if ($hasMonolith) {
  # IMPORTANT: Avoid non-ASCII markers to prevent encoding issues in Windows PowerShell.
  # We locate split points using ASCII code patterns, then backtrack to the nearest
  # section header line (// ======== ... ========) to preserve the original heading comments.
  $idxAutoCode = Find-LineIndex $lines '^\s*class\s+AutoSaveManager\b'
  $idxNetCode = Find-LineIndex $lines '^\s*class\s+NetworkUtils\b'
  $idxEventsCode = Find-LineIndex $lines '^\s*const\s+EventManager\s*=\s*\{'
  $idxFilesCode = Find-LineIndex $lines '^\s*async\s+function\s+readFileAsync\b'

  $idxAuto = Find-NearestSectionHeader $lines $idxAutoCode
  $idxNet = Find-NearestSectionHeader $lines $idxNetCode
  $idxEvents = Find-NearestSectionHeader $lines $idxEventsCode
  $idxFiles = Find-NearestSectionHeader $lines $idxFilesCode

  $idxs = @{
    auto = $idxAuto
    net = $idxNet
    events = $idxEvents
    files = $idxFiles
  }

  $allFound = $true
  foreach ($k in $idxs.Keys) {
    if ($idxs[$k] -lt 0) {
      $allFound = $false
    }
  }

  if (-not $allFound) {
    Write-Host "Monolith markers not found; skipping monolith split." -ForegroundColor Yellow
  } else {
    # Always backup the source full file (overwrites existing backup)
    # NOTE: Once the project is modularized, $SourcePath is a loader. Do NOT overwrite
    # the monolith backup with the loader; otherwise marker-based splitting will break.
    if ($BackupPath -and (-not $sourceIsLoader)) {
      $backupParent = Split-Path -Parent $BackupPath
      if (!(Test-Path -LiteralPath $backupParent)) {
        New-Item -ItemType Directory -Force -Path $backupParent | Out-Null
      }
      Copy-Item -LiteralPath $SourcePath -Destination $BackupPath -Force
    }

    function Slice([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $lines.Length) { $toInclusive = $lines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $lines[$from..$toInclusive]
    }

    $parts = @(
      @{ name = "01-core.js"; from = 0; to = $idxAuto - 1 },
      @{ name = "services/auto-save-manager.js"; from = $idxAuto; to = $idxNet - 1 },
      @{ name = "03-network-translate.js"; from = $idxNet; to = $idxEvents - 1 },
      @{ name = "04-events-ui.js"; from = $idxEvents; to = $idxFiles - 1 },
      @{ name = "05-files-perf-quality.js"; from = $idxFiles; to = $lines.Length - 1 }
    )

    foreach ($p in $parts) {
      $outPath = Join-Path $OutputDir $p.name
      $outParent = Split-Path -Parent $outPath
      if (!(Test-Path -LiteralPath $outParent)) {
        New-Item -ItemType Directory -Force -Path $outParent | Out-Null
      }
      $content = ((Slice $p.from $p.to) -join "`r`n") + "`r`n"
      Write-Utf8NoBom $outPath $content
    }
  }
}

# Further split 03 into network/services modules (ASCII-safe)
$networkDir = Join-Path $OutputDir "network"
$servicesDir = Join-Path $OutputDir "services"
$legacyDir = Join-Path $OutputDir "legacy"
foreach ($d in @($networkDir, $servicesDir, $legacyDir)) {
  if (!(Test-Path -LiteralPath $d)) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
  }
}

# Further split 01-core SecurityUtils into services/security-utils.js (ASCII-safe)
$corePath = Join-Path $OutputDir "01-core.js"
if (Test-Path -LiteralPath $corePath) {
  $coreLines = Get-Content -LiteralPath $corePath -Encoding UTF8

  # Further split 01-core AppState into core/state.js
  $idxAppState = Find-LineIndex $coreLines '^\s*const\s+AppState\b'
  $idxStateHeader = Find-NearestSectionHeader $coreLines $idxAppState
  $idxToolsHeader = Find-LineIndex $coreLines '^\s*//\s*=+\s*工具函数\s*=+'
  if ($idxAppState -ge 0 -and $idxStateHeader -ge 0 -and $idxToolsHeader -ge 0 -and $idxToolsHeader -gt $idxStateHeader) {
    $coreDir = Join-Path $OutputDir "core"
    if (!(Test-Path -LiteralPath $coreDir)) {
      New-Item -ItemType Directory -Force -Path $coreDir | Out-Null
    }

    function SliceCore([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $coreLines.Length) { $toInclusive = $coreLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $coreLines[$from..$toInclusive]
    }

    $statePath = Join-Path $coreDir "state.js"
    $stateContent = ((SliceCore $idxStateHeader ($idxToolsHeader - 1)) -join "`r`n") + "`r`n"

    $before = @()
    if ($idxStateHeader -gt 0) {
      $before = SliceCore 0 ($idxStateHeader - 1)
    }
    $after = @()
    if (($idxToolsHeader - 1) -lt ($coreLines.Length - 1)) {
      $after = SliceCore $idxToolsHeader ($coreLines.Length - 1)
    }
    $coreContent = (($before + $after) -join "`r`n") + "`r`n"

    Write-Utf8NoBom $statePath $stateContent
    Write-Utf8NoBom $corePath $coreContent

    $coreLines = Get-Content -LiteralPath $corePath -Encoding UTF8
  }

  # Further split 01-core dev tools (isDevelopment/debugMemory) into core/dev-tools.js
  $idxIsDev = Find-LineIndex $coreLines '^\s*const\s+isDevelopment\b'
  $idxDebounce = Find-LineIndex $coreLines '^\s*function\s+debounce\b'
  if ($idxIsDev -ge 0 -and $idxDebounce -ge 0 -and $idxDebounce -gt $idxIsDev) {
    $coreDir = Join-Path $OutputDir "core"
    if (!(Test-Path -LiteralPath $coreDir)) {
      New-Item -ItemType Directory -Force -Path $coreDir | Out-Null
    }

    $idxDevStart = $idxIsDev
    for ($i = $idxIsDev; $i -ge 0; $i--) {
      if ($coreLines[$i] -match '^\s*/\*\*') {
        $idxDevStart = $i
        break
      }
      if ($i -lt ($idxIsDev - 60)) { break }
    }

    function SliceCore([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $coreLines.Length) { $toInclusive = $coreLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $coreLines[$from..$toInclusive]
    }

    $devPath = Join-Path $coreDir "dev-tools.js"
    $devContent = ((SliceCore $idxDevStart ($idxDebounce - 1)) -join "`r`n") + "`r`n"

    $before = @()
    if ($idxDevStart -gt 0) {
      $before = SliceCore 0 ($idxDevStart - 1)
    }
    $after = @()
    if (($idxDebounce - 1) -lt ($coreLines.Length - 1)) {
      $after = SliceCore $idxDebounce ($coreLines.Length - 1)
    }
    $coreContent = (($before + $after) -join "`r`n") + "`r`n"

    Write-Utf8NoBom $devPath $devContent
    Write-Utf8NoBom $corePath $coreContent

    $coreLines = Get-Content -LiteralPath $corePath -Encoding UTF8
  }

  # Further split 01-core utils (debounce/throttle/safeJsonParse/filterItems) into core/utils.js
  $idxDebounce = Find-LineIndex $coreLines '^\s*function\s+debounce\b'
  $idxThrottle = Find-LineIndex $coreLines '^\s*function\s+throttle\b'
  $idxSafeJsonParse = Find-LineIndex $coreLines '^\s*function\s+safeJsonParse\b'
  $idxFilterItems = Find-LineIndex $coreLines '^\s*function\s+filterItems\b'

  $idxUtilsStart = $idxDebounce
  if ($idxDebounce -ge 0) {
    for ($i = $idxDebounce; $i -ge 0; $i--) {
      if ($coreLines[$i] -match '^\s*/\*\*') {
        $idxUtilsStart = $i
        break
      }
      if ($i -lt ($idxDebounce - 60)) { break }
    }
  }

  if ($idxUtilsStart -ge 0 -and $idxDebounce -ge 0 -and $idxThrottle -ge 0 -and $idxSafeJsonParse -ge 0 -and $idxFilterItems -ge 0) {
    $coreDir = Join-Path $OutputDir "core"
    if (!(Test-Path -LiteralPath $coreDir)) {
      New-Item -ItemType Directory -Force -Path $coreDir | Out-Null
    }

    $idxAfterFilter = $idxFilterItems
    for ($i = $idxFilterItems; $i -lt $coreLines.Length; $i++) {
      if ($coreLines[$i] -match '^\s*\}\s*$') {
        $idxAfterFilter = $i
        break
      }
    }

    function SliceCore([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $coreLines.Length) { $toInclusive = $coreLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $coreLines[$from..$toInclusive]
    }

    $utilsPath = Join-Path $coreDir "utils.js"
    $utilsContent = ((SliceCore $idxUtilsStart $idxAfterFilter) -join "`r`n") + "`r`n"

    $before = @()
    if ($idxUtilsStart -gt 0) {
      $before = SliceCore 0 ($idxUtilsStart - 1)
    }
    $after = @()
    if ($idxAfterFilter -lt ($coreLines.Length - 1)) {
      $after = SliceCore ($idxAfterFilter + 1) ($coreLines.Length - 1)
    }
    $coreContent = (($before + $after) -join "`r`n") + "`r`n"

    Write-Utf8NoBom $utilsPath $utilsContent
    Write-Utf8NoBom $corePath $coreContent

    $coreLines = Get-Content -LiteralPath $corePath -Encoding UTF8
  }

  # Further split 01-core DOMCache into core/dom-cache.js
  $idxDomCache = Find-LineIndex $coreLines '^\s*const\s+DOMCache\s*=\s*\{'
  $idxDomHeader = Find-NearestSectionHeader $coreLines $idxDomCache
  if ($idxDomCache -ge 0 -and $idxDomHeader -ge 0) {
    $coreDir = Join-Path $OutputDir "core"
    if (!(Test-Path -LiteralPath $coreDir)) {
      New-Item -ItemType Directory -Force -Path $coreDir | Out-Null
    }

    $idxDomEnd = $idxDomCache
    for ($i = $idxDomCache; $i -lt $coreLines.Length; $i++) {
      if ($coreLines[$i] -match '^\s*\};\s*$') {
        $idxDomEnd = $i
        break
      }
    }

    function SliceCore([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $coreLines.Length) { $toInclusive = $coreLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $coreLines[$from..$toInclusive]
    }

    $domCachePath = Join-Path $coreDir "dom-cache.js"
    $domCacheContent = ((SliceCore $idxDomHeader $idxDomEnd) -join "`r`n") + "`r`n"

    $before = @()
    if ($idxDomHeader -gt 0) {
      $before = SliceCore 0 ($idxDomHeader - 1)
    }
    $after = @()
    if ($idxDomEnd -lt ($coreLines.Length - 1)) {
      $after = SliceCore ($idxDomEnd + 1) ($coreLines.Length - 1)
    }
    $coreContent = (($before + $after) -join "`r`n") + "`r`n"

    Write-Utf8NoBom $domCachePath $domCacheContent
    Write-Utf8NoBom $corePath $coreContent

    $coreLines = Get-Content -LiteralPath $corePath -Encoding UTF8
  }

  $idxSecurityStart = Find-LineIndex $coreLines '^\s*//\s*=+\s*安全工具模块\s*=+' 
  $idxSecurityEnd = Find-LineIndex $coreLines '^\s*const\s+securityUtils\s*=\s*new\s+SecurityUtils\s*\(\)\s*;\s*$'

  if ($idxSecurityStart -ge 0 -and $idxSecurityEnd -ge 0 -and $idxSecurityEnd -ge $idxSecurityStart) {
    function SliceCore([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $coreLines.Length) { $toInclusive = $coreLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $coreLines[$from..$toInclusive]
    }

    $securityPath = Join-Path $servicesDir "security-utils.js"
    $securityContent = ((SliceCore $idxSecurityStart $idxSecurityEnd) -join "`r`n") + "`r`n"

    $before = @()
    if ($idxSecurityStart -gt 0) {
      $before = SliceCore 0 ($idxSecurityStart - 1)
    }
    $after = @()
    if ($idxSecurityEnd -lt ($coreLines.Length - 1)) {
      $after = SliceCore ($idxSecurityEnd + 1) ($coreLines.Length - 1)
    }
    $coreContent = (($before + $after) -join "`r`n") + "`r`n"

    Write-Utf8NoBom $securityPath $securityContent
    Write-Utf8NoBom $corePath $coreContent

    # refresh coreLines after rewrite for subsequent extractions
    $coreLines = Get-Content -LiteralPath $corePath -Encoding UTF8
  }
}

# Further split 01-core storage layer into services/storage (ASCII-safe)
if (Test-Path -LiteralPath $corePath) {
  $idxStorageStart = Find-LineIndex $coreLines '^\s*const\s+__fileContentDB\b'
  if ($idxStorageStart -ge 0) {
    $storageDir = Join-Path $servicesDir "storage"
    if (!(Test-Path -LiteralPath $storageDir)) {
      New-Item -ItemType Directory -Force -Path $storageDir | Out-Null
    }
    $storagePath = Join-Path $storageDir "storage-manager.js"

    function SliceCore([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $coreLines.Length) { $toInclusive = $coreLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $coreLines[$from..$toInclusive]
    }

    $storageContent = ((SliceCore $idxStorageStart ($coreLines.Length - 1)) -join "`r`n") + "`r`n"
    $coreContent = ""
    if ($idxStorageStart -gt 0) {
      $coreContent = ((SliceCore 0 ($idxStorageStart - 1)) -join "`r`n") + "`r`n"
    }

    Write-Utf8NoBom $storagePath $storageContent
    Write-Utf8NoBom $corePath $coreContent
  }
}

$threePath = Join-Path $OutputDir "03-network-translate.js"
if (Test-Path -LiteralPath $threePath) {
  $threeLines = Get-Content -LiteralPath $threePath -Encoding UTF8
  $idxTranslationClass = Find-LineIndex $threeLines '^\s*class\s+TranslationService\b'
  $idxTranslateHeader = Find-NearestSectionHeader $threeLines $idxTranslationClass

  if ($idxTranslationClass -ge 0 -and $idxTranslateHeader -ge 0) {
    function Slice3([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $threeLines.Length) { $toInclusive = $threeLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $threeLines[$from..$toInclusive]
    }

    $networkContent = ((Slice3 0 ($idxTranslateHeader - 1)) -join "`r`n") + "`r`n"
    $translationContent = ((Slice3 $idxTranslateHeader ($threeLines.Length - 1)) -join "`r`n") + "`r`n"

    Write-Utf8NoBom (Join-Path $networkDir "network-utils.js") $networkContent
    Write-Utf8NoBom (Join-Path $servicesDir "translation-service.js") $translationContent

    $legacyThreePath = Join-Path $legacyDir "03-network-translate.js"
    try {
      Copy-Item -LiteralPath $threePath -Destination $legacyThreePath -Force
      Remove-Item -LiteralPath $threePath -Force
    } catch {
      # ignore
    }
  }
}

$translationServicePath = Join-Path $servicesDir "translation-service.js"
if (Test-Path -LiteralPath $translationServicePath) {
  $svcLines = Get-Content -LiteralPath $translationServicePath -Encoding UTF8
  $idxSvcClass = Find-LineIndex $svcLines '^\s*class\s+TranslationService\b'
  if ($idxSvcClass -ge 0) {
    $translationRoot = Join-Path $servicesDir "translation"
    $translationEngines = Join-Path $translationRoot "engines"
    foreach ($d in @($translationRoot, $translationEngines)) {
      if (!(Test-Path -LiteralPath $d)) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
      }
    }

    $idxGetSettings = Find-LineIndex $svcLines '^\s*async\s+getSettings\s*\('
    $idxDeepseek = Find-LineIndex $svcLines '^\s*async\s+translateWithDeepSeek\s*\('
    $idxOpenAI = Find-LineIndex $svcLines '^\s*async\s+translateWithOpenAI\s*\('
    $idxTerminology = Find-LineIndex $svcLines '^\s*findTerminologyMatches\s*\('
    $idxGoogle = Find-LineIndex $svcLines '^\s*async\s+translateWithGoogle\s*\('
    $idxMicrosoft = Find-LineIndex $svcLines '^\s*async\s+translateWithMicrosoft\s*\('
    $idxRateLimit = Find-LineIndex $svcLines '^\s*async\s+checkRateLimit\s*\('
    $idxTranslate = Find-LineIndex $svcLines '^\s*async\s+translate\s*\('
    $idxBatch = Find-LineIndex $svcLines '^\s*async\s+translateBatch\s*\('

    $need = @($idxGetSettings, $idxDeepseek, $idxOpenAI, $idxTerminology, $idxGoogle, $idxMicrosoft, $idxRateLimit, $idxTranslate, $idxBatch)
    $svcOk = $true
    foreach ($n in $need) { if ($n -lt 0) { $svcOk = $false } }

    if ($svcOk) {
      function SliceSvc([int]$from, [int]$toInclusive) {
        if ($from -lt 0) { $from = 0 }
        if ($toInclusive -ge $svcLines.Length) { $toInclusive = $svcLines.Length - 1 }
        if ($toInclusive -lt $from) { return @() }
        return $svcLines[$from..$toInclusive]
      }

      function Convert-MethodBlock([string[]]$block) {
        if ($block.Count -eq 0) { return $block }
        $first = $block[0]
        if ($first -match '^\s*async\s+(\w+)\s*\((.*)\)\s*\{\s*$') {
          $block[0] = "TranslationService.prototype.$($matches[1]) = async function ($($matches[2])) {"
        } elseif ($first -match '^\s*(\w+)\s*\((.*)\)\s*\{\s*$') {
          $block[0] = "TranslationService.prototype.$($matches[1]) = function ($($matches[2])) {"
        }

        for ($i = $block.Count - 1; $i -ge 0; $i--) {
          if ($block[$i] -match '^\s*}\s*$') {
            $block[$i] = "};"
            break
          }
        }
        return $block
      }

      $classHead = SliceSvc $idxSvcClass ($idxGetSettings - 1)
      $classOut = @()
      foreach ($l in $classHead) {
        $classOut += $l
      }
      $classOut += "        }"
      Write-Utf8NoBom (Join-Path $translationRoot "service-class.js") (($classOut -join "`r`n") + "`r`n")

      $compat = @(
        "TranslationService.prototype.cancelAll = function () {",
        "    if (typeof networkUtils !== 'undefined' && networkUtils && typeof networkUtils.cancelAll === 'function') {",
        "        networkUtils.cancelAll();",
        "    }",
        "};",
        "",
        "try {",
        "    Object.defineProperty(TranslationService.prototype, 'activeRequests', {",
        "        get: function () {",
        "            return (typeof networkUtils !== 'undefined' && networkUtils) ? networkUtils.activeRequests : undefined;",
        "        },",
        "        configurable: true",
        "    });",
        "} catch (e) {",
        "    // ignore",
        "}"
      )
      Write-Utf8NoBom (Join-Path $translationRoot "compat.js") (($compat -join "`r`n") + "`r`n")

      $settingsBlock = Convert-MethodBlock (SliceSvc $idxGetSettings ($idxDeepseek - 1))
      Write-Utf8NoBom (Join-Path $translationRoot "settings.js") (($settingsBlock -join "`r`n") + "`r`n")

      $terminologyBlock = Convert-MethodBlock (SliceSvc $idxTerminology ($idxGoogle - 1))
      Write-Utf8NoBom (Join-Path $translationRoot "terminology.js") (($terminologyBlock -join "`r`n") + "`r`n")

      $deepseekBlock = Convert-MethodBlock (SliceSvc $idxDeepseek ($idxOpenAI - 1))
      Write-Utf8NoBom (Join-Path $translationEngines "deepseek.js") (($deepseekBlock -join "`r`n") + "`r`n")

      $openaiBlock = Convert-MethodBlock (SliceSvc $idxOpenAI ($idxTerminology - 1))
      Write-Utf8NoBom (Join-Path $translationEngines "openai.js") (($openaiBlock -join "`r`n") + "`r`n")

      $googleBlock = Convert-MethodBlock (SliceSvc $idxGoogle ($idxMicrosoft - 1))
      Write-Utf8NoBom (Join-Path $translationEngines "google.js") (($googleBlock -join "`r`n") + "`r`n")

      $microsoftBlock = Convert-MethodBlock (SliceSvc $idxMicrosoft ($idxRateLimit - 1))
      Write-Utf8NoBom (Join-Path $translationEngines "microsoft.js") (($microsoftBlock -join "`r`n") + "`r`n")

      $rateBlock = Convert-MethodBlock (SliceSvc $idxRateLimit ($idxTranslate - 1))
      Write-Utf8NoBom (Join-Path $translationRoot "rate-limit.js") (($rateBlock -join "`r`n") + "`r`n")

      $translateBlock = Convert-MethodBlock (SliceSvc $idxTranslate ($idxBatch - 1))
      Write-Utf8NoBom (Join-Path $translationRoot "translate.js") (($translateBlock -join "`r`n") + "`r`n")

      $batchBlock = Convert-MethodBlock (SliceSvc $idxBatch ($svcLines.Length - 1))
      Write-Utf8NoBom (Join-Path $translationRoot "batch.js") (($batchBlock -join "`r`n") + "`r`n")

      $thin = @(
        "        // ==================== 翻译API服务模块 ====================",
        "        ",
        "        // 创建全局翻译服务实例",
        "        const translationService = new TranslationService();",
        ""
      )
      Write-Utf8NoBom $translationServicePath (($thin -join "`r`n") + "`r`n")
    }
  }
}

# Further split 04 into core/ui/features modules (ASCII-safe)
$coreDir = Join-Path $OutputDir "core"
$uiDir = Join-Path $OutputDir "ui"
$featuresDir = Join-Path $OutputDir "features"
$featuresTermDir = Join-Path $featuresDir "terminology"
$featuresSampleDir = Join-Path $featuresDir "sample"
foreach ($d in @($coreDir, $uiDir, $featuresDir, $featuresTermDir, $featuresSampleDir)) {
  if (!(Test-Path -LiteralPath $d)) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
  }
}

$fourPath = Join-Path $OutputDir "04-events-ui.js"
if (Test-Path -LiteralPath $fourPath) {
  $fourLines = Get-Content -LiteralPath $fourPath -Encoding UTF8

  $idxDom = Find-LineIndex $fourLines '^\s*let\s+__appDomInitialized\s*=\s*false\s*;\s*$'
  if ($idxDom -lt 0) {
    $idxDom = Find-LineIndex $fourLines '^\s*async\s+function\s+__onAppDomContentLoaded\s*\(\)\s*\{'
  }
  $idxBootstrapAssign = Find-LineIndex $fourLines '^\s*window\.__appBootstrap\s*=\s*__onAppDomContentLoaded\s*;\s*$'
  $idxEventListeners = Find-LineIndex $fourLines '^\s*let\s+eventListenersInitialized\s*=\s*false\s*;\s*$'
  $idxUiHeader = Find-NearestSectionHeader $fourLines $idxEventListeners

  if ($idxDom -ge 0 -and $idxBootstrapAssign -ge 0 -and $idxEventListeners -ge 0 -and $idxUiHeader -ge 0) {
    function Slice4([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $fourLines.Length) { $toInclusive = $fourLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $fourLines[$from..$toInclusive]
    }

    $eventManagerContent = ((Slice4 0 ($idxDom - 1)) -join "`r`n") + "`r`n"
    $bootstrapContent = ((Slice4 $idxDom $idxBootstrapAssign) -join "`r`n") + "`r`n"
    $engineModelContent = ((Slice4 $idxUiHeader ($idxEventListeners - 1)) -join "`r`n") + "`r`n"
    $remainderContent = ((Slice4 $idxEventListeners ($fourLines.Length - 1)) -join "`r`n") + "`r`n"

    Write-Utf8NoBom (Join-Path $coreDir "event-manager.js") $eventManagerContent
    Write-Utf8NoBom (Join-Path $coreDir "bootstrap.js") $bootstrapContent
    Write-Utf8NoBom (Join-Path $uiDir "engine-model-sync.js") $engineModelContent

    # Rewrite 04 to remainder (kept for backward compatibility; loader doesn't load it)
    Write-Utf8NoBom $fourPath $remainderContent

    # Move remainder to legacy folder to avoid accidental edits/loads
    $legacyDir = Join-Path $OutputDir "legacy"
    if (!(Test-Path -LiteralPath $legacyDir)) {
      New-Item -ItemType Directory -Force -Path $legacyDir | Out-Null
    }
    $legacyFourPath = Join-Path $legacyDir "04-events-ui.js"
    try {
      Copy-Item -LiteralPath $fourPath -Destination $legacyFourPath -Force
      Remove-Item -LiteralPath $fourPath -Force
    } catch {
      # ignore
    }

    $remainderForSplitPath = $legacyFourPath
    if (!(Test-Path -LiteralPath $remainderForSplitPath)) {
      $remainderForSplitPath = $fourPath
    }

    # Further split the remainder (settings/charts/terminology/sample/file-drop)
    $rLines = Get-Content -LiteralPath $remainderForSplitPath -Encoding UTF8
    $idxLoadSettings = Find-LineIndex $rLines '^\s*async\s+function\s+loadSettings\b'
    $idxChartsVars = Find-LineIndex $rLines '^\s*let\s+qualityCheckCharts\b'
    $idxInitTerminology = Find-LineIndex $rLines '^\s*function\s+initTerminology\b'
    $idxLoadSampleProject = Find-LineIndex $rLines '^\s*function\s+loadSampleProject\b'
    $idxSetDropAreaActive = Find-LineIndex $rLines '^\s*function\s+setDropAreaActive\b'

    if ($idxLoadSettings -ge 0 -and $idxChartsVars -ge 0 -and $idxInitTerminology -ge 0 -and $idxLoadSampleProject -ge 0 -and $idxSetDropAreaActive -ge 0) {
      function SliceR([int]$from, [int]$toInclusive) {
        if ($from -lt 0) { $from = 0 }
        if ($toInclusive -ge $rLines.Length) { $toInclusive = $rLines.Length - 1 }
        if ($toInclusive -lt $from) { return @() }
        return $rLines[$from..$toInclusive]
      }

      $settingsContent = ((SliceR $idxLoadSettings ($idxChartsVars - 1)) -join "`r`n") + "`r`n"
      $chartsContent = ((SliceR $idxChartsVars ($idxInitTerminology - 1)) -join "`r`n") + "`r`n"
      $terminologyContent = ((SliceR $idxInitTerminology ($idxLoadSampleProject - 1)) -join "`r`n") + "`r`n"
      $sampleContent = ((SliceR $idxLoadSampleProject ($idxSetDropAreaActive - 1)) -join "`r`n") + "`r`n"
      $fileDropContent = ((SliceR $idxSetDropAreaActive ($rLines.Length - 1)) -join "`r`n") + "`r`n"

      # Keep modularized ui/event-listeners.js (and its submodules) as the source of truth.
      # Store the monolith-extracted version in legacy for reference/debugging.
      $legacyDir = Join-Path $OutputDir "legacy"
      if (!(Test-Path -LiteralPath $legacyDir)) {
        New-Item -ItemType Directory -Force -Path $legacyDir | Out-Null
      }
      Write-Utf8NoBom (Join-Path $uiDir "settings.js") $settingsContent
      Write-Utf8NoBom (Join-Path $uiDir "charts.js") $chartsContent
      Write-Utf8NoBom (Join-Path $featuresTermDir "init.js") $terminologyContent
      Write-Utf8NoBom (Join-Path $featuresSampleDir "sample-project.js") $sampleContent
      Write-Utf8NoBom (Join-Path $uiDir "file-drop.js") $fileDropContent
    }
  }
}

# Further split 05 into smaller modules by section headers (ASCII-safe)
$fivePath = Join-Path $OutputDir "05-files-perf-quality.js"
if (Test-Path -LiteralPath $fivePath) {
  $fiveLines = Get-Content -LiteralPath $fivePath -Encoding UTF8
  $headerIdx = @()
  for ($i = 0; $i -lt $fiveLines.Length; $i++) {
    if ($fiveLines[$i] -match '^\s*//\s*=+') {
      $headerIdx += $i
    }
  }

  if ($headerIdx.Count -ge 5) {
    function Slice5([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $fiveLines.Length) { $toInclusive = $fiveLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $fiveLines[$from..$toInclusive]
    }

    $h = $headerIdx[0..4]
    $subParts = @(
      @{ name = "05-files.js"; from = $h[0]; to = $h[1] - 1 },
      @{ name = "06-xml.js"; from = $h[1]; to = $h[2] - 1 },
      @{ name = "07-perf.js"; from = $h[2]; to = $h[3] - 1 },
      @{ name = "08-lists.js"; from = $h[3]; to = $h[4] - 1 },
      @{ name = "09-quality.js"; from = $h[4]; to = $fiveLines.Length - 1 }
    )

    foreach ($sp in $subParts) {
      $outPath = Join-Path $OutputDir $sp.name
      $content = ((Slice5 $sp.from $sp.to) -join "`r`n") + "`r`n"
      Write-Utf8NoBom $outPath $content
    }

    # 05-files-perf-quality.js is a split intermediate. Keep a snapshot in legacy, but don't keep it in public/app.
    $legacyDir = Join-Path $OutputDir "legacy"
    if (!(Test-Path -LiteralPath $legacyDir)) {
      New-Item -ItemType Directory -Force -Path $legacyDir | Out-Null
    }
    $legacyFivePath = Join-Path $legacyDir "05-files-perf-quality.js"
    try {
      Copy-Item -LiteralPath $fivePath -Destination $legacyFivePath -Force
      Remove-Item -LiteralPath $fivePath -Force
    } catch {
      # ignore
    }
  }
}

$compatDir = Join-Path $OutputDir "compat"
if (!(Test-Path -LiteralPath $compatDir)) {
  New-Item -ItemType Directory -Force -Path $compatDir | Out-Null
}

$fiveFilesPath = Join-Path $OutputDir "05-files.js"
if (Test-Path -LiteralPath $fiveFilesPath) {
  $fLines = Get-Content -LiteralPath $fiveFilesPath -Encoding UTF8

  $idxRead = Find-LineIndex $fLines '^\s*async\s+function\s+readFileAsync\b'
  $idxParse = Find-LineIndex $fLines '^\s*async\s+function\s+parseFileAsync\b'
  $idxProcess = Find-LineIndex $fLines '^\s*async\s+function\s+processFiles\b'
  $idxComplete = Find-LineIndex $fLines '^\s*async\s+function\s+completeFileProcessing\b'

  if ($idxRead -ge 0 -and $idxParse -ge 0 -and $idxProcess -ge 0 -and $idxComplete -ge 0) {
    function SliceFiles([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $fLines.Length) { $toInclusive = $fLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $fLines[$from..$toInclusive]
    }

    $featuresDir = Join-Path $OutputDir "features"
    $filesFeatureDir = Join-Path $featuresDir "files"
    foreach ($d in @($featuresDir, $filesFeatureDir)) {
      if (!(Test-Path -LiteralPath $d)) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
      }
    }

    $readBlock = ((SliceFiles $idxRead ($idxParse - 1)) -join "`r`n")
    $parseBlock = ((SliceFiles $idxParse ($idxProcess - 1)) -join "`r`n")
    $processBlock = ((SliceFiles $idxProcess ($idxComplete - 1)) -join "`r`n")
    $completeBlock = ((SliceFiles $idxComplete ($fLines.Length - 1)) -join "`r`n")

    $readOut = ($readBlock -replace '^\s*async\s+function\s+readFileAsync\b', 'async function __readFileAsyncImpl') + "`r`n"
    $parseOut = $parseBlock
    $parseOut = $parseOut -replace '^\s*async\s+function\s+parseFileAsync\b', 'async function __parseFileAsyncImpl'
    $parseOut = $parseOut -replace '\breadFileAsync\b', '__readFileAsyncImpl'
    $parseOut = $parseOut + "`r`n"

    $processOut = $processBlock
    $processOut = $processOut -replace '^\s*async\s+function\s+processFiles\b', 'async function __processFilesImpl'
    $processOut = $processOut -replace '\bparseFileAsync\b', '__parseFileAsyncImpl'
    $processOut = $processOut -replace '\bcompleteFileProcessing\b', '__completeFileProcessingImpl'
    $processOut = $processOut + "`r`n" + (($completeBlock -replace '^\s*async\s+function\s+completeFileProcessing\b', 'async function __completeFileProcessingImpl') + "`r`n")

    Write-Utf8NoBom (Join-Path $filesFeatureDir "read.js") $readOut
    Write-Utf8NoBom (Join-Path $filesFeatureDir "parse.js") $parseOut
    Write-Utf8NoBom (Join-Path $filesFeatureDir "process.js") $processOut

    $wrapper = @(
      '        // ==================== 文件处理功能（优化版） ====================',
      '        ',
      '        // 读取单个文件',
      '        async function readFileAsync(file) {',
      '            return __readFileAsyncImpl(file);',
      '        }',
      '        ',
      '        // 解析单个文件',
      '        async function parseFileAsync(file) {',
      '            return __parseFileAsyncImpl(file);',
      '        }',
      '        ',
      '        // 处理多个文件（优化版）',
      '        async function processFiles(files) {',
      '            return __processFilesImpl(files);',
      '        }',
      '        ',
      '        // 完成文件处理',
      '        async function completeFileProcessing(files, newItems) {',
      '            return __completeFileProcessingImpl(files, newItems);',
      '        }',
      '        '
    )
    $compatFilesPath = Join-Path $compatDir "files.js"
    Write-Utf8NoBom $compatFilesPath (($wrapper -join "`r`n") + "`r`n")

    try {
      Remove-Item -LiteralPath $fiveFilesPath -Force
    } catch {
      # ignore
    }
  }
}

$sevenPath = Join-Path $OutputDir "07-perf.js"
if (Test-Path -LiteralPath $sevenPath) {
  $pLines = Get-Content -LiteralPath $sevenPath -Encoding UTF8

  $idxSync = Find-LineIndex $pLines '^\s*function\s+syncTranslationHeights\b'
  $idxDebounced = Find-LineIndex $pLines '^\s*const\s+debouncedSyncHeights\b'

  if ($idxSync -ge 0 -and $idxDebounced -ge 0 -and $idxDebounced -gt $idxSync) {
    $idxSyncStart = $idxSync
    for ($i = $idxSync; $i -ge 0; $i--) {
      if ($pLines[$i] -match '^\s*//') {
        $idxSyncStart = $i
      } else {
        break
      }
    }

    function SlicePerf([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $pLines.Length) { $toInclusive = $pLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $pLines[$from..$toInclusive]
    }

    $perfDir = Join-Path $uiDir "perf"
    if (!(Test-Path -LiteralPath $perfDir)) {
      New-Item -ItemType Directory -Force -Path $perfDir | Out-Null
    }

    $syncBlock = ((SlicePerf $idxSyncStart ($idxDebounced - 1)) -join "`r`n")
    $syncOut = ($syncBlock -replace '\bfunction\s+syncTranslationHeights\b', 'function __syncTranslationHeightsImpl') + "`r`n"
    Write-Utf8NoBom (Join-Path $perfDir "sync-heights.js") $syncOut

    $pre = @()
    if ($idxSyncStart -gt 0) {
      $pre = SlicePerf 0 ($idxSyncStart - 1)
    }
    $tail = SlicePerf $idxDebounced ($pLines.Length - 1)

    $wrapperLines = @()
    $wrapperLines += $pre
    $wrapperLines += ''
    $wrapperLines += '        // 更新同步高度函数（优化版 - 使用防抖和缓存）'
    $wrapperLines += '        function syncTranslationHeights() {'
    $wrapperLines += '            return __syncTranslationHeightsImpl();'
    $wrapperLines += '        }'
    $wrapperLines += '        '
    $wrapperLines += $tail

    $compatPerfPath = Join-Path $compatDir "perf.js"
    Write-Utf8NoBom $compatPerfPath (($wrapperLines -join "`r`n") + "`r`n")

    try {
      Remove-Item -LiteralPath $sevenPath -Force
    } catch {
      # ignore
    }
  }
}

$ninePath = Join-Path $OutputDir "09-quality.js"
if (Test-Path -LiteralPath $ninePath) {
  $legacyDir = Join-Path $OutputDir "legacy"
  if (!(Test-Path -LiteralPath $legacyDir)) {
    New-Item -ItemType Directory -Force -Path $legacyDir | Out-Null
  }

  $legacyNinePath = Join-Path $legacyDir "09-quality.js"
  try {
    Copy-Item -LiteralPath $ninePath -Destination $legacyNinePath -Force
  } catch {
    # ignore
  }

  $wrapper = @(
    '// ==================== 质量检查功能 ====================',
    '',
    '// 重置筛选条件',
    'function resetIssueFilter() {',
    '  return __resetIssueFilterImpl();',
    '}',
    '',
    '// 运行质量检查（优化版）',
    'async function runQualityCheck() {',
    '  return __runQualityCheckImpl();',
    '}',
    '',
    '// 批处理函数',
    'async function processBatch(items) {',
    '  return __processBatchImpl(items);',
    '}',
    '',
    '// 带缓存的检查函数',
    'async function checkTranslationItemCached(item) {',
    '  return __checkTranslationItemCachedImpl(item);',
    '}',
    '',
    '// 优化的检查函数',
    'async function checkTranslationItemOptimized(item) {',
    '  return __checkTranslationItemOptimizedImpl(item);',
    '}',
    '',
    '// 转义正则表达式特殊字符',
    'function escapeRegex(text) {',
    '  return __escapeRegexImpl(text);',
    '}',
    '',
    '// 计算总体评分',
    'function calculateOverallScore() {',
    '  return __calculateOverallScoreImpl();',
    '}',
    '',
    '// 更新质量报告UI',
    'function updateQualityReportUI() {',
    '  return __updateQualityReportUIImpl();',
    '}',
    '',
    '// 更新问题列表（优化版）',
    'function updateIssuesTable(filter = { severity: "all", type: "all" }) {',
    '  return __updateIssuesTableImpl(filter);',
    '}',
    '',
    '// 过滤问题（节流版）',
    'const filterIssuesThrottled = throttle(function () {',
    '  const severity = document.getElementById("issueFilterSeverity").value;',
    '  const type = document.getElementById("issueFilterType").value;',
    '',
    '  updateIssuesTable({ severity, type });',
    '}, 300);',
    '',
    'function filterIssues() {',
    '  filterIssuesThrottled();',
    '}',
    '',
    '// 定位到翻译项',
    'function focusTranslationItem(itemId) {',
    '  return __focusTranslationItemImpl(itemId);',
    '}',
    '',
    '// 更新质量图表',
    'function updateQualityCharts() {',
    '  return __updateQualityChartsImpl();',
    '}',
    '',
    '// 导出质量报告',
    'function exportQualityReportData() {',
    '  return __exportQualityReportDataImpl();',
    '}',
    ''
  )
  $compatQualityPath = Join-Path $compatDir "quality.js"
  Write-Utf8NoBom $compatQualityPath (($wrapper -join "`r`n") + "`r`n")

  try {
    Remove-Item -LiteralPath $ninePath -Force
  } catch {
    # ignore
  }
}

$sixPath = Join-Path $OutputDir "06-xml.js"
if (Test-Path -LiteralPath $sixPath) {
  $sixLines = Get-Content -LiteralPath $sixPath -Encoding UTF8

  $idxGeneric = Find-LineIndex $sixLines '^\s*function\s+parseGenericXML\b'
  $idxAndroid = Find-LineIndex $sixLines '^\s*function\s+parseAndroidStrings\b'
  $idxXliff = Find-LineIndex $sixLines '^\s*function\s+parseXLIFF\b'
  $idxIos = Find-LineIndex $sixLines '^\s*function\s+parseIOSStrings\b'
  $idxResx = Find-LineIndex $sixLines '^\s*function\s+parseRESX\b'
  $idxPo = Find-LineIndex $sixLines '^\s*function\s+parsePO\b'
  $idxJson = Find-LineIndex $sixLines '^\s*function\s+parseJSON\b'
  $idxText = Find-LineIndex $sixLines '^\s*function\s+parseTextFile\b'
  $idxUpdateTree = Find-LineIndex $sixLines '^\s*function\s+updateFileTree\b'

  if ($idxGeneric -ge 0 -and $idxAndroid -ge 0 -and $idxXliff -ge 0 -and $idxIos -ge 0 -and $idxResx -ge 0 -and $idxPo -ge 0 -and $idxJson -ge 0 -and $idxText -ge 0 -and $idxUpdateTree -ge 0) {
    function Slice6([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $sixLines.Length) { $toInclusive = $sixLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $sixLines[$from..$toInclusive]
    }

    $parsersDir = Join-Path $OutputDir "parsers"
    if (!(Test-Path -LiteralPath $parsersDir)) {
      New-Item -ItemType Directory -Force -Path $parsersDir | Out-Null
    }

    $xmlGenericContent = ((Slice6 0 ($idxAndroid - 1)) -join "`r`n") + "`r`n"
    $xmlAndroidContent = ((Slice6 $idxAndroid ($idxXliff - 1)) -join "`r`n") + "`r`n"
    $xliffContent = ((Slice6 $idxXliff ($idxIos - 1)) -join "`r`n") + "`r`n"
    $iosContent = ((Slice6 $idxIos ($idxResx - 1)) -join "`r`n") + "`r`n"
    $resxContent = ((Slice6 $idxResx ($idxPo - 1)) -join "`r`n") + "`r`n"
    $poContent = ((Slice6 $idxPo ($idxJson - 1)) -join "`r`n") + "`r`n"
    $jsonContent = ((Slice6 $idxJson ($idxText - 1)) -join "`r`n") + "`r`n"
    $textContent = ((Slice6 $idxText ($idxUpdateTree - 1)) -join "`r`n") + "`r`n"
    $fileTreeContent = ((Slice6 $idxUpdateTree ($sixLines.Length - 1)) -join "`r`n") + "`r`n"

    Write-Utf8NoBom (Join-Path $parsersDir "xml-generic.js") $xmlGenericContent
    Write-Utf8NoBom (Join-Path $parsersDir "xml-android.js") $xmlAndroidContent
    Write-Utf8NoBom (Join-Path $parsersDir "xliff.js") $xliffContent
    Write-Utf8NoBom (Join-Path $parsersDir "ios-strings.js") $iosContent
    Write-Utf8NoBom (Join-Path $parsersDir "resx.js") $resxContent
    Write-Utf8NoBom (Join-Path $parsersDir "po.js") $poContent
    Write-Utf8NoBom (Join-Path $parsersDir "json.js") $jsonContent
    Write-Utf8NoBom (Join-Path $parsersDir "text.js") $textContent
    Write-Utf8NoBom (Join-Path $uiDir "file-tree.js") $fileTreeContent

    # 06-xml.js is a split intermediate. Keep a snapshot in legacy, but don't keep it in public/app.
    $legacyDir = Join-Path $OutputDir "legacy"
    if (!(Test-Path -LiteralPath $legacyDir)) {
      New-Item -ItemType Directory -Force -Path $legacyDir | Out-Null
    }
    $legacySixPath = Join-Path $legacyDir "06-xml.js"
    try {
      Copy-Item -LiteralPath $sixPath -Destination $legacySixPath -Force
      Remove-Item -LiteralPath $sixPath -Force
    } catch {
      # ignore
    }
  }
}

# Further split 08 into features/translations modules (ASCII-safe)
$eightPath = Join-Path $OutputDir "08-lists.js"
if (Test-Path -LiteralPath $eightPath) {
  $featuresDir = Join-Path $OutputDir "features"
  $translationsDir = Join-Path $featuresDir "translations"
  $legacyDir = Join-Path $OutputDir "legacy"
  foreach ($d in @($featuresDir, $translationsDir, $legacyDir)) {
    if (!(Test-Path -LiteralPath $d)) {
      New-Item -ItemType Directory -Force -Path $d | Out-Null
    }
  }

  $eightLines = Get-Content -LiteralPath $eightPath -Encoding UTF8

  $idxSearchCache = Find-LineIndex $eightLines '^\s*let\s+searchCache\s*=\s*new\s+Map\(\)'
  $idxSelection = Find-LineIndex $eightLines '^\s*function\s+updateSelectionStyles\b'
  $idxClearTargets = Find-LineIndex $eightLines '^\s*function\s+clearSelectedTargets\b'
  $idxExport = Find-LineIndex $eightLines '^\s*async\s+function\s+exportTranslation\b'
  $idxStatusText = Find-LineIndex $eightLines '^\s*function\s+getStatusText\b'

  if ($idxSearchCache -ge 0 -and $idxSelection -ge 0 -and $idxClearTargets -ge 0 -and $idxExport -ge 0 -and $idxStatusText -ge 0) {
    function Slice8([int]$from, [int]$toInclusive) {
      if ($from -lt 0) { $from = 0 }
      if ($toInclusive -ge $eightLines.Length) { $toInclusive = $eightLines.Length - 1 }
      if ($toInclusive -lt $from) { return @() }
      return $eightLines[$from..$toInclusive]
    }

    $idxStatusHeader = $idxStatusText
    for ($i = $idxStatusText; $i -ge 0; $i--) {
      if ($eightLines[$i] -match '^\s*//') {
        $idxStatusHeader = $i
        break
      }
    }

    $statusContent = ((Slice8 $idxStatusHeader ($eightLines.Length - 1)) -join "`r`n") + "`r`n"
    $renderContent = ((Slice8 0 ($idxSearchCache - 1)) -join "`r`n") + "`r`n"
    $searchContent = ((Slice8 $idxSearchCache ($idxSelection - 1)) -join "`r`n") + "`r`n"
    $selectionContent = ((Slice8 $idxSelection ($idxClearTargets - 1)) -join "`r`n") + "`r`n"
    $actionsContent = ((Slice8 $idxClearTargets ($idxExport - 1)) -join "`r`n") + "`r`n"
    $exportContent = ((Slice8 $idxExport ($idxStatusHeader - 1)) -join "`r`n") + "`r`n"

    Write-Utf8NoBom (Join-Path $translationsDir "status.js") $statusContent
    Write-Utf8NoBom (Join-Path $translationsDir "render.js") $renderContent
    Write-Utf8NoBom (Join-Path $translationsDir "search.js") $searchContent
    Write-Utf8NoBom (Join-Path $translationsDir "selection.js") $selectionContent
    Write-Utf8NoBom (Join-Path $translationsDir "actions.js") $actionsContent
    Write-Utf8NoBom (Join-Path $translationsDir "export.js") $exportContent

    $legacyEightPath = Join-Path $legacyDir "08-lists.js"
    try {
      Copy-Item -LiteralPath $eightPath -Destination $legacyEightPath -Force
      Remove-Item -LiteralPath $eightPath -Force
    } catch {
      # ignore
    }
  }
}

# Replace public/app.js with a tiny sequential loader (keeps index.html unchanged)
$loader = @"
// __APP_SPLIT_LOADER__
// This file loads split parts in order. It is intentionally NOT an ES module
// so that opening index.html via file:// keeps working.
(function () {
  var scripts = [
    'app/core/state.js',
    'app/core/utils.js',
    'app/core/dom-cache.js',
    'app/core/dev-tools.js',
    'app/services/security-utils.js',
    'app/services/storage/storage-manager.js',
    'app/core/event-manager.js',
    'app/services/auto-save-manager.js',
    'app/network/network-utils.js',
    'app/services/translation/service-class.js',
    'app/services/translation/compat.js',
    'app/services/translation/settings.js',
    'app/services/translation/terminology.js',
    'app/services/translation/engines/deepseek.js',
    'app/services/translation/engines/openai.js',
    'app/services/translation/engines/google.js',
    'app/services/translation/engines/microsoft.js',
    'app/services/translation/rate-limit.js',
    'app/services/translation/translate.js',
    'app/services/translation/batch.js',
    'app/services/translation-service.js',
    'app/parsers/xml-generic.js',
    'app/parsers/xml-android.js',
    'app/parsers/xliff.js',
    'app/parsers/ios-strings.js',
    'app/parsers/resx.js',
    'app/parsers/po.js',
    'app/parsers/json.js',
    'app/parsers/text.js',
    'app/ui/file-tree.js',
    'app/features/files/read.js',
    'app/features/files/parse.js',
    'app/features/files/process.js',
    'app/compat/files.js',
    'app/ui/perf/sync-heights.js',
    'app/compat/perf.js',
    'app/features/translations/status.js',
    'app/features/translations/render.js',
    'app/features/translations/search.js',
    'app/features/translations/selection.js',
    'app/features/translations/actions.js',
    'app/features/translations/export.js',
    'app/ui/charts.js',
    'app/features/quality/checks.js',
    'app/features/quality/scoring.js',
    'app/features/quality/charts.js',
    'app/features/quality/ui.js',
    'app/features/quality/export.js',
    'app/features/quality/run.js',
    'app/compat/quality.js',
    'app/features/terminology/init.js',
    'app/features/sample/sample-project.js',
    'app/ui/engine-model-sync.js',
    'app/ui/event-listeners/keyboard.js',
    'app/ui/event-listeners/translations-lists.js',
    'app/ui/event-listeners/file-panels.js',
    'app/ui/event-listeners/terminology.js',
    'app/ui/event-listeners/settings.js',
    'app/ui/event-listeners/translations-search.js',
    'app/ui/event-listeners/data-and-ui.js',
    'app/ui/event-listeners/quality.js',
    'app/ui/event-listeners.js',
    'app/ui/settings.js',
    'app/ui/file-drop.js',
    'app/core/bootstrap.js'
  ];

  var suffix = '';
  try {
    var cs = document.currentScript && document.currentScript.src;
    if (cs) {
      var u = new URL(cs, window.location.href);
      var v = u.searchParams.get('v');
      if (v) suffix = '?v=' + encodeURIComponent(v);
    }
  } catch (e) { }

  function bootstrapWhenReady() {
    function run() {
      try {
        if (typeof window.__appBootstrap === 'function') {
          Promise.resolve(window.__appBootstrap()).catch(function (e) {
            console.error('App bootstrap failed:', e);
          });
        } else {
          console.error('App bootstrap entry not found: window.__appBootstrap');
        }
      } catch (e) {
        console.error('App bootstrap threw:', e);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  function loadAt(i) {
    if (i >= scripts.length) {
      bootstrapWhenReady();
      return;
    }
    var s = document.createElement('script');
    s.src = scripts[i] + suffix;
    s.async = false;
    s.onload = function () { loadAt(i + 1); };
    s.onerror = function () {
      console.error('Failed to load script:', s.src);
    };
    document.head.appendChild(s);
  }

  loadAt(0);
})();
"@

Write-Utf8NoBom $SourcePath ($loader -replace "`n", "`r`n")

Write-Host "Split complete:" -ForegroundColor Green
Write-Host "  Output: $OutputDir\\*.js" -ForegroundColor Gray
Write-Host "  Loader: $SourcePath" -ForegroundColor Gray
