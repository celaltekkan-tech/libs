FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Expo CLI'nin interaktif prompt/telemetry denemelerini kapatır (TTY yok).
ENV CI=1

EXPOSE 8081

CMD ["npx", "expo", "start", "--port", "8081"]
