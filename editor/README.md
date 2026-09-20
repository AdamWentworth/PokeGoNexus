# Pokemon Catalog Editor

This Tkinter application is the internal authoring tool for the Pokémon Go Nexus
reference catalog. It edits Pokemon, moves, evolutions, shadows, costumes,
forms, backgrounds, and size data directly in the dedicated PostgreSQL
catalog.

## Setup

```bash
sudo apt install python3-tk python3-venv
cd editor
python -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Set `POKEGO_EDITOR_PROD_HOST` in `.env` to the current production host. The
real `.env` is ignored by Git.

## Run

```bash
python main.py
```

`main.py` automatically reuses `editor/.venv`, creates a retained PostgreSQL
dump, opens a loopback-only SSH tunnel, and connects as
`pokemon_catalog_publisher`. The API uses the separate read-only
`pokemon_catalog_reader` role.

Close the editor normally after saving. A clean exit refreshes and prewarms the
Pokemon API cache, then validates the live catalog against the canonical raid
ranking fixture. After an interrupted session, refresh it manually from the
repository root:

```bash
ssh -i ~/.ssh/pokegonexus_recovery_ed25519 adam@192.168.1.77 \
  'bash -s -- /srv/pokegonexus' \
  < ops/pokemon-catalog/refresh-api-cache-prod.sh
```

## Safety

- Production authoring always creates a compressed dump first.
- The newest eight editor-session dumps are retained by default.
- Database credentials are read from private production environment files and
  are only exposed to the local editor process through the SSH tunnel.
- Normal API deployment applies schema migrations without replacing catalog
  records.
- A clean production edit fails visibly if the refreshed catalog changes the
  canonical raid ranking or assigns an invalid signature moveset.

## Tests

```bash
bash tests/test-postgres-database-manager.sh
```

The suite starts a disposable PostgreSQL container, applies the production
migrations, loads a synthetic fixture, and exercises editor reads and writes
without touching production data.
