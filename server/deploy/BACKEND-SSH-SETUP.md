# 本机到后端的 SSH 免密配置

这份文档说明**本机（Windows）如何连接 Cloud Games 后端服务器**，以及密钥文件存放在哪里。
密钥本身不在任何仓库文件里，仓库是公开仓库，凭据一律不入库。

## 已配置的内容

| 项 | 值 |
|---|---|
| SSH 别名 | `cloudgames-backend` |
| 主机 | `154.201.86.250`（Ubuntu 22.04，主机名 `ser336214708786`） |
| 端口 / 用户 | `22` / `root` |
| 私钥 | `~/.ssh/cloudgames_backend_ed25519`（ed25519，仅本机用户可读写） |
| 公钥 | `~/.ssh/cloudgames_backend_ed25519.pub` |
| 公钥指纹 | `SHA256:9fUMuvZIogDC0VCX4H+n2g4ukKEHqpVzFIkhcLFUdaM` |
| 远端授权位置 | `/root/.ssh/authorized_keys` |

`~/.ssh/config` 中新增的段落：

```
Host cloudgames-backend
    HostName 154.201.86.250
    User root
    Port 22
    IdentityFile ~/.ssh/cloudgames_backend_ed25519
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

## 日常用法

```bash
# 连通性
ssh cloudgames-backend "hostname"

# 查看服务状态与日志
ssh cloudgames-backend "systemctl is-active cloudgames-ws.service"
ssh cloudgames-backend "journalctl -u cloudgames-ws.service -n 30 --no-pager"

# 一键更新后端（本机构建 → 上传 → 重启 → 验证）
bash server/deploy/deploy-backend.sh

# 只看线上版本，不改动
bash server/deploy/deploy-backend.sh --check
```

## 首次在新机器上复原本配置

1. 生成专用密钥（**不要**复用个人密钥）：
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/cloudgames_backend_ed25519 -N "" -C "cloudgames-backend@$(hostname)"
   ```
2. 把公钥写入服务器（需一次密码或已有其它可用登录方式）：
   ```bash
   ssh-copy-id -i ~/.ssh/cloudgames_backend_ed25519.pub root@154.201.86.250
   ```
3. 追加 `~/.ssh/config` 段落（见上）。
4. 收回私钥权限（Windows）：
   ```powershell
   icacls "$env:USERPROFILE\.ssh\cloudgames_backend_ed25519" /inheritance:r /grant:r "$($env:USERNAME):(R,W)"
   ```
5. 验证：`ssh cloudgames-backend "echo ok"`

## 安全约定

- **私钥永不入库**：仓库为 public，`.gitignore` 已加入 `*.pem`、`*.key`、`server/deploy/.secrets/`。
- 私钥只放 `~/.ssh/`，权限仅当前用户可读写；不要复制到项目目录、聊天记录或云盘公开链接。
- 服务器上的 `authorized_keys` 只保留必要公钥；可随时用下面命令核对：
  ```bash
  ssh cloudgames-backend "cat -n /root/.ssh/authorized_keys"
  ```
- 若私钥疑似泄露，立即在服务器删除对应行并重新生成一对密钥。

## 撤销访问

```bash
# 1) 从服务器移除该公钥（编辑 authorized_keys，删掉以 cloudgames-backend@ 结尾的行）
ssh cloudgames-backend "sed -i '/cloudgames-backend@/d' /root/.ssh/authorized_keys"

# 2) 本机删除私钥与 config 段落
rm ~/.ssh/cloudgames_backend_ed25519 ~/.ssh/cloudgames_backend_ed25519.pub
```

## 已知限制

- 服务器对**短时间内的多次 SSH 连接较敏感**，脚本已把远端操作合并为尽量少的会话；
  若出现 `Connection closed by 154.201.86.250`，等待 15–20 秒后重试即可。
- 若本机在 Git Bash 下 `chmod` 不生效（显示 666），请按上面第 4 步用 `icacls` 收紧权限。
- 目前是 root 直连。更稳妥的做法是新建部署专用用户并限制来源 IP，需要时可另行改造。

相关文档：`server/deploy/BACKEND-UPDATE.md`（更新流程）、`server/deploy/RESTART-BACKEND.md`（服务器侧细节与回滚）。
