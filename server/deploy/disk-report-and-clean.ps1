<#
.SYNOPSIS
  C 盘空间体检 + 仅清理"绝对安全"的垃圾，其余只报告不删。

.DESCRIPTION
  设计原则：默认先报告、只自动清理公认安全的临时文件，绝不碰用户数据 / Program Files /
  无法归类的大文件。更激进的回收（Windows Update 缓存、组件清理）以"建议命令"打印出来，
  由你看过再手动执行。

  用法（在服务器 RDP 里以管理员打开 PowerShell）：
    # 只体检，不删任何东西：
    powershell -ExecutionPolicy Bypass -File .\disk-report-and-clean.ps1 -ReportOnly
    # 体检 + 清理安全临时文件：
    powershell -ExecutionPolicy Bypass -File .\disk-report-and-clean.ps1
#>
[CmdletBinding()]
param(
  [switch]$ReportOnly
)

function Format-GB($bytes) { '{0:N2} GB' -f ($bytes / 1GB) }

Write-Host "==== C 盘体检 ====" -ForegroundColor Cyan
$c = Get-PSDrive C
Write-Host ("C: 已用 {0} / 总 {1}（剩余 {2}）" -f (Format-GB $c.Used), (Format-GB ($c.Used + $c.Free)), (Format-GB $c.Free))

Write-Host "`n---- C:\ 一级目录占用（最大 15 个）----" -ForegroundColor Cyan
Get-ChildItem C:\ -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
  $size = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
           Measure-Object Length -Sum).Sum
  [PSCustomObject]@{ Path = $_.FullName; Bytes = [int64]$size }
} | Sort-Object Bytes -Descending | Select-Object -First 15 |
  Format-Table Path, @{N='Size';E={Format-GB $_.Bytes}} -AutoSize

Write-Host "---- 已知占用大户 ----" -ForegroundColor Cyan
$probe = @(
  'C:\Windows\SoftwareDistribution\Download',   # Windows Update 下载缓存（可清）
  'C:\Windows\Temp',
  "$env:TEMP",
  'C:\Windows\WinSxS',                            # 组件存储（勿手删，用 DISM）
  'C:\Windows\Logs',
  'C:\inetpub\logs',                              # IIS 日志（若用 IIS）
  'C:\Users'
)
foreach ($p in $probe) {
  if (Test-Path $p) {
    $s = (Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    Write-Host ("  {0,-45} {1}" -f $p, (Format-GB ([int64]$s)))
  }
}

Write-Host "`n---- C 盘最大的 20 个文件 ----" -ForegroundColor Cyan
Get-ChildItem C:\ -Recurse -File -Force -ErrorAction SilentlyContinue |
  Sort-Object Length -Descending | Select-Object -First 20 |
  Format-Table @{N='Size';E={Format-GB $_.Length}}, FullName -AutoSize

if ($ReportOnly) {
  Write-Host "`n[ReportOnly] 未删除任何文件。" -ForegroundColor Yellow
}
else {
  Write-Host "`n==== 清理安全临时文件 ====" -ForegroundColor Green
  $before = (Get-PSDrive C).Free
  $targets = @("$env:TEMP", 'C:\Windows\Temp')
  foreach ($t in $targets) {
    if (Test-Path $t) {
      # 只删 1 天前的临时文件，避免动到正在使用的临时文件
      Get-ChildItem $t -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
      Write-Host "  已清理 $t（1 天前的临时文件）"
    }
  }
  # 清空回收站
  try { Clear-RecycleBin -Force -ErrorAction Stop; Write-Host "  已清空回收站" } catch { Write-Host "  回收站已空或无法清理" }
  # npm 缓存（若装了 node）
  if (Get-Command npm -ErrorAction SilentlyContinue) {
    npm cache clean --force 2>$null; Write-Host "  已清理 npm 缓存"
  }
  $after = (Get-PSDrive C).Free
  Write-Host ("`n安全清理释放约 {0}（剩余 {1}）" -f (Format-GB ($after - $before)), (Format-GB $after)) -ForegroundColor Green
}

Write-Host "`n==== 需你确认后再手动执行的回收（更激进，但通常很安全）====" -ForegroundColor Yellow
Write-Host @'
  # 1) 清理 WinSxS 组件存储（不要手删该目录！用 DISM）：
  Dism /Online /Cleanup-Image /StartComponentCleanup

  # 2) 清理 Windows Update 下载缓存：
  Stop-Service wuauserv -Force
  Remove-Item C:\Windows\SoftwareDistribution\Download\* -Recurse -Force -ErrorAction SilentlyContinue
  Start-Service wuauserv

  # 3) 磁盘清理向导（含系统文件，勾选后执行）：
  cleanmgr /lowdisk

  # 4) 若装过旧 Node/构建产物，找大目录后按需删除（先看上面的"最大文件/目录"清单）
'@
