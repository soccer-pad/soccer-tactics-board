param(
    [string]$Root = "$PSScriptRoot\soccer-tactics-board",
    [int]$Port = 5959
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "폰/패드에서 접속하려면 같은 Wi-Fi 안에서 이 PC로 접속을 허용해야 하는데," -ForegroundColor Yellow
    Write-Host "Windows 권한 때문에 한 번만 관리자 권한으로 아래 명령을 실행해야 합니다:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  netsh http add urlacl url=http://+:$Port/ user=Everyone" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "PowerShell을 '관리자 권한으로 실행'한 뒤 위 명령을 한 번 실행하고, 이 스크립트를 다시 실행해주세요." -ForegroundColor Yellow
    exit 1
}

$ipList = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -ExpandProperty IPAddress)

Write-Host "Serving $Root"
Write-Host "  이 컴퓨터: http://localhost:$Port/"
foreach ($ip in $ipList) {
    Write-Host "  같은 Wi-Fi의 폰/패드: http://${ip}:$Port/" -ForegroundColor Green
}
Write-Host ""
Write-Host "(처음 실행 시 Windows 방화벽이 '접근 허용' 여부를 물어보면 '개인 네트워크'에 허용해주세요)" -ForegroundColor Yellow

$mime = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $Root ($path.TrimStart("/"))

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath)
        $contentType = $mime[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.OutputStream.Write($notFound, 0, $notFound.Length)
    }
    $response.OutputStream.Close()
}
