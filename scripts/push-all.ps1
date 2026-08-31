# erp-test + erp ? ? ?????. (??? 1??)
#
# ??:
#   .\scripts\push-all.ps1
#   .\scripts\push-all.ps1 "feat: ?? ??"
#   .\scripts\push-all.ps1 -PushOnly
#
# npm:
#   npm run git:push:all
#   npm run git:push:all -- "?? ???"

param(
  [Parameter(Position = 0)]
  [string]$Message = 'chore: update',

  [switch]$PushOnly
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_git-push-common.ps1"

Invoke-RepoCommit -Message $Message -PushOnly:$PushOnly
Invoke-RemotePush -RemoteName 'erp-test' -RemoteLabel 'erp-test'
Invoke-RemotePush -RemoteName 'erp' -RemoteLabel 'erp'

Write-Host 'erp-test + erp ?? ??.' -ForegroundColor Green
