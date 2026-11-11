# 后端更新与重启（Ubuntu 生产机）

线上后端运行在 `154.201.86.250`（Ubuntu 22.04，主机名 `ser336214708786`）。
2026-11-11 已按本文完成一次更新，线上 `/api/agent/discovery` 返回 200。

## 现状结构

| 项 | 值 |
|---|---|
| 服务 | `cloudgames-ws.service`（systemd，`Restart=always`） |
| 运行用户 | `cloudgames` |
| 部署目录 | `/opt/cloudgames`（**不是 Git 仓库**，只有 `server.mjs` 与 `node_modules`） |
| 监听地址 | `127.0.0.1:8080` |
| 反向代理 | Caddy `/etc/caddy/Caddyfile` → `ws.chenximeow.icu { reverse_proxy 127.0.0.1:8080 }` |
| Node | `/opt/node22/bin/node` |

部署方式：**本地构建 → 上传单个 bundle → 重启服务**。服务器上没有 `npm ci` 或 `git pull` 流程。

## 更新步骤

### 1. 本地构建

```bash
npm run server:build
sha256sum server/dist/server.mjs
```

确认产物含 Agent 接口：

```bash
grep -c "api/agent" server/dist/server.mjs   # 应大于 0
```

### 2. 备份远端旧版本

```bash
ssh root@154.201.86.250 "cp /opt/cloudgames/server.mjs /opt/cloudgames/server.mjs.bak-$(date +%Y%m%d-%H%M%S)"
```

### 3. 上传并替换

```bash
scp server/dist/server.mjs root@154.201.86.250:/tmp/server-new.mjs
ssh root@154.201.86.250 "mv /tmp/server-new.mjs /opt/cloudgames/server.mjs && chown root:root /opt/cloudgames/server.mjs && chmod 644 /opt/cloudgames/server.mjs && sha256sum /opt/cloudgames/server.mjs"
```

远端哈希应与本地一致，否则不要继续。

### 4. 重启并确认

```bash
ssh root@154.201.86.250 "systemctl restart cloudgames-ws.service && sleep 2 && systemctl is-active cloudgames-ws.service"
```

预期输出 `active`。

### 5. 验证

```bash
# 本机（服务器侧）
ssh root@154.201.86.250 "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/agent/discovery"

# 公网
curl -s -o /dev/null -w "%{http_code}\n" https://ws.chenximeow.icu/api/agent/discovery
```

两处都应为 `200`。旧版会返回 `426 Upgrade Required`。

启动日志应出现新 banner：

```
[ws] listening on ws://127.0.0.1:8080 {
  games: [ 'bombdefuse', 'territory', 'catguess', 'codenames' ],
  agentApi: '/api/agent/rpc'
}
```

```bash
ssh root@154.201.86.250 "journalctl -u cloudgames-ws.service -n 12 --no-pager"
```

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 公网 426，本机 200 | Caddy 指向了别的进程/端口 | `ss -lntp \| grep 8080` 与 `cat /etc/caddy/Caddyfile` 核对 |
| 本机也 426 | 上传的是旧 bundle | 重新构建并核对远端 sha256 |
| `EADDRINUSE` | 端口仍被占用 | `systemctl restart` 后仍有问题则查残留 node 进程 |
| 服务反复重启 | Bundle 启动异常 | `journalctl -u cloudgames-ws.service -n 50 --no-pager` 看堆栈 |
| 网页仍无面板 | 浏览器缓存旧 JS | Ctrl+F5 强制刷新 |

## 回滚

```bash
ssh root@154.201.86.250 "ls -t /opt/cloudgames/*.bak-* | head -1"     # 找到备份
ssh root@154.201.86.250 "cp <备份路径> /opt/cloudgames/server.mjs && systemctl restart cloudgames-ws.service"
```

回滚后 Agent 面板会提示邀请失败，原有联机功能不受影响。

## 安全约定

- 本文不记录服务器账号与密码，也不写入任何仓库文件。
- 若密码曾在聊天或文档中明文出现，请立即在服务器上更换。
- 服务器暴露 22/80/443；建议为 SSH 启用密钥登录并限制来源 IP。

## 长期建议

当前是"手工上传 bundle"。若希望 `git push` 后自动更新后端，可为该机配置自托管 GitHub Actions Runner，或写一个 `git pull + build + restart` 的 systemd timer。这需要服务器上有仓库克隆，且需单独授权。
