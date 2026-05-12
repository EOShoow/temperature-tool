#!/bin/sh
set -eu

PROJECT_DIR="${1:-$(pwd)}"
WEB_DIR="$PROJECT_DIR/web"
PORT_START="${PORT_START:-8000}"
PORT_END="${PORT_END:-8099}"

if [ ! -d "$WEB_DIR" ]; then
  echo "Missing web directory: $WEB_DIR"
  echo "Press Enter to close."
  read _
  exit 1
fi

find_port() {
  port="$PORT_START"
  while [ "$port" -le "$PORT_END" ]; do
    if ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  return 1
}

PORT="$(find_port || true)"
if [ -z "$PORT" ]; then
  echo "No free local port found in $PORT_START-$PORT_END."
  echo "Press Enter to close."
  read _
  exit 1
fi

URL="http://127.0.0.1:$PORT/"

echo "Starting temperature tool..."
echo "URL: $URL"
echo "Serving only: $WEB_DIR"
echo "Press Ctrl+C or close this window to stop."
echo

open "$URL" >/dev/null 2>&1 || true

if command -v python3 >/dev/null 2>&1; then
  cd "$WEB_DIR"
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
fi

if command -v ruby >/dev/null 2>&1; then
  cd "$WEB_DIR"
  exec ruby -run -e httpd . -b 127.0.0.1 -p "$PORT"
fi

echo "No supported local static server runtime found."
echo "Install Python 3 or Ruby, then run this launcher again."
echo "Press Enter to close."
read _
exit 1
