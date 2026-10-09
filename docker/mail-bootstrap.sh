#!/usr/bin/env bash
set -euo pipefail

ACCOUNT="${MAIL_ACCOUNT:-info@oids.com.tr}"
PASSWORD="${MAIL_ACCOUNT_PASSWORD:-}"
DOMAIN="${MAIL_DOMAIN:-oids.com.tr}"
CONFIG="/tmp/docker-mailserver"

mkdir -p "$CONFIG"

if [[ -z "$PASSWORD" ]]; then
  echo "MAIL_ACCOUNT_PASSWORD boş; ${ACCOUNT} hesabı şimdi oluşturulmadı."
  exit 0
fi

if [[ -f "$CONFIG/postfix-accounts.cf" ]] && grep -q "^${ACCOUNT}|" "$CONFIG/postfix-accounts.cf"; then
  echo "Hesap zaten var: $ACCOUNT"
else
  if command -v setup >/dev/null 2>&1; then
    setup email add "$ACCOUNT" "$PASSWORD"
  else
    HASH="$(doveadm pw -s SHA512-CRYPT -p "$PASSWORD")"
    printf '%s|%s\n' "$ACCOUNT" "$HASH" >> "$CONFIG/postfix-accounts.cf"
  fi
  echo "Hesap eklendi: $ACCOUNT"
fi

if [[ ! -d "$CONFIG/opendkim/keys/${DOMAIN}" && ! -d "$CONFIG/rspamd/dkim" ]]; then
  if command -v setup >/dev/null 2>&1; then
    setup config dkim domain "$DOMAIN" || true
    echo "DKIM üretildi (veya atlandı): $DOMAIN"
  fi
else
  echo "DKIM zaten var: $DOMAIN"
fi
