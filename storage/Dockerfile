# syntax=docker/dockerfile:1
FROM golang:1.26.6-alpine3.23 AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/storage_service .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/storage_migrate ./cmd/storage-migrate

FROM alpine:3.23

ARG POKEGONEXUS_BUILD_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/AdamWentworth/PokeGoNexus" \
      org.opencontainers.image.revision="${POKEGONEXUS_BUILD_SHA}"

WORKDIR /app

RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates tzdata mariadb-client \
    && addgroup -S app \
    && adduser -S -G app app \
    && mkdir -p /app/backups \
    && chown -R app:app /app

COPY --from=build /out/storage_service /usr/local/bin/storage_service
COPY --from=build /out/storage_migrate /usr/local/bin/storage_migrate

USER app
CMD ["storage_service"]
