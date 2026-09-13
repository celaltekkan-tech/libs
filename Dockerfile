FROM node:20-alpine

WORKDIR /app

# bcrypt gibi native modüller için derleme araçları
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN mkdir -p uploads && chmod +x docker/backend-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["docker/backend-entrypoint.sh"]
CMD ["node", "src/server.js"]
