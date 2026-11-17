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

Write-Host "Upload complete. Verify with: curl -I -H 'Origin: https://your-site.pages.dev' <R2 public URL>/thps.bin"
