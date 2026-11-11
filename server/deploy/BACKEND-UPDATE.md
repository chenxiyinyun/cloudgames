# 后端更新指南（Cloud Games）

面向日常维护：**改完代码后，如何把后端更新到线上**。

- 服务器：`154.201.86.250`（Ubuntu 22.04）
- 线上域名：`ws.chenximeow.icu`（Caddy → `127.0.0.1:8080`）
- 服务：systemd `cloudgames-ws.service`
- 本机 SSH：别名 `cloudgames-backend`（配置见 [BACKEND-SSH-SETUP.md](./BACKEND-SSH-SETUP.md)）

## 一句话版本

```bash
bash server/deploy/deploy-backend.sh
```

脚本会依次：构建 `server/dist/server.mjs` → 校验产物含 Agent 接口 → 上传 → 哈希比对 → 备份旧版 → 替换 → 重启 → 本机与公网双重验证。任一步失败即中止，不会留下半更新状态。

只查看线上版本：

```bash
bash server/deploy/deploy-backend.sh --check
```

## 什么时候需要更新后端

| 改动 | 需要更新后端？ | 需要更新网页？ |
|---|---|---|
| 改了 `server/**`（房间、协议、Agent 接口、游戏适配器） | ✅ | 通常不需要 |
| 改了 `games/*/src/services/gameEngine.js`（引擎规则） | ✅ | ✅ |
| 只改了页面/样式/文案（`.vue`/`.css`） | ❌ | ✅（push 即自动部署） |
| 改了 `src/shared/ws/**` | ✅ | ✅ |

网页由 GitHub Pages 自动部署（push 到 `main` 即触发）；**后端不会自动更新**，必须执行上面的脚本。

## 手动分步执行（脚本不可用时）

```bash
# 1) 构建
npm run server:build
grep -c "api/agent" server/dist/server.mjs      # 应大于 0
sha256sum server/dist/server.mjs

# 2) 上传
scp server/dist/server.mjs cloudgames-backend:/tmp/server-new.mjs

# 3) 校验 + 备份 + 替换 + 重启（一条会话完成）
ssh cloudgames-backend '
set -e
sha256sum /tmp/server-new.mjs
cp /opt/cloudgames/server.mjs /opt/cloudgames/server.mjs.bak-$(date +%Y%m%d-%H%M%S)
mv /tmp/server-new.mjs /opt/cloudgames/server.mjs
chown root:root /opt/cloudgames/server.mjs; chmod 644 /opt/cloudgames/server.mjs
systemctl restart cloudgames-ws.service
sleep 3; systemctl is-active cloudgames-ws.service'
```

篡改后必须确认远端 `sha256sum` 与本地一致，再替换。

## 验证清单

```bash
# 服务器本机
ssh cloudgames-backend "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/agent/discovery"
# 公网
curl -s -o /dev/null -w "%{http_code}\n" https://ws.chenximeow.icu/api/agent/discovery
```

- 两处均应为 `200`
- 启动日志应出现：

```
[ws] listening on ws://127.0.0.1:8080 {
  games: [ 'bombdefuse', 'territory', 'catguess', 'codenames' ],
  agentApi: '/api/agent/rpc'
}
```

```bash
ssh cloudgames-backend "journalctl -u cloudgames-ws.service -n 15 --no-pager"
```

- 网页端：进任意游戏建房 → 大厅出现「让 Agent 加入」→ 生成邀请能出指令。

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `Connection closed by 154.201.86.250` | 服务器对频繁 SSH 连接敏感 | 等 15–20 秒重试；确认脚本用的是合并会话版本 |
| 公网 426、本机 200 | Caddy 指向了别的端口/进程 | `ss -lntp \| grep 8080` 与 `cat /etc/caddy/Caddyfile` |
| 本机也 426 | 上传了旧 bundle | 重新构建并核对远端 sha256 |
| 服务反复重启 | 新 bundle 启动异常 | `journalctl -u cloudgames-ws.service -n 50 --no-pager` |
| 网页没变化 | 浏览器缓存 | Ctrl+F5；确认网页 Actions 已部署成功 |
| `EADDRINUSE` | 端口被残留进程占用 | `systemctl restart` 后仍占用则查 node 进程 |

## 回滚

```bash
ssh cloudgames-backend "ls -t /opt/cloudgames/*.bak-* | head -3"
ssh cloudgames-backend "cp /opt/cloudgames/server.mjs.bak-<时间戳> /opt/cloudgames/server.mjs && systemctl restart cloudgames-ws.service"
```

回滚后再跑一次验证清单。注意：回滚到不含 Agent 接口的旧版后，网页端「生成邀请」会提示失败，原有联机功能不受影响。

## 服务器结构备忘

| 路径 | 说明 |
|---|---|
| `/opt/cloudgames/server.mjs` | 线上运行的单文件 bundle（esbuild 产物） |
| `/opt/cloudgames/node_modules` | 运行时依赖（`ws`） |
| `/opt/cloudgames/*.bak-*` | 历史备份，按需清理 |
| `/etc/systemd/system/cloudgames-ws.service` | 服务定义（`Restart=always`，`MemoryMax=300M`） |
| `/etc/caddy/Caddyfile` | 反代配置 |

服务器**不是 Git 仓库**，没有 `git pull` / `npm ci`；更新只通过上传 bundle 完成。
