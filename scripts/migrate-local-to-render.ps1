param(
  [string]$BaseUrl = $env:ESOKO_RENDER_URL,
  [string]$Email = $env:ESOKO_ADMIN_EMAIL,
  [string]$Password = $env:ESOKO_ADMIN_PASSWORD,
  [string]$DatabasePath = "data/esoko.db",
  [string]$UploadsPath = "uploads"
)

if (-not $BaseUrl) { $BaseUrl = "https://esoko-bz-1.onrender.com" }
$BaseUrl = $BaseUrl.TrimEnd("/")

if (-not $Email -or -not $Password) {
  throw "Set ESOKO_ADMIN_EMAIL and ESOKO_ADMIN_PASSWORD before running this migration."
}

if (-not (Test-Path -LiteralPath $DatabasePath)) {
  throw "Database file not found: $DatabasePath"
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{
  email = $Email
  password = $Password
} | ConvertTo-Json

Write-Host "Logging in to $BaseUrl ..."
$login = Invoke-RestMethod `
  -Uri "$BaseUrl/api/auth/login" `
  -Method Post `
  -Body $loginBody `
  -ContentType "application/json" `
  -WebSession $session

if (-not $login.success) {
  throw "Login failed. Check ESOKO_ADMIN_EMAIL and ESOKO_ADMIN_PASSWORD."
}

if (Test-Path -LiteralPath $UploadsPath) {
  $files = Get-ChildItem -LiteralPath $UploadsPath -File
  foreach ($file in $files) {
    Write-Host "Uploading media $($file.Name) ..."
    $uploadBody = @{
      fileName = $file.Name
      contentBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($file.FullName))
    } | ConvertTo-Json -Depth 3

    Invoke-RestMethod `
      -Uri "$BaseUrl/api/admin/restore-upload" `
      -Method Post `
      -Body $uploadBody `
      -ContentType "application/json" `
      -WebSession $session | Out-Null
  }
}

Write-Host "Uploading database backup ..."
$dbBody = @{
  backupBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $DatabasePath)))
} | ConvertTo-Json -Depth 3

Invoke-RestMethod `
  -Uri "$BaseUrl/api/admin/restore-db" `
  -Method Post `
  -Body $dbBody `
  -ContentType "application/json" `
  -WebSession $session | Out-Null

Write-Host "Migration uploaded. Restart or redeploy the Render service so SQLite opens the restored database."
