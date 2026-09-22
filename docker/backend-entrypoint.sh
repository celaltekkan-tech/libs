#!/bin/sh
set -e

echo "Veritabanı migration'ları çalıştırılıyor..."
npx sequelize db:migrate

echo "Seed'ler çalıştırılıyor..."
npx sequelize db:seed:all

exec "$@"
