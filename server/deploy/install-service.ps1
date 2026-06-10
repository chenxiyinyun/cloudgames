<#
.SYNOPSIS
  在 Windows 服务器上构建并把 WebSocket 服务器注册为开机自启、崩溃自拉起的计划任务。
  无外部依赖（不需要 pm2/nssm），用内置计划任务。

.PREREQS
  - 已安装 Node.js LTS（node -v 能用）。没有就先装：https://nodejs.org/zh-cn/download
  - 仓库已 clone / pull 到本机（本脚本在 server\deploy\ 下，自动定位仓库根）。

.USAGE  （在仓库内、以管理员身份打开 PowerShell）
    powershell -ExecutionPolicy Bypass -File .\server\deploy\install-service.ps1 -Port 8080
#>
[CmdletBinding()]
param(
  [int]$Port = 8080,
  [string]$TaskName = 'CloudGamesWS',
  [switch]$OpenFirewall
)

$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Write-Host "仓库根: $repo" -ForegroundColor Cyan

# 1) 前置检查（兼容 Windows PowerShell 5.1，不用 ?. 运算符）
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { throw '未找到 node。请先安装 Node.js LTS 再重试。' }
$node = $nodeCmd.Source
Write-Host "node: $node ($(node -v))"

# 2) 安装依赖 + 构建服务器 bundle
Push-Location $repo
try {
  if (Test-Path package-lock.json) { npm ci } else { npm install }
  npm run server:build
} finally { Pop-Location }

$bundle = Join-Path $repo 'server\dist\server.mjs'
if (-not (Test-Path $bundle)) { throw "构建失败，未找到 $bundle" }

# 3) 生成带端口的启动器（计划任务跑它）
$launch = Join-Path $repo 'server\dist\launch.cmd'
@"
@echo off
set PORT=$Port
set HOST=127.0.0.1
"$node" "$bundle"
"@ | Set-Content -Path $launch -Encoding ascii
Write-Host "启动器: $launch（PORT=$Port, 仅监听 127.0.0.1，建议前置 Caddy/nginx 做 wss）"

# 4) 注册计划任务：开机启动 + 崩溃自动重启
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
$action   = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\cmd.exe" -Argument "/c `"$launch`""
$trigger  = New-ScheduledTaskTrigger -AtStartup
$principal= New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
              -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "已注册并启动计划任务 '$TaskName'。" -ForegroundColor Green

# 5)（可选）直接放行端口。若用 Caddy/nginx 前置 wss，则 node 只听 127.0.0.1，无需放行此端口。
if ($OpenFirewall) {
  New-NetFirewallRule -DisplayName "CloudGamesWS $Port" -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Port -ErrorAction SilentlyContinue | Out-Null
  Write-Host "已放行入站 TCP $Port"
}

Write-Host "`n验证：浏览器打开 server\validate.html，地址填 ws://127.0.0.1:$Port（本机）或 wss://你的域名（经反代）。" -ForegroundColor Cyan
Write-Host "查看状态： Get-ScheduledTask $TaskName ；停止： Stop-ScheduledTask $TaskName ；卸载： Unregister-ScheduledTask $TaskName -Confirm:`$false"
