FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Boş bırakılırsa frontend, /api isteklerini kendi origin'i üzerinden
# (nginx proxy_pass ile backend'e) gönderir. Ayrı bir API subdomain'i
# kullanılacaksa build sırasında --build-arg VITE_API_URL=https://api.example.com verin.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
