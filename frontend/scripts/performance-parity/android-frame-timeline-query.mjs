export const buildAndroidFrameTimelineQuery = (layerMatch) => {
  if (!/^[A-Za-z0-9._/-]+$/.test(layerMatch)) {
    throw new Error(`Unsafe FrameTimeline layer match: ${layerMatch}`);
  }
  // Perfetto's PERCENTILE takes a percentage from 0 to 100, not a fraction.
  // https://perfetto.dev/docs/getting-started/android-trace-analysis
  return `
    WITH target AS (
      SELECT layer_name
      FROM actual_frame_timeline_slice
      WHERE layer_name LIKE '%${layerMatch}%'
      GROUP BY layer_name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ), frames AS (
      SELECT dur / 1e6 AS duration_ms, jank_type, layer_name
      FROM actual_frame_timeline_slice
      JOIN target USING(layer_name)
    )
    SELECT json_object(
      'frameCount', COUNT(*),
      'frameTimeP95Ms', PERCENTILE(duration_ms, 95),
      'frameTimePercentile', 95,
      'jankyFramesPercent', 100.0 * SUM(jank_type != 'None') / COUNT(*),
      'layerName', MIN(layer_name)
    ) AS result
    FROM frames;
  `;
};
