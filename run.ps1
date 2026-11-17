param(
    [switch]$NoRetroArch,
    [switch]$NoPreview,
    [int]$StateSlot = 2,
    [string]$RetroArch = "",
    [string]$Core = "",
    [string]$Rom = "",
    [string]$Config = ""
)

$configPath = if ($Config) { $Config } else { Join-Path $PSScriptRoot "config.toml" }

# Fall back to the [retroarch] section of config.toml for anything not
# explicitly passed on the command line.
if ((-not $RetroArch -or -not $Core -or -not $Rom) -and (Test-Path $configPath)) {
    try {
        $json = python -c "import sys,tomllib,json; print(json.dumps(tomllib.load(open(sys.argv[1], 'rb')).get('retroarch', {})))" $configPath
        $raConfig = $json | ConvertFrom-Json
        if (-not $RetroArch) { $RetroArch = $raConfig.path }
        if (-not $Core) { $Core = $raConfig.core }
        if (-not $Rom) { $Rom = $raConfig.rom }
    } catch {
        Write-Warning "Could not read [retroarch] from $configPath; using defaults."
    }
}

$raProcess = $null

if (-not $NoRetroArch) {
    foreach ($check in @(
        @{ Path = $RetroArch; Label = "RetroArch" },
        @{ Path = $Core; Label = "Core" },
        @{ Path = $Rom; Label = "ROM" }
    )) {
        if (-not $check.Path) {
            Write-Error "$($check.Label) path is empty. Set [retroarch] in config.toml or pass -RetroArch/-Core/-Rom."
            exit 1
        }
        if (-not (Test-Path $check.Path)) {
            Write-Error "$($check.Label) not found: $($check.Path)"
            Write-Host "Pass the correct paths, e.g.:"
            Write-Host "  .\run.ps1 -RetroArch 'D:\RetroArch\retroarch.exe' -Core 'D:\RetroArch\cores\mednafen_psx_libretro.dll' -Rom 'D:\Games\THPS.cue'"
            exit 1
        }
    }

    Write-Host "Launching RetroArch with Tony Hawk's Pro Skater (state slot $StateSlot)..."
    $raArgs = @(
        "-L", "`"$Core`"",
        "-e", "$StateSlot",
        "`"$Rom`""
    )
    $raProcess = Start-Process -FilePath $RetroArch -ArgumentList $raArgs -PassThru
    Start-Sleep -Seconds 4
    Write-Host "RetroArch launched (state slot $StateSlot loaded). Switch to the window and position your hands."
}

Write-Host "Starting Tony Hands vision pipeline..."
$pyArgs = @()
if ($NoPreview) {
    $pyArgs += "--no-preview"
}
if ($Config) {
    $pyArgs += @("--config", $Config)
}

try {
    python -m src.main @pyArgs
} finally {
    if ($raProcess -and -not $raProcess.HasExited) {
        Write-Host "Stopping RetroArch (PID $($raProcess.Id))..."
        Stop-Process -Id $raProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
