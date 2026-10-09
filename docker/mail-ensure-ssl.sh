#!/usr/bin/env bash
set -euo pipefail

SSL_DIR="/tmp/docker-mailserver/ssl"
HOST="${OVERRIDE_HOSTNAME:-${MAIL_HOSTNAME:-mail.oids.com.tr}}"
DOMAIN="${MAIL_DOMAIN:-oids.com.tr}"

mkdir -p "$SSL_DIR"

if [[ -s "$SSL_DIR/fullchain.pem" && -s "$SSL_DIR/privkey.pem" ]]; then
  echo "TLS sertifikası mevcut: $HOST"
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl yok; 993 (IMAPS) için sertifika üretilemedi" >&2
  exit 1
fi

openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 3650 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/CN=${HOST}" \
  -addext "subjectAltName=DNS:${HOST},DNS:${DOMAIN}"

chmod 600 "$SSL_DIR/privkey.pem"
echo "Kendinden imzalı TLS sertifikası üretildi: $HOST"
