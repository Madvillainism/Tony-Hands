# Upload the game files to a public Cloudflare R2 bucket.
#
# Credentials are read from environment variables (or scripts/deploy.env, which
# is git-ignored). Nothing is printed. The 630 MB disc image uses the S3 API
# because Wrangler's `r2 object put` caps uploads at 315 MB.
#
# Required env vars:
#   R2_ACCOUNT_ID      Cloudflare account ID
#   R2_ACCESS_KEY_ID   R2 S3 token access key
#   R2_SECRET_ACCESS_KEY  R2 S3 token secret key
#   R2_BUCKET          bucket name (default: tony-hands-games)
#
# Usage (from the repo root):
#   powershell -File scripts/upload-assets.ps1

$ErrorActionPreference = "Stop"

# Load scripts/deploy.env if present, without ever echoing values.
$envFile = Join-Path $PSScriptRoot "deploy.env"
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$' -and -not (Test-Path "env:$($matches[1])")) {
      Set-Item -Path "env:$($matches[1])" -Value $matches[2]
    }
  }
}

$account = $env:R2_ACCOUNT_ID
$key = $env:R2_ACCESS_KEY_ID
$secret = $env:R2_SECRET_ACCESS_KEY
$bucket = if ($env:R2_BUCKET) { $env:R2_BUCKET } else { "tony-hands-games" }

foreach ($item in @(
    @{ Name = "R2_ACCOUNT_ID"; Value = $account },
    @{ Name = "R2_ACCESS_KEY_ID"; Value = $key },
    @{ Name = "R2_SECRET_ACCESS_KEY"; Value = $secret }
  )) {
  if (-not $item.Value) {
    Write-Error "Missing required credential: $($item.Name). Set it in the environment or scripts/deploy.env."
    exit 1
  }
}

$env:AWS_ACCESS_KEY_ID = $key
$env:AWS_SECRET_ACCESS_KEY = $secret
$endpoint = "https://$account.r2.cloudflarestorage.com"

$rom = Join-Path $PSScriptRoot "..\web\games\thps.bin"
$bios = Join-Path $PSScriptRoot "..\web\games\scph5501.bin"

foreach ($file in @($rom, $bios)) {
  if (-not (Test-Path $file)) {
    Write-Error "Game file not found: $file"
    exit 1
  }
}

# --- Guardrails: keep the bucket inside the free tier -------------------
$expected = @("thps.bin", "scph5501.bin")

$versioning = aws s3api get-bucket-versioning --bucket $bucket --endpoint-url $endpoint --output json 2>$null | ConvertFrom-Json
if ($versioning.Status -eq "Enabled") {
  Write-Error "Bucket versioning is enabled: old versions would keep consuming storage. Disable it before uploading."
  exit 1
}

$existingRaw = aws s3api list-objects-v2 --bucket $bucket --endpoint-url $endpoint --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $existingRaw) {
  $existing = ($existingRaw | ConvertFrom-Json).Contents | ForEach-Object { $_.Key }
  $extra = @($existing | Where-Object { $_ -notin $expected })
  if ($extra.Count -gt 0) {
    Write-Warning "Unexpected keys already in bucket: $($extra -join ', ')"
    $answer = Read-Host "Upload anyway? These may add storage costs [y/N]"
    if ($answer -notmatch '^[Yy]$') { Write-Error "Aborted by user."; exit 1 }
  }
}

Write-Host "Uploading thps.bin and scph5501.bin to R2 bucket '$bucket'..."

aws s3 cp $rom "s3://$bucket/thps.bin" `
  --endpoint-url $endpoint `
  --cache-control "public, max-age=31536000, immutable" `
  --content-type "application/octet-stream" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to upload thps.bin"; exit 1 }

aws s3 cp $bios "s3://$bucket/scph5501.bin" `
  --endpoint-url $endpoint `
  --cache-control "public, max-age=31536000, immutable" `
  --content-type "application/octet-stream" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to upload scph5501.bin"; exit 1 }

foreach ($key in $expected) {
  $head = aws s3api head-object --bucket $bucket --key $key --endpoint-url $endpoint --output json 2>$null | ConvertFrom-Json
  $class = if ($head.StorageClass) { $head.StorageClass } else { "STANDARD" }
  if ($class -ne "STANDARD") {
    Write-Warning "$key has storage class '$class'. Only STANDARD has a free tier - check the bucket settings."
  }
}

Write-Host "Upload complete. Verify with curl -I against the public URL for thps.bin"
