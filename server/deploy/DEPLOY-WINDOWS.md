# Windows 服务器部署（WebSocket 联机服务器）

目标机器是 Windows，所以不用 Linux/nginx 那套。下面是最省事的路径，全部在 RDP 里以
**管理员** PowerShell 执行。客户端仍在 GitHub Pages，只是连到这台服务器的 `wss://`。

> ⚠️ 部署完记得**改掉服务器管理员密码**（之前在聊天里发过明文）。

## 0. 前置：装 Node.js

```powershell
node -v   # 没有输出就去 https://nodejs.org/zh-cn/download 装 LTS，装完重开 PowerShell
```

## 1. 拉代码

```powershell
cd C:\   # 或你想放的位置
git clone <你的仓库地址> cloudgames
cd cloudgames
# 以后更新： git pull
```

## 2. 构建 + 注册为开机自启服务（崩溃自动重启）

```powershell
powershell -ExecutionPolicy Bypass -File .\server\deploy\install-service.ps1 -Port 8080
```

这会：`npm ci` → `npm run server:build` → 写一个带端口的启动器 → 注册名为
`CloudGamesWS` 的计划任务（开机启动、崩溃 1 分钟内最多重启 3 次），并立即启动。
默认 node **只监听 `127.0.0.1:8080`**，对外由下一步的反代加 TLS。

常用管理：
```powershell
Get-ScheduledTask CloudGamesWS         # 看状态
Stop-ScheduledTask CloudGamesWS        # 停
Start-ScheduledTask CloudGamesWS       # 起
Unregister-ScheduledTask CloudGamesWS -Confirm:$false  # 卸载
```

## 3. 对外 wss（TLS）—— 用 Caddy 最省事

GitHub Pages 是 https，浏览器**只能连 `wss://`（不能连 `ws://` 明文）**，所以必须有 TLS。
Windows 上 Caddy 是单个 exe，自动签发/续期证书，配置最短：

1. 下载 Caddy（Windows amd64）：https://caddyserver.com/download → 放到 `C:\caddy\caddy.exe`
2. 你需要一个**指向这台服务器公网 IP 的域名**（Let's Encrypt 不给纯 IP 发证书）。
   把域名 A 记录指到 `47.106.120.9`，并放行入站 **80/443**：
   ```powershell
   New-NetFirewallRule -DisplayName "HTTP"  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80
   New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443
   ```
3. `C:\caddy\Caddyfile`：
   ```
   ws.你的域名.com {
       reverse_proxy 127.0.0.1:8080
   }
   ```
   （Caddy 自动处理 WebSocket Upgrade，无需额外配置。）
4. 运行：`C:\caddy\caddy.exe run --config C:\caddy\Caddyfile`
   （想常驻同样可用 `caddy.exe` 的 service 安装，或再注册个计划任务。）

最终客户端连接地址：`wss://ws.你的域名.com`

> 没有域名 / 暂时只想内网或本机验证：跳过 Caddy，给 install-service 加 `-OpenFirewall`
> 直接放行 8080，本机用 `ws://127.0.0.1:8080` 跑 `validate.html`。但公网客户端最终必须走 wss。

## 4. 验证

浏览器打开仓库里的 `server\validate.html`，地址填 `wss://ws.你的域名.com`（或本机 `ws://127.0.0.1:8080`），
点"开始自检"。看到全绿即整条链路通。重点用**手机流量**测一遍。

## 5. 磁盘清理（C 盘快满）

先体检，再清安全垃圾：
```powershell
# 只看不删：
powershell -ExecutionPolicy Bypass -File .\server\deploy\disk-report-and-clean.ps1 -ReportOnly
# 清理公认安全的临时文件 + 回收站 + npm 缓存：
powershell -ExecutionPolicy Bypass -File .\server\deploy\disk-report-and-clean.ps1
```
更激进的回收（WinSxS 组件清理、Windows Update 缓存、cleanmgr）脚本只会**打印建议命令**，
你看过再手动跑。它不会去删用户数据 / Program Files / 无法归类的大文件。
