# Pokemon Catalog Service

This Go service publishes the Pokémon Go Nexus reference catalog. PostgreSQL is
the sole catalog store. The API builds a complete browser payload from the
dedicated `pokemon_catalog_db` container, keeps the hot serialized result in
each API process, and optionally shares immutable JSON/gzip payloads through
Redis. Redis is an acceleration layer only; PostgreSQL remains authoritative.

## Local Development

Start PostgreSQL, Redis, and the API together:

```bash
docker compose up --build pokemon_catalog_db pokemon_cache pokemon_data
```

Or run the API against an existing catalog:

```bash
export CATALOG_DATABASE_URL='postgresql://user:password@127.0.0.1:5433/pokemon_catalog'
go run ./cmd/catalog-migrate
go run ./cmd/pokemon
```

The API listens on `PORT` (default `3001`). Important endpoints are:

- `GET /healthz`: process health
- `GET /readyz`: catalog connectivity and cache readiness
- `GET /pokemon/pokemons`: complete catalog payload
- `POST /internal/cache/refresh`: protected cache refresh for catalog authoring

## Configuration

- `CATALOG_DATABASE_URL`: required PostgreSQL reader URL
- `PORT`: HTTP port
- `CACHE_REFRESH_TOKEN`: protects the internal cache refresh endpoint
- `DB_MAX_OPEN_CONNS`, `DB_MAX_IDLE_CONNS`, `DB_CONN_MAX_LIFETIME`: pool controls
- `REDIS_URL`: optional Redis URL; unset it when running without L2 caching
- `REDIS_KEY_PREFIX`: cache namespace (default `pokegonexus:pokemon:v1`)
- `REDIS_CACHE_TTL`: immutable payload lifetime (default `24h`)
- `REDIS_OPERATION_TIMEOUT`: per-operation failure budget (default `300ms`)
- `REDIS_REVALIDATE_INTERVAL`: cross-replica version check interval (default `5s`)
- `REDIS_BUILD_LOCK_TTL`: distributed cold-build lock lifetime (default `2m`)
- `REDIS_BUILD_WAIT`: wait for another replica's cold build (default `5s`)

Credentials live in private production environment files and are never
committed.

## Schema And Deployment

Versioned schema changes live in `migrations/`. Production deployment runs
`go run ./cmd/catalog-migrate` before recreating the API container. Migrations
are idempotent and recorded in `pokemon_catalog.schema_migrations`.

The service and its dedicated database are defined together in
`docker-compose.yml`. Catalog data persists in the
`pokemon_catalog_pgdata` named volume. The `pokemon_cache` container has no
persistent volume or append-only log because every value can be rebuilt from
PostgreSQL.

## Cache Architecture

The catalog response path has three levels:

1. Per-process memory serves the normal hot path without a network call.
2. Redis lets a new or restarted API replica restore exact JSON, gzip, ETag,
   and build-time metadata without querying and serializing PostgreSQL.
3. PostgreSQL builds the payload when neither cache has a usable version.

Redis stores content-addressed immutable payloads and a lightweight current
version pointer. Cache refresh writes an invalidation marker so other replicas
discard stale memory on their next revalidation. A short Redis lock prevents
multiple replicas from rebuilding the same cold payload simultaneously.

Redis is deliberately not part of `/readyz`. A timeout, malformed cached
payload, eviction, restart, or complete Redis outage falls back to the existing
memory/PostgreSQL path. Cache behavior is visible through
`/internal/cache/stats` and the Prometheus metrics
`pokemon_catalog_cache_operations_total` and
`pokemon_catalog_cache_build_duration_seconds`.

## Catalog Authoring

Use the Tkinter editor from `../editor`:

```bash
cd ../editor
python main.py
```

The editor opens an SSH tunnel to the publisher role, creates a private dump
before authoring, and refreshes the API cache after a normal exit. Maintenance
scripts use the same authoring session by default.

## Tests

```bash
go test ./...
go test -race ./internal/cache ./internal/config
bash scripts/test-postgres-catalog.sh
```

The cache tests exercise Redis binary round trips, distributed locking,
cross-replica invalidation, and outage fallback. The catalog contract test
starts an isolated PostgreSQL container, applies the real migrations, loads a
small synthetic fixture, and verifies the browser payload.

Operational details are in [RUNBOOK.md](RUNBOOK.md) and
`../ops/pokemon-catalog/README.md`.
