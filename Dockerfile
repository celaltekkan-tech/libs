FROM node:20-alpine

WORKDIR /app

# bcrypt derlemesi ve pg_dump/psql (yedekleme / geri yükleme)
RUN apk add --no-cache python3 make g++ \
  && (apk add --no-cache postgresql16-client || apk add --no-cache postgresql-client)

COPY package.json package-lock.json ./
# pdfjs-dist isteğe bağlı olarak @napi-rs/canvas (native Skia) kurar. Yalnız metin
# çıkardığımız için gerekmez; bazı işlemcilerde yüklenince süreci çökertebildiği
# için kaldırılır (pdfjs uyarı verip canvas'sız çalışır).
RUN npm ci && rm -rf node_modules/@napi-rs

COPY . .
RUN mkdir -p uploads backups && chmod +x docker/backend-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["docker/backend-entrypoint.sh"]
CMD ["node", "src/server.js"]
