#!/bin/sh
set -eu

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
SCRIPT="$PROJECT_DIR/tools/serve-web-mac.sh"

if [ ! -f "$SCRIPT" ]; then
  echo "Missing script: $SCRIPT"
  echo "Press Enter to close."
  read _
  exit 1
fi

chmod +x "$SCRIPT" 2>/dev/null || true
exec "$SCRIPT" "$PROJECT_DIR"

