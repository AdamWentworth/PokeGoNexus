# syntax=docker/dockerfile:1

FROM golang:1.26.6-alpine3.23 AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/search_service .

FROM alpine:3.23

ARG POKEGONEXUS_BUILD_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/AdamWentworth/PokeGoNexus" \
      org.opencontainers.image.revision="${POKEGONEXUS_BUILD_SHA}"

WORKDIR /app

RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app \
    && chown -R app:app /app

COPY --from=build /out/search_service /usr/local/bin/search_service

USER app
EXPOSE 3006

CMD ["search_service"]
