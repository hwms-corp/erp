$script:RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

function Ensure-SafeDirectory {
  param([string]$Path)
  $want = [System.IO.Path]::GetFullPath($Path)
  foreach ($line in @(git config --global --get-all safe.directory 2>$null)) {
    if (-not $line) { continue }
    try {
      if ([System.IO.Path]::GetFullPath($line.Trim()) -ieq $want) { return }
    } catch { }
  }
  git config --global --add safe.directory $Path
}

function Invoke-RepoCommit {
  param(
    [string]$Message = 'chore: update',
    [switch]$PushOnly
  )

  Set-Location $script:RepoRoot
  Ensure-SafeDirectory -Path $script:RepoRoot.Path

  if ($PushOnly) { return }

  git add -A
  git diff --cached --quiet
  $hasStaged = $LASTEXITCODE
  if ($hasStaged -ne 0) {
    git commit -m $Message
  } else {
    Write-Host 'ì»¤ë°‹?•  ë³?ê²? ?—†?Œ ??? ?‘¸?‹œë§? ì§„í–‰?•©?‹ˆ?‹¤.' -ForegroundColor DarkYellow
  }
}

function Invoke-RemotePush {
  param(
    [string]$RemoteName,
    [string]$RemoteLabel
  )

  $branch = git branch --show-current
  if (-not $branch) { throw 'ë¸Œëžœì¹˜ë?? ?™•?¸?•  ?ˆ˜ ?—†?Šµ?‹ˆ?‹¤.' }

  Write-Host "Pushing $branch -> $RemoteName ($RemoteLabel)..." -ForegroundColor Cyan
  git push $RemoteName $branch
  if ($LASTEXITCODE -ne 0) { throw "git push $RemoteName ?‹¤?Œ¨" }
}
