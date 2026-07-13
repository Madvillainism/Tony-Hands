param(
    [switch]$NoRetroArch,
    [switch]$NoPreview,
    [int]$StateSlot = 2
)

$RetroArch = "C:\RetroArch-Win64\retroarch.exe"
$Core = "C:\RetroArch-Win64\cores\mednafen_psx_libretro.dll"
$Rom = "C:\RetroArch-Win64\downloads\Tony Hawk's Pro Skater (USA).cue"

if (-not $NoRetroArch) {
    Write-Host "Launching RetroArch with Tony Hawk's Pro Skater (state slot $StateSlot)..."
    $raArgs = @(
        "-L", "`"$Core`"",
        "-e", "$StateSlot",
        "`"$Rom`""
    )
    Start-Process -FilePath $RetroArch -ArgumentList $raArgs
    Start-Sleep -Seconds 4
    Write-Host "RetroArch launched (state slot $StateSlot loaded). Switch to the window and position your hands."
}

Write-Host "Starting Tony Hands vision pipeline..."
$pyArgs = @()
if ($NoPreview) {
    $pyArgs += "--no-preview"
}

try {
    python -m src.main $pyArgs
} finally {
    Write-Host "Stopping RetroArch..."
    Get-Process -Name "retroarch" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
