FROM node:20-alpine

RUN apk add --no-cache nginx

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

COPY docker/nginx-metro.conf /etc/nginx/http.d/metro.conf
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh \
    && sed -i 's/\r$//' /start.sh \
    && rm -f /etc/nginx/http.d/default.conf

# Expo CLI'nin interaktif prompt/telemetry denemelerini kapatır (TTY yok).
ENV CI=1

EXPOSE 8081

CMD ["/start.sh"]
