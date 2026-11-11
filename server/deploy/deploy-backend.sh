#!/usr/bin/env bash
# 一键更新 Cloud Games 后端（本机构建 -> 上传 -> 重启 -> 验证）
#
# 用法：
#   bash server/deploy/deploy-backend.sh            # 更新并重启
#   bash server/deploy/deploy-backend.sh --check    # 只检查线上版本，不改动
#
# 前置：本机已配置 SSH 免密（Host 别名 cloudgames-backend，见 server/deploy/BACKEND-SSH-SETUP.md）
set -euo pipefail

SSH_HOST="${CG_SSH_HOST:-cloudgames-backend}"
REMOTE_DIR="${CG_REMOTE_DIR:-/opt/cloudgames}"
SERVICE="${CG_SERVICE:-cloudgames-ws.service}"
DISCOVERY_URL="${CG_DISCOVERY_URL:-https://ws.chenximeow.icu/api/agent/discovery}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUNDLE="$REPO_ROOT/server/dist/server.mjs"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)

rsh() { ssh "${SSH_OPTS[@]}" "$SSH_HOST" "$@"; }

say() { printf '\033[36m%s\033[0m\n' "$*"; }
ok()  { printf '\033[32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

check_only=false
[ "${1:-}" = "--check" ] && check_only=true

# ── 0. 连通性 ────────────────────────────────────────────────────────────────
say "0/5 检查 SSH 连通性（$SSH_HOST）"
rsh "echo ok" >/dev/null 2>&1 \
  || die "SSH 免密登录失败。请先完成 server/deploy/BACKEND-SSH-SETUP.md 中的配置。"
ok "SSH 可用"

remote_hash=$(rsh "sha256sum $REMOTE_DIR/server.mjs 2>/dev/null | cut -d' ' -f1")
remote_agent=$(rsh "grep -c 'api/agent' $REMOTE_DIR/server.mjs 2>/dev/null || echo 0")
say "线上 bundle: ${remote_hash:-缺失}  (含 Agent 接口: $remote_agent 处)"

if $check_only; then
  if [ "$remote_agent" -gt 0 ]; then ok "线上已是支持 Agent 的版本"; else say "线上仍是旧版，需要运行不带 --check 的命令来更新"; fi
  exit 0
fi

# ── 1. 本地构建 ──────────────────────────────────────────────────────────────
say "1/5 构建服务端 bundle"
cd "$REPO_ROOT"
npm run server:build >/dev/null
[ -f "$BUNDLE" ] || die "构建失败：未找到 $BUNDLE"
grep -q "api/agent" "$BUNDLE" || die "构建产物不含 Agent 接口，请先确认代码已更新"
local_hash=$(sha256sum "$BUNDLE" | cut -d' ' -f1)
ok "构建完成 sha256=${local_hash:0:12}…"

# ── 2~4. 备份 / 上传 / 重启（两次连接，远端操作合并为一次会话）──────────────
say "2/5 上传新 bundle"
stamp=$(date +%Y%m%d-%H%M%S)
scp_cmd=(scp -q "${SSH_OPTS[@]}" "$BUNDLE" "$SSH_HOST:/tmp/server-new.mjs")
"${scp_cmd[@]}" || die "上传失败，线上文件未改动"
ok "上传完成"

say "3/5 校验哈希并替换、重启"
rsh "set -e
actual=\$(sha256sum /tmp/server-new.mjs | cut -d' ' -f1)
[ \"\$actual\" = \"$local_hash\" ] || { echo \"HASH_MISMATCH \$actual\" >&2; exit 9; }
cp $REMOTE_DIR/server.mjs $REMOTE_DIR/server.mjs.bak-$stamp
mv /tmp/server-new.mjs $REMOTE_DIR/server.mjs
chown root:root $REMOTE_DIR/server.mjs
chmod 644 $REMOTE_DIR/server.mjs
systemctl restart $SERVICE
sleep 3
systemctl is-active $SERVICE" || die "部署失败：哈希不一致或服务未启动，线上未被替换"
ok "已替换并重启（备份 server.mjs.bak-$stamp）"

# ── 5. 验证 ──────────────────────────────────────────────────────────────────
say "5/5 验证接口"
local_status=""
for attempt in 1 2 3; do
  local_status=$(rsh "curl -s -m 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/api/agent/discovery" 2>/dev/null || true)
  [ "$local_status" = "200" ] && break
  say "  本机探测第 $attempt 次未通过（${local_status:-连接中断}），等待重试…"
  sleep 6
done
if [ "$local_status" = "200" ]; then
  ok "服务器本机 /api/agent/discovery = 200"
else
  say "⚠ 本机探测未通过（${local_status:-连接中断}），改以公网结果为准"
fi

public_status=$(curl -s -m 25 -o /tmp/cg-discovery.json -w '%{http_code}' "$DISCOVERY_URL" || echo 000)
if [ "$public_status" = "200" ] && grep -q '"apiVersion"' /tmp/cg-discovery.json 2>/dev/null; then
  games=$(grep -o '"gameId":"[a-z]*"' /tmp/cg-discovery.json | cut -d'"' -f4 | tr '
' ' ')
  ok "公网接口 200，游戏：$games"
else
  die "公网接口返回 $public_status。请检查：ssh $SSH_HOST 'systemctl status $SERVICE --no-pager' 与 Caddy 反代"
fi

say "完成。网页端可直接在房间内生成 Agent 邀请。"
