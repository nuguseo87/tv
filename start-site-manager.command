#!/bin/zsh
cd "$(dirname "$0")"

MANAGER_URL="http://127.0.0.1:8788"
LOG_PATH="/tmp/nuguseo-site-manager.log"
PLIST_PATH="$HOME/Library/LaunchAgents/com.nuguseo.site-manager.plist"
SERVICE_DOMAIN="gui/$(id -u)"
SERVICE_TARGET="$SERVICE_DOMAIN/com.nuguseo.site-manager"

if ! curl -fsS "$MANAGER_URL/api/sites" >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.nuguseo.site-manager</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$PWD/site-manager.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PWD</string>
  <key>StandardOutPath</key>
  <string>$LOG_PATH</string>
  <key>StandardErrorPath</key>
  <string>$LOG_PATH</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF

  launchctl enable "$SERVICE_TARGET" >/dev/null 2>&1 || true
  if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
    launchctl kickstart -k "$SERVICE_TARGET" >/dev/null 2>&1 || true
  else
    launchctl bootstrap "$SERVICE_DOMAIN" "$PLIST_PATH" >/dev/null 2>&1 || true
  fi

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
