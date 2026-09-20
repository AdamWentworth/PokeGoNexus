# nginx dockerfile
FROM nginx:1.29-alpine3.23

ARG POKEGONEXUS_BUILD_SHA=development
LABEL org.opencontainers.image.source="https://github.com/AdamWentworth/PokeGoNexus" \
      org.opencontainers.image.revision="${POKEGONEXUS_BUILD_SHA}"

# Apply latest Alpine security updates during image build.
RUN apk upgrade --no-cache

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy frontend build output to Nginx's html directory
COPY ./build /usr/share/nginx/html

# Copy shared cross-app assets under /media
COPY ./canonical-assets /usr/share/nginx/html/media

# Copy proxy_params (ensure it exists at project root or adjust path)
COPY proxy_params /etc/nginx/proxy_params

# Optional: redirect logs to Docker stdout/stderr
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
 && ln -sf /dev/stderr /var/log/nginx/error.log

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
