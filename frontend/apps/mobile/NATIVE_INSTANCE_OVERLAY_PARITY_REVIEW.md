# Native instance overlay parity — 2026-09-13

Code candidate: `f7625693` on `mobile/native-migration`.

## Repairs

| Reported mismatch | Cause and resulting behavior |
| --- | --- |
| CP arc | Native drew a fixed 300px white semicircle. The replacement follows Vite's responsive width, elliptical height, baseline and CPM progress, with a grey remaining segment and a constant 10px circular dot. Measured header/panel positions accommodate the editor and background selector. |
| Wrong ball on the orange ribbon | Native used a regular inventory Poké Ball. It now uses `/media/images/caught.png`, with Vite's left-rounded ribbon, compact date typography and year separator. |
| Missing ball in the lower frame | The read-only caught card omitted the image entirely. It now shows the recorded ball at the card's upper right, including a card with only a ball recorded. Native editing and Vite also share canonical/legacy filename resolution and Beast/Safari sizing. Unknown ball values do not invent a recorded ball. |
| Shadow Mega eligibility | The editor excluded Shadow Pokémon but the read-only eligibility badge did not. Both views now suppress the affordance for unpurified Shadow Pokémon, while allowing eligible Purified Pokémon, including records with both legacy flags set. |

The initial physical check exposed Android SVG clipping at maximum level despite
`overflow: visible`. The final component includes a 6px viewport gutter around
the actual ellipse so the full dot and rounded stroke fit within Android's canvas.
The additional measured-header container retains the original centered Wanted layout.

Canonical sources are Vite's `LevelArc.tsx`, `LevelArc.css`, `useArcHeight.ts`,
`CaughtDateRibbon.tsx`, `MetaPanelFields.tsx`, and `MetaPanel.css` under the instance
feature. The existing 448px Vite account captures provide the visual reference;
no new presentation videos or Phlosion assets are included in this repair.

## Validation

- 53 native tests pass across the instance screen, arc and combat-power suites.
  They cover Shadow/Purified eligibility in both views, draft transitions, caught
  and trade ball cards, legacy aliases, unknown balls, levels 1/20/40/50/51,
  intermediate CPM interpolation, responsive widths 320/448/600/1024, and dot bounds.
- Five Vite ball/arc-layout tests pass. Both app typechecks and targeted lint pass.
- On the final APK, light-theme Mewtwo (level 50) and Shadow Salamence (level 40)
  show full, unclipped dots, the corrected ribbon, and recorded Premier Balls.
  Salamence shows a grey arc remainder and no Mega eligibility badge.
- Final dark-theme captures confirm level-50 Mewtwo, level-15 Snorlax's longer
  grey remainder, and the recorded Beast Ball on the location-background Necrozma
  instance. Trade and Wanted frames retain their layout; the Wanted conditions
  header remains centered and neither missing-level nor Wanted entries gain an arc.
- The physical editor workflow verifies Shadow → Purified → Shadow: Mega Evolve
  is absent, appears, then disappears. Closing without saving and reopening
  confirms the instance is still Shadow. No collection edits were submitted.

The final account workflow passes 2249 caught, 167 Favorites, automatic Favorite
sorting descending, and first CP values 4713/4689/4688, without a sync warning.
The phone is left on Favorites in the dark theme observed at the start of this
repair. Sampled final app logs contain no fatal, sync, released-object or database
prepare failure markers and no UI performance probe lines. These are targeted
functional checks, not a new whole-app performance or lifecycle approval.

## Artifact identity

Normal APK: `.artifacts/manual-standalone/PokeGoNexus-manual-f7625693-arm64-v8a.apk`.

SHA-256: `dd69c79d8c345f3cf55041d0ae268f0d05bb21884d42d4c68deb578ddf2acc97`.

The installed checksum matches. Package `com.pokegonexus.app`, signing identity,
session and collection are preserved; device fixtures and UI timing probes are
disabled. The bounded local build completed in 80.2 seconds.

Private evidence is in `.artifacts/instance-overlay-final-2026-09-13/`:
`installation.json`, `build-identity.json`, `phone-light/`, and
`maestro-shadow-draft/`, `phone-dark/`, `maestro-final-account/`, and `final-checks.json`. Initial reproductions and the intermediate Android
clipping diagnosis are in `.artifacts/instance-overlay-parity-2026-09-13/`.
These artifacts contain account information and are not committed.
