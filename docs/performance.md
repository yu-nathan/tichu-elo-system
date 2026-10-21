# Initial-load performance — October 21, 2026

The first optimization pass was measured locally in the Tichu Elo System
checkout on `main`, based on `a8f028d72ca8edbe49dd98e9288d28d69c3cf512`,
preserving the existing season-settings work. The tables below retain that
baseline and distinguish it from the subsequent streaming pass.

## Results

- Fresh-load transfer fell from **4.76 MB to 1.41 MB**
  (**70.3% less**), including artwork and the idle profile preload.
- JavaScript requests initiated before the window load event fell from
  **319.7 KB to 218.1 KB** (**31.8% less**).
  The profile/chart chunk now loads on intent or idle time. It is deferred, not
  eliminated: total JavaScript transfer after idle loading remains about 324 KB.
- The 12 seasonal images fell from **29,697,755 to 6,598,234 bytes**
  (**77.8% less**). All dimensions and every alpha-channel pixel are unchanged.
  The two Halloween images fell from 4,360,240 to 1,008,712 bytes.
- Local first-paint and largest-paint times were broadly unchanged. These samples
  demonstrate download savings and deferred code, not a proven improvement to
  every visible-loading metric or hosted cold-start latency.
- The dashboard cache uses one validity/snapshot query on hits and skips game
  replay. A local timing-header check measured 8 ms for a rebuild and 2 ms for a
  hit; these are individual data-loading samples, excluding SSR and network time.

## Measurement method

Each dataset has five fresh-browser-cache visits and five repeat visits for each
of desktop (1440 × 1000) and simulated mobile (390 × 844, 4× CPU slowdown,
150 ms configured network latency, 200 KB/s download). Measurements use local
Chrome, `America/Los_Angeles`, and the current automatic Halloween theme.
Fresh/repeat refers to the browser cache, not guaranteed Worker or database cold
starts. Local runs use production builds and the same local data, including the
pending season-settings changes. The live site has its own deployed code and data.

The collector observes three seconds after window load and then waits for network
idle, including decorative images and idle profile downloads. JavaScript time is
Chrome's per-document `ScriptDuration`, not time-to-interactive. CLS is unitless;
MB and KB are decimal. Tables show **median [minimum–maximum]**. Browser timing is
noisy, especially at the small millisecond values seen on localhost.

## Local production build: before and after

| Sample                  |  First byte (ms) |    First paint (ms) |  Largest paint (ms) |   JS execution (ms) |                    CLS |       Transfer (MB) |
| ----------------------- | ---------------: | ------------------: | ------------------: | ------------------: | ---------------------: | ------------------: |
| desktop, fresh, before  | 13.5 [12.3–22.9] |    60.0 [48.0–96.0] |    60.0 [48.0–96.0] |    48.7 [47.9–52.5] | 0.0030 [0.0030–0.0030] | 4.759 [4.759–4.759] |
| desktop, fresh, after   |   8.8 [8.5–10.8] |    48.0 [44.0–72.0] |    48.0 [44.0–72.0] |    46.9 [46.6–48.5] | 0.0030 [0.0030–0.0030] | 1.412 [1.412–1.412] |
| desktop, repeat, before | 12.4 [11.1–14.1] |    40.0 [32.0–48.0] |    40.0 [32.0–48.0] |    18.5 [18.4–23.3] | 0.0030 [0.0030–0.0030] | 0.013 [0.013–0.013] |
| desktop, repeat, after  |  10.8 [8.5–20.8] |    36.0 [32.0–44.0] |    36.0 [32.0–44.0] |    18.0 [17.4–18.8] | 0.0030 [0.0030–0.0030] | 0.012 [0.012–0.012] |
| mobile, fresh, before   | 12.9 [12.4–31.1] | 732.0 [724.0–752.0] | 732.0 [724.0–752.0] | 212.7 [199.5–297.0] | 0.0000 [0.0000–0.0000] | 4.759 [4.759–4.759] |
| mobile, fresh, after    |  10.5 [9.2–30.3] | 740.0 [732.0–740.0] | 740.0 [732.0–740.0] | 218.1 [214.1–222.6] | 0.0000 [0.0000–0.0000] | 1.412 [1.412–1.412] |
| mobile, repeat, before  | 12.5 [12.1–12.9] | 196.0 [196.0–200.0] | 220.0 [216.0–228.0] |    82.2 [81.2–90.6] | 0.0000 [0.0000–0.0000] | 0.013 [0.013–0.013] |
| mobile, repeat, after   |  10.2 [9.0–11.1] | 204.0 [188.0–212.0] | 232.0 [220.0–240.0] |    83.3 [79.6–84.1] | 0.0000 [0.0000–0.0000] | 0.012 [0.012–0.012] |

## Live production baseline — unchanged site

These are read-only baseline measurements, **not results from deploying this
change**. They must not be compared directly with localhost to estimate a release
speedup. Hosting and network variability remain outside the measured local work.

| Sample          |      First byte (ms) |       First paint (ms) |     Largest paint (ms) |   JS execution (ms) |                    CLS |       Transfer (MB) |
| --------------- | -------------------: | ---------------------: | ---------------------: | ------------------: | ---------------------: | ------------------: |
| desktop, fresh  | 617.4 [206.1–1026.5] |   784.0 [304.0–1168.0] |   784.0 [304.0–1168.0] |    74.8 [71.8–80.7] | 0.0022 [0.0022–0.0022] | 4.761 [4.761–4.761] |
| desktop, repeat |  207.7 [165.7–413.2] |    320.0 [256.0–524.0] |    320.0 [256.0–524.0] |    21.4 [20.7–22.3] | 0.0022 [0.0022–0.0022] | 0.019 [0.019–0.019] |
| mobile, fresh   |  464.8 [303.6–628.6] | 1276.0 [1108.0–1780.0] | 1276.0 [1108.0–1780.0] | 320.3 [315.6–329.1] | 0.0000 [0.0000–0.0000] | 4.761 [4.761–4.761] |
| mobile, repeat  | 215.0 [155.2–1252.1] |   460.0 [412.0–1472.0] |   460.0 [412.0–1472.0] |    91.7 [89.6–99.1] | 0.0000 [0.0000–0.0000] | 0.019 [0.019–0.019] |

## Validation and release notes

- 132 unit/database tests passed, including atomic API game invalidation,
  idempotent replay, rollback, concurrent rebuilds, rollover, settings changes,
  binding isolation, expiry, corruption, and bounded failure under continuous writes.
- 41 browser tests passed: 34 existing UI regressions and seven focused production
  tests. One pre-existing history-pagination test remains skipped; the separate
  player-history pagination/retry test passed.
- Focused checks cover hover, keyboard focus, idle preload, direct click, failed
  speculative downloads, shared requests, stable modal geometry, refresh invalidation,
  and owner/anonymous isolation. Existing UI tests cover all seasonal themes on
  desktop/mobile, artwork failure, accessibility interactions, and admin behavior.
- The broad production UI suite supplied synthetic owner headers through a
  localhost-only test harness, matching the development suite's owner context.
  Focused anonymous/owner isolation tests used separate ordinary contexts. This
  does not constitute a new live sign-in verification.
- Type checking, production build, changed-file Prettier checks, and
  `git diff --check` passed. WebP hashing, file size, dimensions, and pixel-exact
  transparency are verified by an automated asset test. Desktop/mobile screenshots
  were also inspected.

Apply `0007_dashboard_cache.sql` after `0006_season_cadence.sql`; the new migration
was applied only to the local database. The server cache never stores personalized
controls or authorization. HTML and dashboard API responses remain `no-store`.
Successful browser or external API game writes advance the cache revision in the
same database transaction. Already-open pages refresh through their existing
refresh/focus behavior; this change does not add push updates.

Caching improves hits; misses still perform the calculation and snapshot writes.
The subsequent streaming pass is described below. Production migration and
publishing were authorized after the initial local measurements. See [development instructions](development.md)
for migrations and reproducible measurements.

Raw evidence is retained locally under `web/outputs/performance/` (Git-ignored):
`local-before.json`, `local-after.json`, `live-baseline.json`, test/build logs,
the localhost-only browser harness, and Halloween desktop/mobile screenshots.

## Streaming and deferred mobile panels

The homepage now streams a public loading layout before its asynchronous data
and authentication work finishes. Standings still arrive as server-rendered
content. The homepage-only boundary leaves admin redirects unchanged.
Matchmaker and History load after hydration on desktop, or on first tab selection
on mobile; mounted panels retain their state across tab changes and resizing.
A failed panel download shows a reload action without disabling the leaderboard.

Final validation: 132 unit/database tests and 45 browser tests passed (34 existing
UI checks plus 11 focused loading checks). One pre-existing browser test remains
skipped. Type checking, production build, formatting, and diff checks passed.
The HTTP test verifies that the public shell arrives in an earlier response
chunk than resolved dashboard controls. Browser tests verify excluded mobile
panel requests, single downloads, preserved state, resize behavior, and failure
recovery. Seasonal checks preserve pre-hydration palettes and heading geometry.

The release includes the pending season-cadence settings and its migration,
followed by the dashboard cache migration. It does not change the five-minute
snapshot lifetime or introduce background warming or smaller mobile atlases.

Final local production-build measurements (same method; median [range]):

| Sample          | First byte (ms) |    First paint (ms) |  Largest paint (ms) |   JS execution (ms) |                    CLS |       Transfer (MB) |
| --------------- | --------------: | ------------------: | ------------------: | ------------------: | ---------------------: | ------------------: |
| desktop, fresh  | 10.1 [8.1–15.5] |    64.0 [36.0–68.0] |    64.0 [36.0–68.0] |    50.9 [50.5–51.1] | 0.0002 [0.0002–0.0002] | 1.420 [1.420–1.420] |
| desktop, repeat | 10.1 [9.3–12.6] |    40.0 [40.0–44.0] |    40.0 [40.0–44.0] |    19.0 [15.5–20.6] | 0.0002 [0.0002–0.0002] | 0.012 [0.012–0.012] |
| mobile, fresh   |   8.6 [8.1–9.3] | 748.0 [744.0–756.0] | 748.0 [744.0–756.0] | 190.6 [187.8–193.6] | 0.0000 [0.0000–0.0000] | 1.400 [1.400–1.400] |
| mobile, repeat  |  8.4 [7.9–15.5] | 216.0 [204.0–216.0] | 332.0 [316.0–340.0] |    74.0 [64.1–75.1] | 0.0000 [0.0000–0.0000] | 0.012 [0.012–0.012] |

Compared with the first optimization pass, fresh mobile JavaScript execution
fell from a median of 218.1 ms to 190.6 ms. Fresh mobile paint was broadly
unchanged (740 ms to 748 ms). Repeat mobile largest paint increased from 232 ms
to 332 ms as resolved content replaces the streamed shell; repeat first paint
remained similar. Streaming is not a demonstrated across-the-board paint win
on localhost, where the database wait is short. Hosted results must be assessed
separately. Raw final local samples: `web/outputs/performance/local-streaming.json`.

## Production release

Sites version **46** deployed successfully to
<https://tichu-elo.nyu1997.chatgpt.site> on October 21, 2026.

- GitHub application commit: `00cf8b3cf64bbafc88205c0d7a1ffabeec51c5b4` on `main`.
- Sites source commit: `425ce9d4780f67cc28636d75f73f508627776869`.
- Both have the identical web-source tree: `088075097359d6ab26d7fc4635aed839709d1096`.
- Deployment: `appgdep_6ad896dedcf48191a7b19856da161dc7`.
- Public audience and D1 binding `DB` were preserved.

The live database exposes `season_settings`, `dashboard_revision`, and
`dashboard_snapshot` after deployment. Public homepage and dashboard requests
returned 200 with `no-store`; anonymous HTML contained sign-in controls and no
Manage control. Two repeated dashboard API requests reported cache reads only
(40 ms and 31 ms), confirming snapshot hits without replay in those samples.
These are data-loading timings, not full-page timings. No production game or
player records were written during verification.

Live after deployment, five fresh and five repeat samples per device:

| Sample          |    First byte (ms) |       First paint (ms) |     Largest paint (ms) |   JS execution (ms) |                    CLS |       Transfer (MB) |
| --------------- | -----------------: | ---------------------: | ---------------------: | ------------------: | ---------------------: | ------------------: |
| desktop, fresh  | 214.8 [82.0–938.2] |   328.0 [196.0–1132.0] |   328.0 [196.0–1164.0] |    79.3 [77.1–83.8] | 0.0000 [0.0000–0.0002] | 1.420 [1.420–1.420] |
| desktop, repeat |  57.6 [48.8–699.2] |   140.0 [132.0–1428.0] |   172.0 [164.0–1428.0] |    28.6 [24.7–29.6] | 0.0000 [0.0000–0.0000] | 0.021 [0.021–0.021] |
| mobile, fresh   | 154.8 [84.2–237.5] | 1124.0 [1104.0–1140.0] | 1124.0 [1104.0–1140.0] | 293.3 [282.0–307.2] | 0.0000 [0.0000–0.0000] | 1.401 [1.401–1.401] |
| mobile, repeat  |  75.0 [52.7–700.5] |   436.0 [416.0–1420.0] |   436.0 [416.0–1420.0] |    76.5 [72.7–78.9] | 0.0000 [0.0000–0.0000] | 0.020 [0.020–0.020] |

These live before/after samples include the complete release: WebP artwork,
profile preloading, the dashboard cache, streaming, and deferred panels. They
cannot isolate the benefit of streaming alone. Fresh desktop first paint fell
from 784 ms to 328 ms; fresh mobile first paint fell from 1276 ms to 1124 ms.
Fresh transferred bytes fell from approximately 4.76 MB to 1.42 MB on desktop
and 1.40 MB on mobile. Slow repeat-request outliers remain (largest paint up to
1428 ms desktop and 1420 ms mobile), so this is not a latency guarantee.
Raw live samples: `web/outputs/performance/live-after.json`.

Live anonymous browser smoke checks passed at 390px and 1440px: profiles open,
Matchmaker and History render, hidden mobile panels avoid early downloads, and
no page errors were reported. These checks did not exercise a real signed-in
owner session or create production games; those boundaries were covered by the
local regression suites described above.
