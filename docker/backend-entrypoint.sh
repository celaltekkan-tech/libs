#!/bin/sh
set -e

echo "Veritabanı migration'ları çalıştırılıyor..."
npx sequelize db:migrate

exec "$@"
