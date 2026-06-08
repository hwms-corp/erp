# erp ????ž¥?†Œ(erp, hwms-corp/erp)ë¡? ì»¤ë°‹ ?›„ ?‘¸?‹œ?•©?‹ˆ?‹¤.
#
# ?‚¬?š©:
#   .\scripts\push-erp.ps1
#   .\scripts\push-erp.ps1 "feat: ê¸°ëŠ¥ ì¶”ê??"
#   .\scripts\push-erp.ps1 -PushOnly
#
# npm:
#   npm run git:push:erp
#   npm run git:push:erp -- "ì»¤ë°‹ ë©”ì‹œì§?"

param(
  [Parameter(Position = 0)]
  [string]$Message = 'chore: update',

  [switch]$PushOnly
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_git-push-common.ps1"

Invoke-RepoCommit -Message $Message -PushOnly:$PushOnly
Invoke-RemotePush -RemoteName 'erp' -RemoteLabel 'erp'

Write-Host 'erp ?‘¸?‹œ ?™„ë£?.' -ForegroundColor Green
