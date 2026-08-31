# erp-test remote(erp-test, hwms-corp/erp-test)? ?? ? ?????.
#
# ??:
#   .\scripts\push-erp-test.ps1
#   .\scripts\push-erp-test.ps1 "feat: ?? ??"
#   .\scripts\push-erp-test.ps1 -PushOnly
#
# npm:
#   npm run git:push:test
#   npm run git:push:test -- "?? ???"

param(
  [Parameter(Position = 0)]
  [string]$Message = 'chore: update',

  [switch]$PushOnly
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_git-push-common.ps1"

Invoke-RepoCommit -Message $Message -PushOnly:$PushOnly
Invoke-RemotePush -RemoteName 'erp-test' -RemoteLabel 'erp-test'

Write-Host 'erp-test ?? ??.' -ForegroundColor Green
