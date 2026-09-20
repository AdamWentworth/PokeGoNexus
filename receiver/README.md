# Receiver Service (Go + Fiber) 📦

Receives high-volume, offline-tolerant Pokémon updates and publishes them to
Kafka topic `batchedUpdates`.

Each frontend batch carries a deterministic `sync_batch_id`. Receiver preserves
that identifier in Kafka so Storage can safely ignore a replay after a timeout
or retry.

Receiver is not the general application command API. Profiles, privacy,
friendships, blocks, and trades use synchronous, authoritative endpoints in the
users service.

## ✅ Current Production Posture

- Dependency vulnerabilities remediated (`fiber`, `jwt/v4`, `x/net`)
- Strict JWT verification (HS256, `exp` required, required user claims)
- Safer JSON decoding using Go stdlib (no `BodyParser` path)
- Request body limit (`10MB`) and per-batch update limits (`5000`)
- Health and readiness endpoints for deploy automation
- Graceful shutdown and Kafka producer close on SIGTERM/SIGINT
- Retry worker for unsent payload file (`pending_kafka_data.json`)
- CI with tests, vet, govulncheck, Trivy, and SBOM
- Manual CD with health-check + rollback workflow

## 🧭 Architecture (Mermaid)

### Service Context

```mermaid
flowchart LR
  Client[Frontend Client] --> Nginx[frontend_nginx]
  Nginx --> Receiver[receiver_service]
  Receiver --> Kafka[(kafka topic: batchedUpdates)]
  Receiver --> Metrics["/metrics"]
  Prometheus[prometheus] --> Metrics
```

### Ingest + Publish Flow

```mermaid
sequenceDiagram
  participant U as User Client
  participant N as Nginx
  participant R as Receiver API
  participant K as Kafka

  U->>N: POST /api/receiver/batchedUpdates
  N->>R: POST /api/batchedUpdates
  R->>R: Verify accessToken cookie (HS256 + claims)
  R->>R: Validate JSON + enforce limits
  R->>K: Write compressed event payload
  K-->>R: Ack
  R-->>N: 200 OK
  N-->>U: 200 OK
```

## 📐 UML Views

| Diagram | Purpose |
| --- | --- |
| Component UML | High-level module responsibilities |
| Payload UML | Ingest contract structure |

### Component UML (Mermaid Class Diagram)

```mermaid
classDiagram
  class Router {
    +POST /api/batchedUpdates
    +GET /healthz
    +GET /readyz
    +GET /metrics
  }

  class AuthVerifier {
    +verifyAccessToken()
  }

  class BatchHandler {
    +handleBatchedUpdates()
  }

  class KafkaProducer {
    +initializeKafkaProducer()
    +produceToKafka()
    +closeKafkaProducer()
  }

  class RetryWorker {
    +startRetryWorker()
    +retrySendingToKafka()
    +saveToLocalStorage()
  }

  class Metrics {
    +registerMetrics()
    +metricsMiddleware()
    +metricsHandler()
  }

  Router --> AuthVerifier
  Router --> BatchHandler
  BatchHandler --> KafkaProducer
  KafkaProducer --> RetryWorker
  Router --> Metrics
```

### Payload UML (Mermaid Class Diagram)

```mermaid
classDiagram
  class BatchedRequest {
    +location: Location optional
    +pokemonUpdates: PokemonUpdate[] optional
  }

  class Location {
    +latitude: float64
    +longitude: float64
  }

  class PokemonUpdate {
    +operation: string
    +pokemonData: object
  }

  BatchedRequest --> Location
  BatchedRequest --> PokemonUpdate
```

## 🔌 Endpoints

- `POST /api/batchedUpdates`
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`

The metrics endpoint includes
`receiver_sync_batches_total{result="accepted|invalid|oversized|kafka_failed"}`
so ingress rejection and Kafka availability are visible independently of HTTP
request totals.

## 🔐 Authentication

The service validates `accessToken` cookie and requires:

- valid HS256 signature
- `exp` claim present and valid
- `user_id`, `username`, and `device_id` claims

Invalid tokens return `401 Unauthorized`.

## 📨 Batch Request Shape

```json
{
  "location": { "latitude": 0, "longitude": 0 },
  "pokemonUpdates": []
}
```

Notes:

- `location` and `pokemonUpdates` are the complete contract.
- Missing update arrays are normalized to empty arrays.
- Requests with >`5000` Pokémon updates are rejected (`413`).

## ⚙️ Configuration

### Environment (`receiver/.env`)

Required:

- `JWT_SECRET`

Optional:

- `PORT` (default `3003`)
- `ALLOWED_ORIGINS` (comma-separated CORS list)
- `HOST_IP` (advanced override for Kafka hostname; usually not needed in Docker)

### Kafka config (`receiver/config/app_conf.yml`)

```yaml
events:
  hostname: "kafka"
  port: "9092"
  topic: "batchedUpdates"
  max_retries: 5
  retry_interval: 3
```

If config file is missing, safe defaults are used.

## 🐳 Docker

```bash
cd Go/receiver
docker compose up -d
```

Container:

- listens on `3003`
- host exposure is loopback-only: `127.0.0.1:3003`
- joins `kafka_default` network

## 🧪 Local Checks

```bash
cd Go/receiver
go test ./...
go vet ./...
govulncheck ./...
```

## 🚀 CI/CD

Workflows:

- CI: `.github/workflows/ci-receiver.yml`
- Production deployment: private HomeOps `deploy-pokegonexus-service`

HomeOps validates the current public `master` SHA and embedded image revision,
deploys the immutable digest, verifies readiness, and rolls back on failure.

## 📈 Fiber Decision

Fiber is still a valid production choice in 2026.
What matters is operational hardening (tests, vuln patching, health checks, resource limits, and observability), which this service now has.
