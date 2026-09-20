# Storage Service (Go Worker + Observability) 🗃️

Consumes batched Pokémon updates from Kafka and persists them to MySQL.
Trades are written synchronously by the users service.

## ✅ Current Production Scope

- Kafka consumer for `batchedUpdates`
- Idempotent batch processing through `processed_sync_batches`
- Upsert/delete logic for Pokemon instances
- Auto-sync for `registrations` and `instance_tags`
- Precomputed anonymous community ranking totals by `variant_id`
- Versioned MySQL migrations through the one-shot `storage_migrate` command
- Retry file for failed poison messages
- In-app daily backup schedule at midnight (enabled by default)
- Health/readiness/metrics HTTP server (`:3004` by default)

## 🔌 Endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`

Operational metrics include:

- `storage_sync_batches_total{result}` for processed and duplicate batches
- `storage_instance_mutations_total{result}` for created, updated, deleted,
  stale, and unauthorized instance changes
- `storage_kafka_last_success_unixtime` for consumer freshness
- `storage_failed_messages_pending` for the durable poison-message backlog

## 🧭 Architecture (Mermaid)

### Service Context

```mermaid
flowchart LR
  Receiver[receiver_service] -->|Kafka: batchedUpdates| Storage[storage_service]
  Storage --> MySQL[(mysql_storage)]
  Storage --> Rankings[(pokemon_variant_rankings)]
  Storage --> RetryFile[(failed_messages.jsonl)]
  Prometheus[prometheus] -->|Scrape /metrics| Storage
```

### Consume + Persist Flow

```mermaid
sequenceDiagram
  participant K as Kafka
  participant S as Storage
  participant D as MySQL
  participant F as failed_messages.jsonl

  K->>S: Fetch message
  S->>S: Decompress + unmarshal payload
  S->>D: Upsert user/location
  S->>D: Upsert/delete pokemon instances
  S->>D: Refresh affected variant rankings

  alt success
    S->>K: Commit offset
  else handler error
    S->>F: Persist failed payload
    S->>K: Commit offset (skip poison)
  end
```

### Startup + Readiness

```mermaid
flowchart TD
  Start[Service start] --> Log[Init logger]
  Log --> Config[Load .env + app_conf]
  Config --> DB[Init DB]
  DB --> Schema[Resolve live instance schema]
  Schema --> Obs[Start HTTP observability server]
  Obs --> Consumer[Start Kafka consumer loop]
  Consumer --> Scheduler[Start cron jobs]
  Scheduler --> Ready[readyz = DB ready + consumer ready]
```

## 📐 UML Views

| Diagram | Purpose |
| --- | --- |
| Component UML | Core runtime modules and dependencies |
| Payload UML | Kafka message contract |
| Data UML | Main persisted entities |

### Component UML (Mermaid Class Diagram)

```mermaid
classDiagram
  class Main {
    +main()
  }

  class Consumer {
    +StartConsumer(ctx)
    +processMessage()
  }

  class MessageHandler {
    +HandleMessage(data)
    +parseAndUpsertPokemon()
  }

  class Database {
    +InitDB()
    +resolveInstanceSchema()
  }

  class Observability {
    +startObservabilityServer(ctx)
    +setConsumerReady(bool)
    +observeKafkaMessage(result,duration)
  }

  class Scheduler {
    +CreateBackup()
    +ReprocessFailedMessages()
  }

  Main --> Database
  Main --> Observability
  Main --> Consumer
  Main --> Scheduler
  Consumer --> MessageHandler
  MessageHandler --> Database
```

### Payload UML (Mermaid Class Diagram)

```mermaid
classDiagram
  class BatchedMessage {
    +user_id: string
    +username: string
    +device_id: string
    +trace_id: string
    +location: Location optional
    +pokemonUpdates: PokemonUpdate[]
  }

  class Location {
    +latitude: number
    +longitude: number
  }

  class PokemonUpdate {
    +key: string
    +pokemon_id: number
    +last_update: number
    +cp: number nullable
    +attack_iv: number nullable
    +defense_iv: number nullable
    +stamina_iv: number nullable
    +costume_id: number nullable
    +fast_move_id: number nullable
    +charged_move1_id: number nullable
    +charged_move2_id: number nullable
    +weight: number nullable
    +height: number nullable
    +friendship_level: number nullable
    +level: number nullable
    +nickname: string nullable
    +gender: string nullable
    +location_card: string nullable
    +location_caught: string nullable
    +mega_form: string nullable
    +fusion_form: string nullable
    +fused_with: string nullable
    +max_attack: string nullable
    +max_guard: string nullable
    +max_spirit: string nullable
    +date_caught: date_or_rfc3339 nullable
    +shiny: bool
    +lucky: bool
    +shadow: bool
    +purified: bool
    +mirror: bool
    +pref_lucky: bool
    +registered: bool
    +favorite: bool
    +is_caught: bool
    +is_for_trade: bool
    +is_wanted: bool
    +is_mega: bool
    +mega: bool
    +is_fused: bool
    +disabled: bool
    +dynamax: bool
    +gigantamax: bool
    +most_wanted: bool
    +caught_tags: json_array
    +trade_tags: json_array
    +wanted_tags: json_array
    +not_trade_list: json_object
    +not_wanted_list: json_object
    +trade_filters: json_object
    +wanted_filters: json_object
    +fusion: json_object
  }

  BatchedMessage --> Location
  BatchedMessage --> PokemonUpdate
```

### Pokemon Instance Write Contract (Storage Parse Surface)

The storage worker currently parses/persists the following Pokemon instance fields.

| Category | Fields |
| --- | --- |
| Identity and ordering | `key` (maps to `instance_id`), `variant_id`, `pokemon_id`, `last_update` |
| Ownership flags | `is_caught`, `is_for_trade`, `is_wanted`, `most_wanted` |
| Core stats | `cp`, `attack_iv`, `defense_iv`, `stamina_iv`, `level` |
| Base attributes | `nickname`, `gender`, `shiny`, `costume_id`, `lucky`, `shadow`, `purified` |
| Moves | `fast_move_id`, `charged_move1_id`, `charged_move2_id` |
| Dimensions | `weight`, `height` |
| Trade preferences | `mirror`, `pref_lucky`, `registered`, `favorite`, `friendship_level` |
| Tags and lists | `caught_tags`, `trade_tags`, `wanted_tags`, `not_trade_list`, `not_wanted_list`, `trade_filters`, `wanted_filters` |
| Mega, fusion, max | `mega`, `mega_form`, `is_mega`, `is_fused`, `fusion`, `fusion_form`, `fused_with`, `dynamax`, `gigantamax`, `max_attack`, `max_guard`, `max_spirit` |
| Location and dates | `location_card`, `location_caught`, `date_caught`, `traded_date` |
| Provenance and lifecycle | `pokeball`, `is_traded`, `original_trainer_name`, `original_trainer_id`, `crown` |
| Service metadata | `trace_id` (from top-level message), `user_id` (from top-level message), `date_added` (set by storage on create) |

Behavior notes:

- Deletion path is triggered only when `is_caught=false` and both `is_wanted` and `is_for_trade` are false.
- `is_caught` is required in incoming `pokemonUpdates`; rows missing it are skipped.
- Wanted rows are retained when `is_caught=false` and `is_wanted=true`.
- `is_for_trade` is automatically forced to `false` when `is_caught=false`.
- `registered` is automatically forced to `true` when `is_caught=true`.
- Storage enforces canonical ownership semantics using `is_caught` only.
- `registrations` is synchronized per `(user_id, variant_id)` from persisted instance state.
- `instance_tags` is synchronized from `caught_tags` + `trade_tags` + `wanted_tags`.
  IDs must belong to the authenticated user, remain active, and match the source
  collection (`caught`, `trade`, or `wanted`); deleted or cross-collection tag
  IDs are discarded. Built-in memberships are derived only from their canonical
  instance flags, never from client-supplied tag arrays.
- Unknown columns are filtered out at runtime via live `instances` schema inspection.
- JSON object fields default to `{}` when missing/invalid.
- JSON array tag fields default to `[]` when missing/invalid.

### Community Rankings Read Model

Storage owns the write side of community rankings:

- `pokemon_variant_rankings` stores caught, wanted, and most-wanted counts per
  `variant_id`.
- Every metric counts distinct `user_id` values. Multiple copies owned or
  wanted by one trainer count once.
- Disabled rows do not count.
- Variants with zero caught trainers are omitted from the rarest API rather
  than being presented as rare.
- Successful instance writes refresh only their affected variants.
- A full startup refresh plus hourly reconciliation repairs any missed
  incremental refresh.
- Instance conflicts use `last_update`; older or equal writes and deletions are
  ignored. Processed `sync_batch_id` rows are retained for 30 days and pruned
  daily so HTTP/Kafka retries remain safe without unbounded growth.
- `pokemon_rankings_snapshot` records anonymous collector/wishlist population
  totals and the snapshot timestamp.

The migration runner is built into the storage image. Compose runs it before
the worker:

```bash
docker compose run --rm storage_migrate
docker compose up -d storage_service
```

Fields that may appear from clients but are currently ignored by storage include:
none in the current canonical payload surface.

### Data UML (Mermaid Class Diagram)

```mermaid
classDiagram
  class User {
    +user_id: string PK
    +username: string
    +latitude: float
    +longitude: float
  }

  class PokemonInstance {
    +instance_id: string PK
    +user_id: string FK
    +pokemon_id: int
    +nickname: string nullable
    +cp: int nullable
    +attack_iv: int nullable
    +defense_iv: int nullable
    +stamina_iv: int nullable
    +shiny: bool
    +costume_id: int nullable
    +lucky: bool
    +shadow: bool
    +purified: bool
    +fast_move_id: int nullable
    +charged_move1_id: int nullable
    +charged_move2_id: int nullable
    +weight: float nullable
    +height: float nullable
    +gender: string nullable
    +mirror: bool
    +pref_lucky: bool
    +registered: bool
    +favorite: bool
    +location_card: string nullable
    +location_caught: string nullable
    +friendship_level: int nullable
    +date_caught: datetime nullable
    +date_added: datetime
    +is_caught: bool
    +is_for_trade: bool
    +is_wanted: bool
    +most_wanted: bool
    +caught_tags: json
    +trade_tags: json
    +wanted_tags: json
    +not_trade_list: json
    +not_wanted_list: json
    +trade_filters: json
    +wanted_filters: json
    +mega: bool
    +mega_form: string nullable
    +is_mega: bool
    +is_fused: bool
    +fusion: json
    +fusion_form: string nullable
    +fused_with: string nullable
    +disabled: bool
    +dynamax: bool
    +gigantamax: bool
    +max_attack: string nullable
    +max_guard: string nullable
    +max_spirit: string nullable
    +trace_id: string nullable
    +last_update: bigint
  }

  class Trade {
    +trade_id: string PK
    +user_id_proposed: string
    +user_id_accepting: string
    +trade_status: string
    +last_update: bigint
  }

  User --> PokemonInstance
```

## ⚙️ Configuration

### Required (`storage/.env`)

- `DB_USER`
- `DB_PASSWORD`
- `DB_HOSTNAME`
- `DB_PORT`
- `DB_NAME`
- `KAFKA_HOSTNAME`
- `KAFKA_PORT`
- `KAFKA_TOPIC`

### Recommended

- `KAFKA_MAX_RETRIES` (default `5`)
- `KAFKA_RETRY_INTERVAL` (default `3`)
- `PORT` or `STORAGE_HTTP_PORT` (default `3004`)
- `RUN_APP_BACKUPS` (default enabled; set `false` to disable app-managed backups)

### Optional YAML

- `storage/config/app_conf.yml` can define Kafka defaults.
- `.env` values override YAML values.

## 🐳 Docker

```bash
cd Go/storage
docker compose up -d
```

Notes:

- `storage_service` joins `kafka_default`
- `mysql_storage` runs in same compose
- storage healthcheck uses `http://127.0.0.1:3004/readyz`

## 📈 Metrics

Application metrics:

- `http_requests_total`
- `http_request_duration_seconds`
- `storage_kafka_messages_total{result=...}`
- `storage_kafka_message_processing_duration_seconds{result=...}`
- `storage_kafka_consumer_ready`

## 🚀 CI/CD

- CI: `.github/workflows/ci-storage.yml`
- Production deployment: private HomeOps `deploy-pokegonexus-service`

Deploy workflow includes:

- preflight env/compose/network checks
- migration from the exact revision-labelled image
- immutable-digest deployment and readiness validation
- rollback on failure

## 🔐 Security Notes

- No public ingress required for core worker path (Kafka + MySQL only)
- Message processing validates schema and ownership constraints
- Poison messages are persisted and skipped to avoid partition deadlock
- Service logs retain `trace_id` for cross-service correlation
