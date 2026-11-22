package cache

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func redisCacheConfig(name string, store PayloadStore, build func(context.Context) (any, error)) JSONGzipCacheConfig {
	return JSONGzipCacheConfig{
		Name:                    name,
		BuildPayload:            build,
		Store:                   store,
		StoreTTL:                time.Hour,
		StoreOperationTimeout:   500 * time.Millisecond,
		StoreRevalidateInterval: time.Hour,
		StoreBuildLockTTL:       time.Minute,
		StoreBuildWait:          2 * time.Second,
	}
}

func TestJSONGzipCacheRestoresPayloadFromRedisAcrossReplicas(t *testing.T) {
	store, _ := newTestRedisStore(t)
	var firstBuilds atomic.Int32
	first := NewJSONGzipCache(redisCacheConfig("/pokemon/catalog", store, func(context.Context) (any, error) {
		firstBuilds.Add(1)
		return map[string]any{"version": 1}, nil
	}))
	if err := first.EnsureBuilt(context.Background()); err != nil {
		t.Fatalf("first EnsureBuilt: %v", err)
	}

	var secondBuilds atomic.Int32
	second := NewJSONGzipCache(redisCacheConfig("/pokemon/catalog", store, func(context.Context) (any, error) {
		secondBuilds.Add(1)
		return map[string]any{"version": 2}, nil
	}))
	if err := second.EnsureBuilt(context.Background()); err != nil {
		t.Fatalf("second EnsureBuilt: %v", err)
	}

	if firstBuilds.Load() != 1 || secondBuilds.Load() != 0 {
		t.Fatalf("unexpected PostgreSQL builds: first=%d second=%d", firstBuilds.Load(), secondBuilds.Load())
	}
	stats := second.Stats()
	if stats.LastSource != "redis" || stats.L2HitCount != 1 || stats.BuildCount != 0 {
		t.Fatalf("unexpected Redis restore stats: %+v", stats)
	}
	if second.Stats().ETag != first.Stats().ETag {
		t.Fatalf("replicas have different ETags: first=%q second=%q", first.Stats().ETag, second.Stats().ETag)
	}
}

func TestJSONGzipCacheFallsBackWhenRedisIsUnavailable(t *testing.T) {
	store, server := newTestRedisStore(t)
	server.Close()

	var builds atomic.Int32
	cfg := redisCacheConfig("/pokemon/catalog", store, func(context.Context) (any, error) {
		builds.Add(1)
		return map[string]any{"available": true}, nil
	})
	cfg.StoreOperationTimeout = 50 * time.Millisecond
	cfg.StoreBuildWait = 100 * time.Millisecond
	c := NewJSONGzipCache(cfg)

	if err := c.EnsureBuilt(context.Background()); err != nil {
		t.Fatalf("EnsureBuilt should fall back to PostgreSQL: %v", err)
	}
	stats := c.Stats()
	if builds.Load() != 1 || !stats.HasCache || stats.LastSource != "postgres" {
		t.Fatalf("fallback did not build a usable L1 payload: builds=%d stats=%+v", builds.Load(), stats)
	}
	if stats.L2ErrorCount == 0 {
		t.Fatalf("expected Redis errors to be observable: %+v", stats)
	}
}

func TestJSONGzipCacheKeepsServingWarmMemoryWhenRedisStops(t *testing.T) {
	store, server := newTestRedisStore(t)
	var builds atomic.Int32
	cfg := redisCacheConfig("/pokemon/moves", store, func(context.Context) (any, error) {
		builds.Add(1)
		return map[string]any{"move": "Vine Whip"}, nil
	})
	cfg.StoreOperationTimeout = 50 * time.Millisecond
	c := NewJSONGzipCache(cfg)

	if err := c.EnsureBuilt(context.Background()); err != nil {
		t.Fatalf("initial EnsureBuilt: %v", err)
	}
	warmETag := c.Stats().ETag
	c.lastStoreCheck = time.Time{}
	server.Close()

	if err := c.EnsureBuilt(context.Background()); err != nil {
		t.Fatalf("warm EnsureBuilt should tolerate Redis outage: %v", err)
	}
	stats := c.Stats()
	if builds.Load() != 1 || !stats.HasCache || stats.ETag != warmETag {
		t.Fatalf("warm L1 was not preserved: builds=%d stats=%+v", builds.Load(), stats)
	}
	if stats.L1HitCount == 0 || stats.L2ErrorCount == 0 {
		t.Fatalf("expected an observable L1 fallback after Redis failure: %+v", stats)
	}
}

func TestJSONGzipCacheInvalidationReachesAnotherReplica(t *testing.T) {
	store, _ := newTestRedisStore(t)
	first := NewJSONGzipCache(redisCacheConfig("/pokemon/catalog", store, func(context.Context) (any, error) {
		return map[string]any{"version": 1}, nil
	}))
	if err := first.EnsureBuilt(context.Background()); err != nil {
		t.Fatalf("first EnsureBuilt: %v", err)
	}

	var secondBuilds atomic.Int32
	cfg := redisCacheConfig("/pokemon/catalog", store, func(context.Context) (any, error) {
		secondBuilds.Add(1)
		return map[string]any{"version": 2}, nil
	})
	second := NewJSONGzipCache(cfg)
	if err := second.EnsureBuilt(context.Background()); err != nil {
		t.Fatalf("second Redis restore: %v", err)
	}
	oldETag := second.Stats().ETag

	first.Invalidate()
	second.lastStoreCheck = time.Time{}
	if err := second.EnsureBuilt(context.Background()); err != nil {
		t.Fatalf("second rebuild after cross-replica invalidation: %v", err)
	}
	if secondBuilds.Load() != 1 {
		t.Fatalf("expected one rebuild after invalidation, got %d", secondBuilds.Load())
	}
	if second.Stats().ETag == oldETag || second.Stats().LastSource != "postgres" {
		t.Fatalf("stale replica was not replaced: old=%q new=%q stats=%+v", oldETag, second.Stats().ETag, second.Stats())
	}
}

func TestJSONGzipCacheRedisLockPreventsCrossReplicaStampede(t *testing.T) {
	store, _ := newTestRedisStore(t)
	var builds atomic.Int32
	buildStarted := make(chan struct{})
	releaseBuild := make(chan struct{})
	var startOnce sync.Once
	build := func(context.Context) (any, error) {
		builds.Add(1)
		startOnce.Do(func() { close(buildStarted) })
		<-releaseBuild
		return map[string]any{"version": 1}, nil
	}

	first := NewJSONGzipCache(redisCacheConfig("/pokemon/raid-data", store, build))
	second := NewJSONGzipCache(redisCacheConfig("/pokemon/raid-data", store, build))
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	results := make(chan error, 2)
	go func() { results <- first.EnsureBuilt(ctx) }()
	select {
	case <-buildStarted:
	case <-ctx.Done():
		t.Fatal("first replica did not begin building")
	}
	go func() { results <- second.EnsureBuilt(ctx) }()
	time.Sleep(150 * time.Millisecond)
	if builds.Load() != 1 {
		t.Fatalf("second replica built while Redis lock was held: builds=%d", builds.Load())
	}
	close(releaseBuild)

	for range 2 {
		if err := <-results; err != nil {
			t.Fatalf("EnsureBuilt: %v", err)
		}
	}
	if builds.Load() != 1 {
		t.Fatalf("expected one PostgreSQL build across replicas, got %d", builds.Load())
	}
	if first.Stats().ETag == "" || first.Stats().ETag != second.Stats().ETag {
		t.Fatalf("replicas did not converge: first=%q second=%q", first.Stats().ETag, second.Stats().ETag)
	}
}
