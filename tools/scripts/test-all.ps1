<#
.SYNOPSIS
    Chạy toàn bộ kiểm thử của repo Smart Ops Engine và in bảng tổng kết.

.DESCRIPTION
    Các bước (theo thứ tự):
      1. backend-v3 — dotnet test SmartOpsEngine.sln (unit + architecture test)
      2. web        — npm ci (nếu chưa có node_modules), npm run lint, npm run build
      3. legacy-v1  — mvnw.cmd test (JUnit 5 + Mockito)
      4. smoke      — (chỉ khi có -Smoke) khởi động Identity :5001 + Gateway :8080 từ bản build,
                      chạy tools/scripts/smoke-m1.ps1 rồi tắt service. Cần SQL Server đang chạy.

    Trả về exit code 0 khi mọi bước đạt, 1 khi có bước lỗi — dùng được trong CI.

.EXAMPLE
    .\tools\scripts\test-all.ps1

.EXAMPLE
    .\tools\scripts\test-all.ps1 -Only backend,web

.EXAMPLE
    # Kèm smoke test API; chuỗi kết nối dùng Windows Authentication
    .\tools\scripts\test-all.ps1 -Smoke -ConnectionString 'Server=localhost,1433;Database=soe_identity_dev;Integrated Security=True;TrustServerCertificate=True;Encrypt=True'
#>
[CmdletBinding()]
param(
    # Chỉ chạy các bước được liệt kê
    [ValidateSet('backend', 'web', 'legacy', 'smoke')]
    [string[]]$Only,
    [switch]$SkipLegacy,
    [switch]$Smoke,
    # Chuỗi kết nối cho Identity khi chạy smoke; để trống thì dùng ConnectionStrings__Default
    # hoặc appsettings.Development.json
    [string]$ConnectionString = $env:ConnectionStrings__Default,
    # Mật khẩu admin cho smoke test; để trống thì lấy Identity:InitialAdminPassword trong appsettings.Development.json
    [string]$AdminPassword = $env:SOE_ADMIN_PASSWORD
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backendDir = Join-Path $repoRoot 'apps\backend-v3'
$webDir = Join-Path $repoRoot 'apps\web'
$legacyDir = Join-Path $repoRoot 'apps\legacy-v1'
$logDir = Join-Path $repoRoot 'tools\scripts\.logs'
New-Item -ItemType Directory -Force $logDir | Out-Null

$steps = @()
if ($Only) {
    $steps = $Only
} else {
    $steps = @('backend', 'web')
    if (-not $SkipLegacy) { $steps += 'legacy' }
    if ($Smoke) { $steps += 'smoke' }
}

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

function Wait-Http {
    param([string]$Url, [int]$TimeoutSec = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Milliseconds 1000
    }
    return $false
}

function Start-DotnetApp {
    param([string]$ProjectDir, [string]$Dll, [string]$Url, [string]$LogName)
    $dllPath = Join-Path $ProjectDir "bin\Debug\net8.0\$Dll"
    if (-not (Test-Path $dllPath)) { throw "Chưa build: $dllPath" }
    $out = Join-Path $logDir "$LogName.out.log"
    $err = Join-Path $logDir "$LogName.err.log"
    # WorkingDirectory = thư mục project để app đọc đúng appsettings*.json
    return Start-Process -FilePath 'dotnet' -ArgumentList @("`"$dllPath`"", '--urls', $Url) `
        -WorkingDirectory $ProjectDir -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $out -RedirectStandardError $err
}

# ---------------------------------------------------------------------------
if ($steps -contains 'backend') {
    Invoke-Step 'backend-v3 (dotnet test)' $backendDir {
        Exec 'dotnet' @('test', 'SmartOpsEngine.sln', '--nologo', '-v', 'q')
    }
}

if ($steps -contains 'web') {
    Invoke-Step 'web (lint + build)' $webDir {
        if (-not (Test-Path 'node_modules')) {
            if (-not (Exec 'npm.cmd' @('ci'))) { return $false }
        }
        (Exec 'npm.cmd' @('run', 'lint')) -and (Exec 'npm.cmd' @('run', 'build'))
    }
}

if ($steps -contains 'legacy') {
    Invoke-Step 'legacy-v1 (mvnw test)' $legacyDir {
        Exec (Join-Path $legacyDir 'mvnw.cmd') @('-q', 'test')
    }
}

if ($steps -contains 'smoke') {
    Invoke-Step 'smoke M1 (Identity + Gateway)' $backendDir {
        if ($steps -notcontains 'backend') {
            if (-not (Exec 'dotnet' @('build', 'SmartOpsEngine.sln', '--nologo', '-v', 'q'))) { return $false }
        }

        $identityDir = Join-Path $backendDir 'src\Services\Identity\SOE.Identity.Api'
        $gatewayDir = Join-Path $backendDir 'src\Gateway\SOE.Gateway'

        if (-not $AdminPassword) {
            $devSettings = Get-Content (Join-Path $identityDir 'appsettings.Development.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            $AdminPassword = $devSettings.Identity.InitialAdminPassword
        }

        # Biến môi trường được tiến trình con kế thừa; khôi phục lại sau khi chạy xong
        $saved = @{
            ASPNETCORE_ENVIRONMENT      = $env:ASPNETCORE_ENVIRONMENT
            ConnectionStrings__Default  = $env:ConnectionStrings__Default
        }
        $env:ASPNETCORE_ENVIRONMENT = 'Development'
        if ($ConnectionString) { $env:ConnectionStrings__Default = $ConnectionString }

        $procs = @()
        try {
            $procs += Start-DotnetApp $identityDir 'SOE.Identity.Api.dll' 'http://localhost:5001' 'identity'
            if (-not (Wait-Http 'http://localhost:5001/health/ready')) {
                throw "Identity không sẵn sàng sau 90s — xem tools\scripts\.logs\identity.*.log"
            }
            $procs += Start-DotnetApp $gatewayDir 'SOE.Gateway.dll' 'http://localhost:8080' 'gateway'
            if (-not (Wait-Http 'http://localhost:8080/health/live')) {
                throw "Gateway không sẵn sàng sau 90s — xem tools\scripts\.logs\gateway.*.log"
            }
            & (Join-Path $PSScriptRoot 'smoke-m1.ps1') -BaseUrl 'http://localhost:8080' -IdentityUrl 'http://localhost:5001' -AdminPassword $AdminPassword
            $LASTEXITCODE -eq 0
        } finally {
            foreach ($p in $procs) {
                if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
            }
            foreach ($k in $saved.Keys) { Set-Item -Path "env:$k" -Value $saved[$k] -ErrorAction SilentlyContinue }
            if (-not $saved.ASPNETCORE_ENVIRONMENT) { Remove-Item env:ASPNETCORE_ENVIRONMENT -ErrorAction SilentlyContinue }
            if (-not $saved.ConnectionStrings__Default) { Remove-Item env:ConnectionStrings__Default -ErrorAction SilentlyContinue }
        }
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
