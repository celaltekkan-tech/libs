#!/usr/bin/env bash
set -euo pipefail

bash /usr/local/bin/mail-ensure-ssl.sh
exec supervisord -c /etc/supervisor/supervisord.conf
