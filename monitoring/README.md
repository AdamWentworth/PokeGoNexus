# Monitoring Stack

This folder runs Prometheus + Alertmanager for the Pokemon, authentication, receiver, storage, events, users, search, and location services.

It also includes Kafka, host, and container telemetry via:

- `kafka_exporter` (Kafka broker/topic/consumer lag metrics)
- `node_exporter` (host CPU, memory, disk, filesystem, load)
- `cadvisor` (per-container CPU, memory, filesystem, network)
- `blackbox_exporter` (synthetic HTTP probing for frontend internal and external availability/latency/TLS)

What these are:

- `kafka_exporter`: reads Kafka broker metadata and consumer lag so Prometheus can alert on broker/topic/lag health.
- `node_exporter`: reads Linux host stats from `/proc` and `/sys` so Prometheus can graph host CPU/RAM/disk pressure.
- `cadvisor`: reads Docker container runtime stats so Prometheus can graph per-container CPU/RAM/network/fs usage.
- `blackbox_exporter`: probes both `http://frontend_nginx/` (internal service health, accepts redirect codes without leaving internal network) and `https://pokegonexus.com/` (external availability/TLS) from inside the monitoring stack.

## Severe Email Alerts

Alertmanager is configured to email only `severity="critical"` alerts to:

- `adamjohnwentworth@gmail.com`

Set SMTP credentials on the host before starting `monitoring/docker-compose.yml`:

```powershell
$env:ALERT_EMAIL_FROM="adamjohnwentworth@gmail.com"
$env:ALERT_EMAIL_USER="adamjohnwentworth@gmail.com"
$env:ALERT_EMAIL_PASS="<gmail-app-password>"
```

Gmail requires an App Password when 2FA is enabled.

Recommended for prod and local Docker Compose:

1. Create `monitoring/.env` (gitignored) with:
   - `ALERT_EMAIL_FROM`
   - `ALERT_EMAIL_USER`
   - `ALERT_EMAIL_PASS`
2. Use `--env-file monitoring/.env` when starting the stack.

## Start

```bash
docker compose -f monitoring/docker-compose.yml --env-file monitoring/.env up -d
```

## CI and CD

- CI workflow: `.github/workflows/ci-monitoring.yml`
  - Validates Prometheus config and alert rules (`promtool`)
  - Validates Alertmanager config syntax (`amtool`)
  - Validates compose rendering (`docker compose config`)

- Private HomeOps workflow: `manage-pokegonexus-infrastructure`
  - Offers a read-only verification mode and an explicit deploy mode
  - Owns digest-pinned production Compose and monitoring configuration
  - Deploys `prometheus` + `alertmanager` + `node_exporter` + `cadvisor` + `kafka_exporter` + `blackbox_exporter`
  - Checks health endpoints before success

Host ports used by monitoring stack:

- Prometheus: `127.0.0.1:9090`
- Alertmanager: `127.0.0.1:19093` (container port remains `9093`)

## What You Can Monitor

- App-level metrics: request rate, latency, status codes (`pokemon_data`, `auth_service`, `receiver_service`, `storage_service`, `events_service`, `users_service`, `search_service`, `location_service`)
- Kafka-level metrics: broker availability, topic visibility, consumer lag (`kafka_exporter`)
- Host-level metrics: CPU %, RAM %, disk free %, filesystem pressure (`node_exporter`)
- Container-level metrics: per-container CPU/memory/network/filesystem (`cadvisor`)
- Frontend synthetic checks:
  - Internal service uptime (`frontend_probe`)
  - External availability/latency/TLS (`frontend_probe_external`)

Common quick PromQL checks:

- Host CPU %:
  - `100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
- Host memory % used:
  - `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100`
- Container CPU cores used:
  - `sum by (name) (rate(container_cpu_usage_seconds_total{name!=""}[5m]))`
- Container memory MiB:
  - `(container_memory_working_set_bytes{name!="",image!=""} / 1024 / 1024)`
- Kafka brokers up:
  - `kafka_brokers`
- Kafka consumer lag (receiver + events readers):
  - `kafka_consumergroup_lag_sum{consumergroup=~"event_group|sse_consumer_group"}`
- Frontend probe success:
  - `probe_success{job="frontend_probe"}`
- Frontend external probe success:
  - `probe_success{job="frontend_probe_external"}`
- Frontend probe duration:
  - `probe_duration_seconds{job="frontend_probe_external"}`
