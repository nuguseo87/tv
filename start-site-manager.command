#!/bin/zsh
cd "$(dirname "$0")"
open "http://localhost:8788"
node site-manager.js
