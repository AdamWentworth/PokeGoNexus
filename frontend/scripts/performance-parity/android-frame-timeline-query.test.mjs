import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { buildAndroidFrameTimelineQuery } from './android-frame-timeline-query.mjs';

test('reports the upper-tail frame percentile from the app content layer', () => {
  const db = new DatabaseSync(':memory:');
  try {
    // SQLite does not enable Perfetto's aggregate by default. Register its
    // documented 0–100, linearly interpolated percentile contract for this
    // known-value dataset; the production SQL itself runs unchanged.
    db.aggregate('PERCENTILE', {
      start: '[]',
      step: (state, value, percentage) => JSON.stringify([
        ...JSON.parse(state), [value, percentage],
      ]),
      result: (state) => {
        const entries = JSON.parse(state);
        if (!entries.length) return null;
        const values = entries.map(([value]) => value).sort((a, b) => a - b);
        const index = (values.length - 1) * entries[0][1] / 100;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        return values[lower] + (values[upper] - values[lower]) * (index - lower);
      },
    });
    db.exec('CREATE TABLE actual_frame_timeline_slice (dur REAL, jank_type TEXT, layer_name TEXT)');
    const insert = db.prepare('INSERT INTO actual_frame_timeline_slice VALUES (?, ?, ?)');
    for (let milliseconds = 0; milliseconds <= 100; milliseconds++) {
      insert.run(milliseconds * 1e6, milliseconds % 20 ? 'None' : 'App Deadline Missed',
        'com.pokegonexus.app/MainActivity');
    }
    insert.run(999e6, 'None', 'com.pokegonexus.app/OtherSurface');
    insert.run(999e6, 'None', 'another.app/MainActivity');

    const metrics = JSON.parse(db.prepare(buildAndroidFrameTimelineQuery('com.pokegonexus.app')).get().result);
    assert.equal(metrics.frameCount, 101);
    assert.equal(metrics.frameTimeP95Ms, 95);
    assert.equal(metrics.frameTimePercentile, 95);
    assert.equal(metrics.layerName, 'com.pokegonexus.app/MainActivity');
    assert.ok(Math.abs(metrics.jankyFramesPercent - 600 / 101) < 1e-10);
  } finally {
    db.close();
  }
});

test('rejects a layer name that could alter the trace query', () => {
  assert.throws(() => buildAndroidFrameTimelineQuery("app' OR 1=1 --"), /Unsafe/);
});
