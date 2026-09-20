# Production Deploy State

The private HomeOps repository owns production deployment definitions. The
public PokeGoNexus repository tests source and publishes immutable application
images, but it does not schedule work on the production runner. Durable state
lives under `/srv/pokegonexus` and in named Docker volumes.

Host-local state includes:

- private service environment files
- service backups and logs
- certbot hooks
- monitoring and queue state

Database data belongs to its service-owned Docker volume. The Pokemon catalog
uses `pokemon_catalog_pgdata`; deployments preserve that volume and apply
versioned migrations before starting the API.

The Pokemon API's `pokemon_cache` Redis container is disposable acceleration,
not durable state. It intentionally has no named volume and is excluded from
backup and restore procedures.

The old public-checkout-to-runtime path is retired. New hosts should be
provisioned from private HomeOps controls, then restore private environment
files and database backups where required.
