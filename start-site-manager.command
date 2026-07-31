#!/bin/zsh
cd "$(dirname "$0")"

MANAGER_URL="http://127.0.0.1:8788"
LOG_PATH="/tmp/nuguseo-site-manager.log"

if ! curl -fsS "$MANAGER_URL/api/sites" >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
  : > "$LOG_PATH"
  nohup "$NODE_BIN" "$PWD/site-manager.js" >> "$LOG_PATH" 2>&1 < /dev/null &
  SERVER_PID=$!
  disown "$SERVER_PID" >/dev/null 2>&1 || true

  for _ in {1..20}; do
    curl -fsS "$MANAGER_URL/api/sites" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

if curl -fsS "$MANAGER_URL/api/sites" >/dev/null 2>&1; then
  open "$MANAGER_URL"
else
  osascript -e 'display alert "사이트 관리자를 시작하지 못했습니다" message "코실장에게 /tmp/nuguseo-site-manager.log 확인을 요청해 주세요." as critical'
fi
