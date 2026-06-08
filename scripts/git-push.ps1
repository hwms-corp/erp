# erp-test(origin) / erp 원격으로 커밋 후 푸시합니다.
#
# 사용:
#   .\scripts\git-push.ps1                          # 둘 다 푸시 (변경 있으면 chore: update 커밋)
#   .\scripts\git-push.ps1 "feat: 기능 추가"         # 둘 다 푸시 + 커밋 메시지 지정
#   .\scripts\git-push.ps1 -Target test             # erp-test(origin)만
#   .\scripts\git-push.ps1 -Target erp              # erp만
#   .\scripts\git-push.ps1 -PushOnly                # 커밋 없이 푸시만
#
# npm:
#   npm run git:push
#   npm run git:push:test
#   npm run git:push:erp
#   npm run git:push:all -- "커밋 메시지"

param(
  [Parameter(Position = 0)]
  [string]$Message = 'chore: update',

  [ValidateSet('all', 'test', 'erp')]
  [string]$Target = 'all',

  [switch]$PushOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

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

Ensure-SafeDirectory -Path $repoRoot.Path

if (-not $PushOnly) {
  git add -A
  git diff --cached --quiet
  $hasStaged = $LASTEXITCODE
  if ($hasStaged -ne 0) {
    git commit -m $Message
  } else {
    Write-Host '커밋할 변경 없음 — 푸시만 진행합니다.' -ForegroundColor DarkYellow
  }
}

$branch = git branch --show-current
if (-not $branch) { throw '브랜치를 확인할 수 없습니다.' }

$remotes = @()
switch ($Target) {
  'test' { $remotes += @{ Name = 'origin'; Label = 'erp-test' } }
  'erp'  { $remotes += @{ Name = 'erp'; Label = 'erp' } }
  'all'  {
    $remotes += @{ Name = 'origin'; Label = 'erp-test' }
    $remotes += @{ Name = 'erp'; Label = 'erp' }
  }
}

foreach ($remote in $remotes) {
  Write-Host "Pushing $branch -> $($remote.Name) ($($remote.Label))..." -ForegroundColor Cyan
  git push $remote.Name $branch
  if ($LASTEXITCODE -ne 0) { throw "git push $($remote.Name) 실패" }
}

Write-Host '완료.' -ForegroundColor Green
