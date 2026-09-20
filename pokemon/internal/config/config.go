package config

import (
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port               int
	Env                string
	CatalogDatabaseURL string
	CachePrewarm       bool
	CacheRefreshToken  string
	CacheBuildTimeout  time.Duration
	RedisURL           string
	RedisKeyPrefix     string
	RedisCacheTTL      time.Duration
	RedisOpTimeout     time.Duration
	RedisRevalidate    time.Duration
	RedisBuildLockTTL  time.Duration
	RedisBuildWait     time.Duration
	AllowedOrigins     []string
	AllowCloudflareSub bool
	LogLevel           slog.Level

	// If true, JSON debug endpoints respond with pretty-printed JSON.
	// Default is true for non-production environments.
	JSONPretty bool

	// Rate limiting (per-client, in-process) for the heavy endpoint.
	RateLimitEnabled bool
	RateLimitRPS     float64
	RateLimitBurst   int

	// Internal-only endpoints (/metrics and /internal/*) guarded by CIDR allowlist.
	InternalOnlyEnabled bool
	InternalOnlyCIDRs   []string

	// Trusted proxy ranges (CIDRs) used to decide whether to trust X-Forwarded-For / X-Real-IP.
	// If empty, forwarded headers are ignored and RemoteAddr is used as the client IP.
	TrustedProxyCIDRs []string
}

func Load() Config {
	port := getInt("PORT", 3001)
	env := getString("NODE_ENV", getString("ENV", "production"))

	catalogDatabaseURL := getString("CATALOG_DATABASE_URL", "")

	cachePrewarm := getBool("CACHE_PREWARM", true)
	cacheToken := getString("CACHE_REFRESH_TOKEN", "")
	cacheBuildTimeout := getDuration("CACHE_BUILD_TIMEOUT", 60*time.Second)
	redisURL := getString("REDIS_URL", "")
	redisKeyPrefix := getString("REDIS_KEY_PREFIX", "pokegonexus:pokemon:v1")
	redisCacheTTL := getDuration("REDIS_CACHE_TTL", 24*time.Hour)
	redisOpTimeout := getDuration("REDIS_OPERATION_TIMEOUT", 300*time.Millisecond)
	redisRevalidate := getDuration("REDIS_REVALIDATE_INTERVAL", 5*time.Second)
	redisBuildLockTTL := getDuration("REDIS_BUILD_LOCK_TTL", 2*time.Minute)
	redisBuildWait := getDuration("REDIS_BUILD_WAIT", 5*time.Second)

	origins := getString("ALLOWED_ORIGINS", "http://localhost:3000,https://pokegonexus.com,https://www.pokegonexus.com")
	allowed := splitCSV(origins)

	allowCF := getBool("ALLOW_CLOUDFLARE_SUBDOMAINS", true)

	logLevel := parseLogLevel(getString("LOG_LEVEL", "INFO"))

	// Pretty JSON: default on for non-production.
	jsonPretty := getBool("JSON_PRETTY", env != "production")

	rlEnabled := getBool("RATE_LIMIT_ENABLED", env == "production")
	rlRPS := getFloat("RATE_LIMIT_RPS", 5.0)
	rlBurst := getInt("RATE_LIMIT_BURST", 10)

	internalOnlyEnabled := getBool("INTERNAL_ONLY_ENABLED", env == "production")

	internalCIDRs := splitCSV(getString("INTERNAL_ONLY_CIDRS", "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::1/128,fd00::/8"))

	trustedProxyCIDRs := splitCSV(getString("TRUSTED_PROXY_CIDRS", ""))

	return Config{
		Port:                port,
		Env:                 env,
		CatalogDatabaseURL:  catalogDatabaseURL,
		CachePrewarm:        cachePrewarm,
		CacheRefreshToken:   cacheToken,
		CacheBuildTimeout:   cacheBuildTimeout,
		RedisURL:            redisURL,
		RedisKeyPrefix:      redisKeyPrefix,
		RedisCacheTTL:       redisCacheTTL,
		RedisOpTimeout:      redisOpTimeout,
		RedisRevalidate:     redisRevalidate,
		RedisBuildLockTTL:   redisBuildLockTTL,
		RedisBuildWait:      redisBuildWait,
		AllowedOrigins:      allowed,
		AllowCloudflareSub:  allowCF,
		LogLevel:            logLevel,
		JSONPretty:          jsonPretty,
		RateLimitEnabled:    rlEnabled,
		RateLimitRPS:        rlRPS,
		RateLimitBurst:      rlBurst,
		InternalOnlyEnabled: internalOnlyEnabled,
		InternalOnlyCIDRs:   internalCIDRs,
		TrustedProxyCIDRs:   trustedProxyCIDRs,
	}
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func getString(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func getFloat(key string, def float64) float64 {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return def
	}
	return f
}

func getBool(key string, def bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return def
	}
	switch v {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return def
	}
}

func getDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}

func parseLogLevel(s string) slog.Level {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "DEBUG":
		return slog.LevelDebug
	case "WARN", "WARNING":
		return slog.LevelWarn
	case "ERROR":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
