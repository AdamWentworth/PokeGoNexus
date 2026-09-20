#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';

const logPaths = process.argv.slice(2);
if (logPaths.length === 0) {
  console.error('Usage: node scripts/assert-native-collection-performance.mjs <device-logcat.txt> [...]');
  process.exit(2);
}

const readInteractionLatencies = (text, event) => {
  const eventPattern = new RegExp(`\\[mobile:ui-perf\\] ${event}(?![a-zA-Z0-9_])`, 'g');
  return [...text.matchAll(eventPattern)].flatMap((match) => {
    const block = text.slice(match.index, match.index + 1_200).split('\n').slice(0, 6).join('\n');
    const latency = block.match(/interactionLatencyMs:\s*(\d+)/);
    return latency ? [Number(latency[1])] : [];
  });
};

// These are end-to-end JS dispatch ceilings, not the visual animation
// durations. The overlay transform itself is pinned to the shared Vite
// contract (120 ms exit handoff and 220 ms entrance) and runs on Android's UI
// thread. Its completion/route callbacks must cross back through Hermes and
// can arrive several software-emulator frames later than the presentation.
// Keep enough dispatch headroom for the repository's SwiftShader AVD while
// still failing a genuinely stalled route handoff.
const budgets = {
  collection_search_menu_painted: 150,
  collection_sort_menu_painted: 200,
  collection_filter_result_revealed: 200,
  collection_tag_slide_started: 32,
  // Includes the ordinary physical press interval plus hidden destination
  // preparation. This closes the blind spot where onPress-to-motion was fast
  // but synchronous press-in work made the tap itself feel unresponsive.
  collection_tag_touch_to_slide_started: 220,
  collection_tag_header_indicator_started: 32,
  collection_tag_result_painted: 150,
  collection_query_result_painted: 200,
  // IME delivery and the post-layout rAF both share the software-rendered AVD
  // thread. Real result computation is prefix-cached; allow emulator dispatch
  // jitter while still rejecting a visibly stalled quarter-second-plus paint.
  collection_typed_query_result_painted: 250,
  collection_projection_viewport_images_revealed: 1200,
  collection_projection_images_revealed: 3000,
  collection_sort_result_painted: 150,
  collection_evolution_result_painted: 150,
  instance_overlay_exit_finished: 220,
  instance_overlay_target_committed: 280,
  instance_overlay_entrance_started: 280,
  instance_overlay_navigation_finished: 600,
  instance_edit_result_painted: 150,
  instance_save_result_painted: 150,
  collection_clear_tag_dialog_painted: 150,
  collection_selection_painted: 150,
  collection_organizer_painted: 200,
};
const performanceTargets = {
  collection_sort_menu_painted: 150,
  collection_filter_result_revealed: 100,
  collection_query_result_painted: 150,
  instance_overlay_navigation_finished: 550,
  collection_tag_touch_to_slide_started: 180,
};
const measurements = Object.fromEntries(Object.keys(budgets).map((event) => [event, []]));
const latestOnlyEvents = new Set(['collection_typed_query_result_painted']);

for (const logPath of logPaths) {
  const text = fs.readFileSync(logPath, 'utf8');
  for (const event of Object.keys(budgets)) {
    const values = readInteractionLatencies(text, event);
    measurements[event].push(...(
      latestOnlyEvents.has(event) && values.length > 0 ? [values.at(-1)] : values
    ));
  }
}

const failures = [];
for (const [event, budget] of Object.entries(budgets)) {
  const values = measurements[event];
  if (values.length === 0) {
    failures.push(`${event}: no production-mode Android measurement was recorded`);
    continue;
  }
  const maximum = Math.max(...values);
  const qualifier = latestOnlyEvents.has(event) ? ' (latest sequential input)' : '';
  const target = performanceTargets[event] ?? budget;
  const thresholdLabel = target === budget
    ? `budget ${budget} ms`
    : `target ${target} ms; hard ceiling ${budget} ms`;
  console.log(`${event}: ${values.join(', ')} ms${qualifier} (${thresholdLabel})`);
  if (maximum > budget) {
    failures.push(`${event}: ${maximum} ms exceeded the ${budget} ms budget`);
  } else if (maximum > target) {
    console.warn(`WARN: ${event}: ${maximum} ms exceeded the ${target} ms target`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
