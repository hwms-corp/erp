# erp-test + erp ?‘˜ ?‹¤ ?‘¸?‹œ?•©?‹ˆ?‹¤. (ì»¤ë°‹??? 1?šŒë§?)
#
# ?‚¬?š©:
#   .\scripts\push-all.ps1
#   .\scripts\push-all.ps1 "feat: ê¸°ëŠ¥ ì¶”ê??"
#   .\scripts\push-all.ps1 -PushOnly
#
# npm:
#   npm run git:push:all
#   npm run git:push:all -- "ì»¤ë°‹ ë©”ì‹œì§?"

param(
  [Parameter(Position = 0)]
  [string]$Message = 'chore: update',

  [switch]$PushOnly
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_git-push-common.ps1"

Invoke-RepoCommit -Message $Message -PushOnly:$PushOnly
Invoke-RemotePush -RemoteName 'origin' -RemoteLabel 'erp-test'
Invoke-RemotePush -RemoteName 'erp' -RemoteLabel 'erp'

Write-Host 'erp-test + erp ?‘¸?‹œ ?™„ë£?.' -ForegroundColor Green
