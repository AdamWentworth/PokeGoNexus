# users dockerfile

# syntax=docker/dockerfile:1

# Stage 1 - Build
FROM golang:1.26.6-alpine3.23 AS builder

WORKDIR /app

ENV CGO_ENABLED=0 \
    GO111MODULE=on

RUN apk add --no-cache ca-certificates tzdata git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -trimpath -ldflags="-s -w" -o /out/users_service .

# Stage 2 - Runtime
FROM alpine:3.23

ARG POKEGONEXUS_BUILD_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/AdamWentworth/PokeGoNexus" \
      org.opencontainers.image.revision="${POKEGONEXUS_BUILD_SHA}"

WORKDIR /usr/src/app

RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app

COPY --from=builder /out/users_service /usr/local/bin/users_service
RUN touch /usr/src/app/app.log && chown app:app /usr/src/app/app.log

USER app

EXPOSE 3005

CMD ["users_service"]
