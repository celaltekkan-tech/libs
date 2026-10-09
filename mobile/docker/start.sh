#!/bin/sh
set -eu

ALLOW_FILE=/etc/nginx/allow-ips.conf
: > "$ALLOW_FILE"

IPS=${MOBILE_ALLOWED_IPS:-78.186.22.15}
OLDIFS=$IFS
IFS=',; '"$IFS"
# shellcheck disable=SC2086
set -- $IPS
IFS=$OLDIFS

for ip in "$@"; do
  [ -z "$ip" ] && continue
  echo "allow ${ip};" >> "$ALLOW_FILE"
done

echo "allow 127.0.0.1;" >> "$ALLOW_FILE"

if [ ! -s "$ALLOW_FILE" ]; then
  echo "MOBILE_ALLOWED_IPS boş; Expo erişimi kapalı." >&2
  exit 1
fi

npx expo start --port 8082 --localhost &
EXPO_PID=$!

i=0
while ! node -e "require('net').connect(8082,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" 2>/dev/null; do
  if ! kill -0 "$EXPO_PID" 2>/dev/null; then
    echo "Expo/Metro başlamadan kapandı." >&2
    exit 1
  fi
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "Expo/Metro 8082 portunda hazır olmadı." >&2
    exit 1
  fi
  sleep 1
done

nginx -g 'daemon off;' &
NGINX_PID=$!

while kill -0 "$EXPO_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 2
done

kill "$EXPO_PID" "$NGINX_PID" 2>/dev/null || true
exit 1
