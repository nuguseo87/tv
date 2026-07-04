#!/bin/zsh
cd "$(dirname "$0")"
if ! curl -fsS http://localhost:8788/api/sites >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
  PLIST="$HOME/Library/LaunchAgents/com.nuguseo.site-manager.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
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
  <string>/tmp/nuguseo-site-manager.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/nuguseo-site-manager.log</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
  launchctl kickstart -k "gui/$(id -u)/com.nuguseo.site-manager" >/dev/null 2>&1 || true
  sleep 1
fi
open "http://localhost:8788"
