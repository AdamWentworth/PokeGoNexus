FROM golang:1.26.6-alpine3.23 AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/receiver_service .

FROM alpine:3.23

ARG POKEGONEXUS_BUILD_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/AdamWentworth/PokeGoNexus" \
      org.opencontainers.image.revision="${POKEGONEXUS_BUILD_SHA}"

RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app \
    && mkdir -p /app \
    && chown -R app:app /app

WORKDIR /app
COPY --from=build /out/receiver_service /usr/local/bin/receiver_service

USER app
EXPOSE 3003

CMD ["receiver_service"]
