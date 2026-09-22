FROM nginx:1.27-alpine

COPY index.html styles.css script.js /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
