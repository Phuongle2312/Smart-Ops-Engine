<#
.SYNOPSIS
    Smoke test M1 (Identity + Gateway) — tự động hóa apps/backend-v3/docs-m1-smoke-test.md.

.DESCRIPTION
    Gọi API thật đang chạy và đối chiếu kết quả với test case trong docs/04_test_cases/TC-01_identity.md
    và TC-09_gateway_config.md. Script KHÔNG tự khởi động service — dùng tools/scripts/test-all.ps1 -Smoke
    hoặc tự chạy Identity/Gateway trước.

    Tạo ra một tài khoản VIEWER tên "smoke<thời-gian>" và vô hiệu hóa nó ở cuối để không để lại
    tài khoản hoạt động trong CSDL.

.EXAMPLE
    .\tools\scripts\smoke-m1.ps1 -AdminPassword 'Admin@Test2026!'

.EXAMPLE
    # Kiểm tra trực tiếp Identity, bỏ qua Gateway
    .\tools\scripts\smoke-m1.ps1 -BaseUrl http://localhost:5001 -AdminPassword 'Admin@Test2026!'

.EXAMPLE
    # Thêm bài rate limit đăng nhập (gửi 6 request sai mật khẩu — tốn 1 phút cửa sổ rate limit)
    .\tools\scripts\smoke-m1.ps1 -AdminPassword 'Admin@Test2026!' -IncludeRateLimit
#>
[CmdletBinding()]
param(
    # Điểm vào API (mặc định đi qua Gateway)
    [string]$BaseUrl = 'http://localhost:8080',
    # Địa chỉ Identity để kiểm tra health và JWKS (không đi qua Gateway)
    [string]$IdentityUrl = 'http://localhost:5001',
    [string]$AdminUser = 'admin',
    # Mặc định lấy từ biến môi trường SOE_ADMIN_PASSWORD hoặc Identity__InitialAdminPassword
    [string]$AdminPassword = $(if ($env:SOE_ADMIN_PASSWORD) { $env:SOE_ADMIN_PASSWORD } else { $env:Identity__InitialAdminPassword }),
    [switch]$IncludeRateLimit
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

if (-not $AdminPassword) {
    Write-Host 'Thiếu mật khẩu admin: truyền -AdminPassword hoặc đặt biến môi trường SOE_ADMIN_PASSWORD.' -ForegroundColor Red
    exit 2
}

$BaseUrl = $BaseUrl.TrimEnd('/')
$IdentityUrl = $IdentityUrl.TrimEnd('/')
$script:Results = New-Object System.Collections.Generic.List[object]

# ---------------------------------------------------------------------------
# Hạ tầng gọi HTTP: dùng HttpClient để đọc được mọi mã trạng thái (Invoke-WebRequest
# của PowerShell 5.1 ném lỗi với 4xx/5xx) và tự quản cookie refresh token.
# ---------------------------------------------------------------------------
function New-SoeClient {
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.CookieContainer = New-Object System.Net.CookieContainer
    $handler.UseCookies = $true
    $handler.AllowAutoRedirect = $false
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(15)
    return @{ Client = $client; Cookies = $handler.CookieContainer }
}

function Invoke-Soe {
    param(
        [hashtable]$Session,
        [string]$Method,
        [string]$Url,
        [object]$Body,
        [string]$Token
    )
    $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($Method), $Url)
    if ($Token) {
        $request.Headers.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $Token)
    }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 10 -Compress
        $request.Content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, 'application/json')
    }
    $response = $Session.Client.SendAsync($request).GetAwaiter().GetResult()
    $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    $headers = @{}
    foreach ($h in $response.Headers) { $headers[$h.Key] = ($h.Value -join ', ') }
    foreach ($h in $response.Content.Headers) { $headers[$h.Key] = ($h.Value -join ', ') }

    $data = $null
    if ($text -and $text.TrimStart().StartsWith('{')) {
        try { $data = $text | ConvertFrom-Json } catch { $data = $null }
    }
    return [pscustomobject]@{ Status = [int]$response.StatusCode; Headers = $headers; Data = $data; Text = $text }
}

function Test-Case {
    param([string]$Id, [string]$Name, [scriptblock]$Check)
    try {
        $detail = & $Check
        $script:Results.Add([pscustomobject]@{ Id = $Id; Name = $Name; Ok = $true; Detail = "$detail" })
        Write-Host ("  [PASS] {0,-22} {1}" -f $Id, $Name) -ForegroundColor Green
    } catch {
        $script:Results.Add([pscustomobject]@{ Id = $Id; Name = $Name; Ok = $false; Detail = $_.Exception.Message })
        Write-Host ("  [FAIL] {0,-22} {1}" -f $Id, $Name) -ForegroundColor Red
        Write-Host ("         -> {0}" -f $_.Exception.Message) -ForegroundColor DarkRed
    }
}

function Assert-Status {
    param($Response, [int]$Expected)
    if ($Response.Status -ne $Expected) {
        $snippet = $Response.Text
        if ($snippet -and $snippet.Length -gt 200) { $snippet = $snippet.Substring(0, 200) }
        throw "mong đợi HTTP $Expected nhưng nhận $($Response.Status). Body: $snippet"
    }
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

# ---------------------------------------------------------------------------
Write-Host ''
Write-Host "Smoke test M1 — API: $BaseUrl | Identity: $IdentityUrl" -ForegroundColor Cyan
Write-Host ''

$s = New-SoeClient
$admin = $null
$viewer = $null
$viewerId = $null
$viewerName = 'smoke' + (Get-Date -Format 'MMddHHmmss')

Test-Case 'HEALTH-LIVE' 'Identity /health/live trả 200' {
    Assert-Status (Invoke-Soe $s GET "$IdentityUrl/health/live") 200
}

Test-Case 'HEALTH-READY' 'Identity /health/ready trả 200 (kết nối được CSDL)' {
    Assert-Status (Invoke-Soe $s GET "$IdentityUrl/health/ready") 200
}

Test-Case 'TC-IDN-API-018' 'JWKS có đúng 1 khóa RS256, không lộ private key' {
    $r = Invoke-Soe $s GET "$IdentityUrl/.well-known/jwks.json"
    Assert-Status $r 200
    $keys = @($r.Data.keys)
    Assert-True ($keys.Count -eq 1) "số khóa = $($keys.Count)"
    Assert-True ($keys[0].alg -eq 'RS256') "alg = $($keys[0].alg)"
    Assert-True ([bool]$keys[0].kid) 'thiếu kid'
    foreach ($p in 'd', 'p', 'q', 'dp', 'dq', 'qi') {
        Assert-True (-not ($keys[0].PSObject.Properties.Name -contains $p)) "lộ tham số private '$p'"
    }
}

Test-Case 'TC-IDN-API-001' 'Đăng nhập admin: 200, token, cookie soe_rt, header bảo mật' {
    $r = Invoke-Soe $s POST "$BaseUrl/api/v1/auth/login" @{ username = $AdminUser; password = $AdminPassword }
    Assert-Status $r 200
    Assert-True ([bool]$r.Data.accessToken) 'thiếu accessToken'
    Assert-True ($r.Data.expiresIn -eq 900) "expiresIn = $($r.Data.expiresIn)"
    Assert-True ($r.Data.user.role -eq 'ADMIN') "role = $($r.Data.user.role)"
    $cookie = $s.Cookies.GetCookies([Uri]"$BaseUrl/api/v1/auth")['soe_rt']
    Assert-True ($null -ne $cookie -and $cookie.HttpOnly) 'thiếu cookie soe_rt HttpOnly'
    Assert-True ($r.Headers['X-Content-Type-Options'] -eq 'nosniff') 'thiếu X-Content-Type-Options'
    Assert-True ($r.Headers['X-Frame-Options'] -eq 'DENY') 'thiếu X-Frame-Options: DENY'
    Assert-True ([bool]$r.Headers['X-Correlation-Id']) 'thiếu X-Correlation-Id'
    $script:admin = $r.Data.accessToken
}

# Dùng tài khoản không tồn tại để không cộng dồn bộ đếm khóa tài khoản của admin
Test-Case 'TC-IDN-API-002' 'Sai thông tin đăng nhập trả 401 dạng ProblemDetails' {
    $other = New-SoeClient
    $r = Invoke-Soe $other POST "$BaseUrl/api/v1/auth/login" @{ username = 'khong_ton_tai_' + $viewerName; password = 'SaiMatKhau123!' }
    Assert-Status $r 401
    Assert-True ([bool]$r.Data.code) 'body không có trường code'
}

Test-Case 'TC-IDN-API-017' 'GET /me có token trả 200 kèm permissions' {
    $r = Invoke-Soe $s GET "$BaseUrl/api/v1/me" -Token $admin
    Assert-Status $r 200
    Assert-True (@($r.Data.permissions).Count -gt 0) 'permissions rỗng'
}

Test-Case 'TC-GW-SEC-001' 'GET /me không token trả 401' {
    Assert-Status (Invoke-Soe $s GET "$BaseUrl/api/v1/me") 401
}

Test-Case 'TC-GW-SEC-002' 'Token sửa chữ ký trả 401' {
    Assert-True ([bool]$admin) 'bỏ qua vì chưa đăng nhập được admin'
    $last = $admin.Substring($admin.Length - 1)
    $swap = if ($last -eq 'A') { 'B' } else { 'A' }
    Assert-Status (Invoke-Soe $s GET "$BaseUrl/api/v1/me" -Token ($admin.Substring(0, $admin.Length - 1) + $swap)) 401
}

Test-Case 'TC-GW-SEC-003' 'Token alg=none trả 401' {
    Assert-Status (Invoke-Soe $s GET "$BaseUrl/api/v1/me" -Token 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.') 401
}

Test-Case 'TC-IDN-API-025' "Admin tạo người dùng VIEWER '$viewerName' trả 201" {
    $body = @{ username = $viewerName; fullName = 'Tai Khoan Smoke Test'; email = "$viewerName@example.com"; role = 'VIEWER' }
    $r = Invoke-Soe $s POST "$BaseUrl/api/v1/users" $body -Token $admin
    Assert-Status $r 201
    Assert-True ([bool]$r.Data.temporaryPassword) 'thiếu temporaryPassword'
    $script:viewerId = $r.Data.user.id
    $script:viewerPassword = $r.Data.temporaryPassword
}

Test-Case 'TC-IDN-API-026' 'Tạo trùng username trả 409 (SOE-IDN-409)' {
    $body = @{ username = $viewerName; fullName = 'Trung Lap'; email = "dup-$viewerName@example.com"; role = 'VIEWER' }
    $r = Invoke-Soe $s POST "$BaseUrl/api/v1/users" $body -Token $admin
    Assert-Status $r 409
    Assert-True ($r.Data.code -eq 'SOE-IDN-409') "code = $($r.Data.code)"
}

Test-Case 'TC-IDN-API-036' 'VIEWER gọi GET /users bị chặn 403' {
    Assert-True ([bool]$viewerPassword) 'bỏ qua vì chưa tạo được VIEWER'
    $v = New-SoeClient
    $login = Invoke-Soe $v POST "$BaseUrl/api/v1/auth/login" @{ username = $viewerName; password = $viewerPassword }
    Assert-Status $login 200
    $script:viewer = $login.Data.accessToken
    Assert-Status (Invoke-Soe $v GET "$BaseUrl/api/v1/users" -Token $viewer) 403
}

Test-Case 'TC-IDN-API-011' 'Refresh token xoay vòng: 200 và cookie soe_rt đổi giá trị' {
    $uri = [Uri]"$BaseUrl/api/v1/auth"
    $before = $s.Cookies.GetCookies($uri)['soe_rt'].Value
    $r = Invoke-Soe $s POST "$BaseUrl/api/v1/auth/refresh"
    Assert-Status $r 200
    $after = $s.Cookies.GetCookies($uri)['soe_rt'].Value
    Assert-True ($before -ne $after) 'cookie soe_rt không đổi'
    $script:admin = $r.Data.accessToken
}

Test-Case 'ADMIN-GET-USERS' 'ADMIN gọi GET /users trả 200' {
    Assert-Status (Invoke-Soe $s GET "$BaseUrl/api/v1/users" -Token $admin) 200
}

if ($IncludeRateLimit) {
    Test-Case 'TC-IDN-API-008' 'Request đăng nhập thứ 6 trong 1 phút trả 429 + Retry-After' {
        $rl = New-SoeClient
        $last = $null
        for ($i = 1; $i -le 6; $i++) {
            $last = Invoke-Soe $rl POST "$BaseUrl/api/v1/auth/login" @{ username = 'ratelimit_' + $viewerName; password = 'SaiMatKhau123!' }
        }
        Assert-Status $last 429
        Assert-True ([bool]$last.Headers['Retry-After']) 'thiếu header Retry-After'
    }
}

# Dọn dẹp: vô hiệu hóa tài khoản smoke test
if ($viewerId -and $admin) {
    $r = Invoke-Soe $s PUT "$BaseUrl/api/v1/users/$viewerId/status" @{ isActive = $false } -Token $admin
    if ($r.Status -ne 200) { Write-Host "  (cảnh báo) không vô hiệu hóa được '$viewerName': HTTP $($r.Status)" -ForegroundColor Yellow }
}

Invoke-Soe $s POST "$BaseUrl/api/v1/auth/logout" | Out-Null

# ---------------------------------------------------------------------------
$failed = @($Results | Where-Object { -not $_.Ok })
Write-Host ''
Write-Host ("Kết quả smoke test: {0}/{1} đạt" -f ($Results.Count - $failed.Count), $Results.Count) -ForegroundColor $(if ($failed.Count -eq 0) { 'Green' } else { 'Red' })
if ($failed.Count -gt 0) { exit 1 }
exit 0
