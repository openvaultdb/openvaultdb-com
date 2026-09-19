param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("codex", "claude")]
    [string]$Harness,
    [switch]$ReplaceChanged
)

$ErrorActionPreference = "Stop"
$SourceUrl = "https://openvaultdb.com/agent-skills/openvaultdb/SKILL.md"
$ExpectedSha256 = "4deff8bc1f7a35818578c1f8d69b96326d774c111defb3789db7953397ccd3f8"
$TargetRoot = if ($Harness -eq "codex") {
    Join-Path $HOME ".codex\skills"
} else {
    Join-Path $HOME ".claude\skills"
}
$TargetDir = Join-Path $TargetRoot "openvaultdb"
$Target = Join-Path $TargetDir "SKILL.md"
$Downloaded = Join-Path ([IO.Path]::GetTempPath()) ("openvaultdb-skill." + [Guid]::NewGuid().ToString("N"))
$DestinationTemp = $null

function Fail([string]$Message) {
    throw "ovdb skill install: $Message"
}

function Assert-NoReparsePoint([string]$Path) {
    $Cursor = [IO.DirectoryInfo]::new($Path)
    while ($Cursor) {
        if ($Cursor.Exists -and ($Cursor.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            Fail "refusing reparse-point destination: $($Cursor.FullName)"
        }
        $Cursor = $Cursor.Parent
    }
}

try {
    Assert-NoReparsePoint $TargetDir
    Invoke-WebRequest -Uri $SourceUrl -OutFile $Downloaded
    $Actual = (Get-FileHash -Algorithm SHA256 -Path $Downloaded).Hash.ToLowerInvariant()
    if ($Actual -ne $ExpectedSha256) {
        Fail "SHA-256 checksum verification failed"
    }

    if (Test-Path -LiteralPath $Target -PathType Leaf) {
        $Existing = (Get-FileHash -Algorithm SHA256 -Path $Target).Hash.ToLowerInvariant()
        if ($Existing -eq $ExpectedSha256) {
            Write-Host "Official OpenVaultDB skill for $Harness is already up to date at $Target"
            Write-Host "Source: $SourceUrl"
            Write-Host "SHA-256: $ExpectedSha256"
            return
        }
        if (-not $ReplaceChanged) {
            Fail "existing SKILL.md differs from the official source; rerun with -ReplaceChanged to replace it"
        }
    }

    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    Assert-NoReparsePoint $TargetDir
    $DestinationTemp = Join-Path $TargetDir (".SKILL.md.install." + $PID)
    Copy-Item -LiteralPath $Downloaded -Destination $DestinationTemp
    Move-Item -LiteralPath $DestinationTemp -Destination $Target -Force
    $DestinationTemp = $null
    Write-Host "Installed official OpenVaultDB skill for $Harness at $Target"
    Write-Host "Source: $SourceUrl"
    Write-Host "SHA-256: $ExpectedSha256"
} finally {
    if ($DestinationTemp -and (Test-Path -LiteralPath $DestinationTemp)) {
        Remove-Item -LiteralPath $DestinationTemp -Force
    }
    if (Test-Path -LiteralPath $Downloaded) {
        Remove-Item -LiteralPath $Downloaded -Force
    }
}
