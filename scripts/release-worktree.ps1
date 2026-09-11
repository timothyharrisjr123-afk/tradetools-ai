<#
.SYNOPSIS
  Isolated selective-release worktree helper (A6 / FD-P1-07).
.DESCRIPTION
  Creates/verifies/removes a sibling git worktree so npm install cannot touch main node_modules/.next.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Create", "VerifyIsolation", "Remove")]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$Path,

  [string]$Branch = "",
  [string]$BaseSha = "",
  [string]$MainCheckoutPath = ""
)

$ErrorActionPreference = "Stop"

function Deny([string]$Reason) {
  [Console]::Error.WriteLine("RELEASE WORKTREE DENIED: $Reason")
  exit 1
}

function Normalize-Path([string]$PathValue) {
  return (Resolve-Path -LiteralPath $PathValue -ErrorAction Stop).Path.TrimEnd('\', '/').ToLowerInvariant()
}

if (-not $MainCheckoutPath) {
  $MainCheckoutPath = (& git rev-parse --show-toplevel 2>$null)
  if (-not $MainCheckoutPath) { Deny "run from the main git checkout" }
  $MainCheckoutPath = $MainCheckoutPath.Trim()
}

$mainNorm = (Resolve-Path -LiteralPath $MainCheckoutPath).Path.TrimEnd('\', '/').ToLowerInvariant()
$target = $Path

switch ($Action) {
  "Create" {
    if (-not $Branch) { Deny "Create requires -Branch" }
    if (-not $BaseSha) { Deny "Create requires -BaseSha" }
    if (Test-Path -LiteralPath $target) { Deny "path already exists: $target" }
    $parent = Split-Path -Parent $target
    if (-not (Test-Path -LiteralPath $parent)) {
      New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Push-Location -LiteralPath $MainCheckoutPath
    try {
      $prevEap = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      & git worktree add -b $Branch $target $BaseSha 2>&1 | ForEach-Object { Write-Output $_ }
      $code = $LASTEXITCODE
      $ErrorActionPreference = $prevEap
      if ($code -ne 0) { Deny "git worktree add failed" }
    } finally {
      Pop-Location
    }
    $wtNorm = Normalize-Path $target
    if ($wtNorm -eq $mainNorm) { Deny "worktree path resolved to main checkout" }
    Write-Output ("RELEASE WORKTREE CREATED path={0} branch={1} base={2}" -f $target, $Branch, $BaseSha)
    Write-Output "REMINDER: run npm ci ONLY inside this worktree; never in main checkout"
  }

  "VerifyIsolation" {
    if (-not (Test-Path -LiteralPath $target)) { Deny "worktree path missing: $target" }
    $wtNorm = Normalize-Path $target
    if ($wtNorm -eq $mainNorm) { Deny "path is the main checkout" }
    $wtGit = & git -C $target rev-parse --show-toplevel 2>$null
    if (-not $wtGit) { Deny "path is not a git worktree" }
    $wtGitNorm = Normalize-Path $wtGit.Trim()
    if ($wtGitNorm -ne $wtNorm) {
      Deny "git toplevel does not match requested path"
    }
    if ($wtGitNorm -eq $mainNorm) { Deny "worktree toplevel equals main" }
    # Ensure node_modules would not be shared via junction to main (basic check)
    $wtNm = Join-Path $target "node_modules"
    $mainNm = Join-Path $MainCheckoutPath "node_modules"
    if ((Test-Path -LiteralPath $wtNm) -and (Test-Path -LiteralPath $mainNm)) {
      $wtResolved = Normalize-Path $wtNm
      $mainResolved = Normalize-Path $mainNm
      if ($wtResolved -eq $mainResolved) {
        Deny "node_modules path collides with main checkout"
      }
    }
    Write-Output ("RELEASE WORKTREE ISOLATION PASS path={0}" -f $target)
  }

  "Remove" {
    if (-not (Test-Path -LiteralPath $target)) {
      Write-Output ("RELEASE WORKTREE ABSENT path={0}" -f $target)
      exit 0
    }
    $wtNorm = Normalize-Path $target
    if ($wtNorm -eq $mainNorm) { Deny "refusing to remove main checkout" }
    Push-Location -LiteralPath $MainCheckoutPath
    try {
      $prevEap = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      & git worktree remove --force $target 2>&1 | ForEach-Object { Write-Output $_ }
      $code = $LASTEXITCODE
      $ErrorActionPreference = $prevEap
      if ($code -ne 0) {
        & git worktree prune
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
      }
    } finally {
      Pop-Location
    }
    Write-Output ("RELEASE WORKTREE REMOVED path={0}" -f $target)
  }
}

exit 0
