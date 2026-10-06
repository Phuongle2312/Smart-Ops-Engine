<#
.SYNOPSIS
    Chạy toàn bộ kiểm thử của repo Smart Ops Engine và in bảng tổng kết.

.DESCRIPTION
    Các bước (theo thứ tự):
      1. web     — npm ci (nếu chưa có node_modules), npm run lint, npm run build
      2. backend — mvnw.cmd test (JUnit 5 + Mockito)

    Trả về exit code 0 khi mọi bước đạt, 1 khi có bước lỗi — dùng được trong CI.

.EXAMPLE
    .\tools\scripts\test-all.ps1

.EXAMPLE
    .\tools\scripts\test-all.ps1 -Only web
#>
[CmdletBinding()]
param(
    # Chỉ chạy các bước được liệt kê
    [ValidateSet('web', 'backend')]
    [string[]]$Only
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$webDir = Join-Path $repoRoot 'apps\web'
$backendDir = Join-Path $repoRoot 'apps\backend'

$steps = @('web', 'backend')
if ($Only) { $steps = $Only }

$summary = New-Object System.Collections.Generic.List[object]

function Invoke-Step {
    param([string]$Name, [string]$WorkDir, [scriptblock]$Action)
    Write-Host ''
    Write-Host ("==== {0} ====" -f $Name) -ForegroundColor Cyan
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $ok = $false
    $note = ''
    Push-Location $WorkDir
    try {
        # Lấy giá trị cuối cùng của khối lệnh làm kết quả (bỏ qua output phụ nếu có)
        $ok = [bool](& $Action | Select-Object -Last 1)
        if (-not $ok) { $note = "exit code $LASTEXITCODE" }
    } catch {
        $note = $_.Exception.Message
    } finally {
        Pop-Location
        $watch.Stop()
    }
    $summary.Add([pscustomobject]@{
        Bước      = $Name
        'Kết quả' = $(if ($ok) { 'ĐẠT' } else { 'LỖI' })
        'Thời gian' = ('{0:N0}s' -f $watch.Elapsed.TotalSeconds)
        'Ghi chú' = $note
    })
}

# Chạy lệnh native, trả $true nếu exit code = 0
function Exec {
    param([string]$File, [string[]]$Arguments)
    Write-Host ("> {0} {1}" -f $File, ($Arguments -join ' ')) -ForegroundColor DarkGray
    # PowerShell 5.1 biến dòng stderr của lệnh native thành lỗi khi ErrorActionPreference=Stop
    # (vite, maven ghi cảnh báo ra stderr) — chỉ dựa vào exit code để đánh giá.
    $ErrorActionPreference = 'Continue'
    & $File @Arguments 2>&1 | ForEach-Object { "$_" } | Out-Host
    return ($LASTEXITCODE -eq 0)
}

# ---------------------------------------------------------------------------
if ($steps -contains 'web') {
    Invoke-Step 'web (lint + build)' $webDir {
        if (-not (Test-Path 'node_modules')) {
            if (-not (Exec 'npm.cmd' @('ci'))) { return $false }
        }
        (Exec 'npm.cmd' @('run', 'lint')) -and (Exec 'npm.cmd' @('run', 'build'))
    }
}

if ($steps -contains 'backend') {
    Invoke-Step 'backend (mvnw test)' $backendDir {
        Exec (Join-Path $backendDir 'mvnw.cmd') @('-q', 'test')
    }
}

# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '==== TỔNG KẾT ====' -ForegroundColor Cyan
$summary | Format-Table -AutoSize | Out-String | Write-Host
$failed = @($summary | Where-Object { $_.'Kết quả' -ne 'ĐẠT' })
if ($failed.Count -gt 0) {
    Write-Host ("{0} bước lỗi." -f $failed.Count) -ForegroundColor Red
    exit 1
}
Write-Host 'Tất cả các bước đều đạt.' -ForegroundColor Green
exit 0
