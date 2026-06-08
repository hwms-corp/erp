# erp-test ????ž¥?†Œ(origin, hwms-corp/erp-test)ë¡? ì»¤ë°‹ ?›„ ?‘¸?‹œ?•©?‹ˆ?‹¤.
#
# ?‚¬?š©:
#   .\scripts\push-erp-test.ps1
#   .\scripts\push-erp-test.ps1 "feat: ê¸°ëŠ¥ ì¶”ê??"
#   .\scripts\push-erp-test.ps1 -PushOnly
#
# npm:
#   npm run git:push:test
#   npm run git:push:test -- "ì»¤ë°‹ ë©”ì‹œì§?"

param(
  [Parameter(Position = 0)]
  [string]$Message = 'chore: update',

  [switch]$PushOnly
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_git-push-common.ps1"

Invoke-RepoCommit -Message $Message -PushOnly:$PushOnly
Invoke-RemotePush -RemoteName 'origin' -RemoteLabel 'erp-test'

Write-Host 'erp-test ?‘¸?‹œ ?™„ë£?.' -ForegroundColor Green
