# Build stage
# Align with go.mod toolchain.
FROM golang:1.26.6-alpine3.23 AS build

WORKDIR /src
RUN apk add --no-cache ca-certificates tzdata

# Ensure module downloads work consistently
ENV CGO_ENABLED=0

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/pokemon_data ./cmd/pokemon
RUN go build -trimpath -ldflags="-s -w" -o /out/catalog_migrate ./cmd/catalog-migrate

# Runtime stage
FROM alpine:3.23

ARG POKEGONEXUS_BUILD_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/AdamWentworth/PokeGoNexus" \
      org.opencontainers.image.revision="${POKEGONEXUS_BUILD_SHA}"

WORKDIR /usr/src/app
RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app

COPY --from=build /out/pokemon_data /usr/local/bin/pokemon_data
COPY --from=build /out/catalog_migrate /usr/local/bin/catalog_migrate

USER app

EXPOSE 3001
CMD ["pokemon_data"]
