# Streamline

A complete multimedia streaming **plugin** for [Nuvio](https://nuvio.wiki) — a
port of **CineStream** (Cloudstream) released under the **Streamline** name.

## Plugin, not an addon

Nuvio finds streams through two independent systems:

| | Addons | Plugins (this repo) |
|---|---|---|
| Protocol | Stremio addon protocol (`catalog` / `meta` / `stream` HTTP endpoints) | Nuvio's own plugin repository format (`manifest.json` + provider scripts) |
| Where the logic runs | On the addon developer's remote server | **On your device**, inside Nuvio's sandboxed JS runtime |
| Scope | Catalogs, metadata, subtitles, streams | Streams only |
| Portability | Any Stremio-protocol client | Nuvio-specific |

Streamline is a **plugin**: Nuvio downloads `providers/streamline.js`, executes
it locally, and calls `getStreams(tmdbId, mediaType, season, episode)` for each
title. The provider scrapes its origins from the device and returns normalized
stream candidates. Install it under **Plugins** in Nuvio — putting a plugin URL
in the Addons section will error. Only sideloaded Nuvio builds support plugins;
app-store builds do not.

## Features

- **One provider, 20+ origins.** A single `Streamline` entry fans out to every
  enabled source concurrently (port of CineStream's `invokeAllSources`) and
  merges the results into one de-duplicated list.
- **Movies, series and anime.** TV requests pass season/episode through to each
  source; title-based anime (Anizone) needs no IMDb mapping.
- **Direct HTTP streams.** HLS/DASH/MP4/MKV links with the playback headers
  each host requires (`Referer`, `Origin`, auth cookies).
- **Subtitles attached per stream.** Built-in Stremio subtitle backends, plus
  optional Wyzie subtitles via your own API key, plus per-source captions
  (Videasy, Vidlink, VaPlayer, Anizone, …).
- **P2P magnets for Nuvio's native debrid.** Torrentio and TorrentsDB results
  are returned as magnets so Torbox/Premiumize linked in Nuvio resolve them
  on-device. Configure scraper addons in P2P mode as usual; Streamline only
  *supplies* the hashes.
- **CineStream settings, Nuvio-style.** Every source can be toggled, tokens can
  be pasted in, and fan-out concurrency is adjustable — all from the provider's
  settings screen (`onSettings`), mirroring the CineStream settings dialog.
- **Hermes/QuickJS-safe bundle.** `src/` is modern `async/await` ESM; `build.js`
  bundles it to generator-based CommonJS so it runs in Nuvio's runtime.

## Install in Nuvio

**Option A — GitHub raw (recommended)**

1. Push this repo (or your fork) to GitHub.
2. Copy your manifest URL:
   `https://raw.githubusercontent.com/<you>/Streamline/main/manifest.json`
3. In Nuvio: **Settings → Content & Discovery → Plugins → Add Repository**,
   paste the URL, refresh, and enable the **Streamline** provider.

**Option B — Account dashboard**

Log in on the Nuvio website → **Plugins → Add Plugin**, paste the same
manifest URL with the name `Streamline`, save, and let it sync to your devices.

**Option C — Local testing (Plugin Tester)**

```bash
bun run serve   # serves manifest.json + providers/ on :3000
```

In a Nuvio development build go to **Settings → Developer → Plugin Tester**,
load `http://<your-LAN-IP>:3000/manifest.json` (Repo Tester) or
`http://<your-LAN-IP>:3000/providers/streamline.js` (Individual Plugin), and
iterate with `bun build.js streamline`.

## Sources

Ported from `references/CSX/CineStream` (`ProviderRegistry`, with the
`CineStreamExtractors` scraper for each):

| Source | Module | Notes |
|---|---|---|
| Vidlink | `sources/vidlink.js` | Encoded TMDB lookup, quality map + captions |
| Videasy | `sources/videasy.js` | Seed + 11 servers, decrypt via enc-dec proxy |
| Hexa | `sources/hexa.js` | Random API key + capability token, server-side decrypt |
| Vidzee | `sources/vidzee.js` | AES-256-CBC link decrypt (crypto-js) |
| Vidrock | `sources/vidrock.js` | AES-256-GCM link decrypt (WebCrypto; skipped if unavailable) |
| VidFast | `sources/vidfast.js` | Page token → servers → per-server streams + subs |
| Vidcore | `sources/vidfast.js` | Same family, Vidcore endpoints/headers |
| VaPlayer | `sources/misc.js` | Single JSON API, M3U8 + default subs |
| PrimeSrc | `sources/misc.js` | Server list → per-key link resolve |
| ShowBox / FebBox | `sources/showbox.js` | Needs FebBox token (see Settings) |
| MovieBox | `sources/moviebox.js` | x-user token → search → download/play endpoints |
| AllMovieLand | `sources/allmovieland.js` | Player host discovery → playlist → per-server resolve |
| Cinejoy | `sources/cinejoy.js` | Encrypted `/g` exchange, multi-server |
| 4KHDHub | `sources/indian.js` | Title search → HubCloud / redirect-chain resolve |
| UHDMovies | `sources/indian.js` | Title+year search → shortlink bypass → hub resolve |
| MoviesMod | `sources/indian.js` | IMDb search → quality headers → bypass → hub resolve |
| MoviesDrive | `sources/indian.js` | IMDb JSON search → mdrive hub links |
| VegaMovies / RogMovies | `sources/indian.js` | Bollywood-aware (Rog for Indian titles, Vega otherwise) |
| Bollyflix | `sources/indian.js` | IMDb search → sidexfee unwrap → episode pages |
| Anizone | `sources/anime.js` | Title-based anime, multi-audio + subs |
| Torrentio / TorrentsDB | `torrents.js` | Stremio JSON → magnets (min-seed filtered) |
| Subtitles | `subs.js` | Stremio backends + Wyzie, attached to bare streams |

Shared HubCloud/VCloud terminals (FSL, Mega, Pixeldrain, 10Gbps, Buzz,
Gofile), the hrefli bypass and the redirect-chain decoder live in
`sources/hubcloud.js` (port of `Extractors.kt` / `CineStreamUtils.kt`).

Dynamic mirror domains resolve at runtime from the same `urls.json`
CineStream's `init()` loads, so host rotations rarely need a code change.

**Not ported:** Castle and MovieBlast require private keys CineStream keeps in
untracked `local.properties`, so they are intentionally absent rather than
shipped broken. Kitsu/MAL-mapped anime-only providers were reduced to the
title-based Anizone flow because Nuvio supplies TMDB ids.

## Settings

The provider settings screen exposes, in order: per-source toggles (general,
Indian mirrors, torrents), then:

| Key | Type | Purpose |
|---|---|---|
| `showboxToken` | text | FebBox `ui` token — the same token CineStream stores for ShowBox quality lists. ShowBox returns nothing without it. |
| `wyzieKey` | text | Optional Wyzie API key for extra subtitles alongside the built-in Stremio ones. |
| `concurrency` | select (2–10, default 6) | Max parallel sources per title. Lower it on slow networks. |

## Develop

```bash
bun install              # esbuild + runtime deps (cheerio, crypto-js)
bun build.js             # build all providers: src/<id>/ -> providers/<id>.js
bun build.js streamline
bun run test             # 13 offline tests: exports, settings, manifest,
                         # Hermes-safety, AES-CBC/GCM round-trips
                         # (use `bun run test`, not `bun test` — the latter
                         # invokes Bun's own test runner)
LIVE=1 bun run test      # + live movie + TV checks against real sources
bun run serve            # static server for the in-app Plugin Tester
```

Rules that keep the bundle working in Nuvio:

- Edit **`src/`**, never `providers/` by hand — it is build output (committed
  because Nuvio loads it directly via the manifest URL).
- One folder per provider under `src/` with an `index.js` exporting
  `getStreams`; extra modules are bundled automatically.
- Only `fetch`, `cheerio-without-node-native` and `crypto-js` exist at
  runtime (see `build.js` externals). No Node builtins, no `Buffer`.
- Every source must fail soft: catch internally and return `[]` so one dead
  origin never breaks the merged list.

```
manifest.json               # plugin repository manifest (points at providers/)
src/streamline/
  index.js                  # getStreams fan-out + onSettings blueprint
  constants.js              # static APIs (port of ApiConstants.kt) + urls.json
  tmdb.js                   # TMDB meta resolution (title/year/IMDb/countries)
  utils.js                  # fetch, quality labels, stream shaping, concurrency
  subs.js torrents.js       # subtitle + magnet aggregation
  sources/                  # one module per origin (see table above)
providers/streamline.js     # built artifact — this is what Nuvio downloads
test-streamline.js          # offline unit tests + opt-in live tests
build.js server.js package.json
references/CSX/             # upstream reference, not shipped to Nuvio
```

### Verified behavior

- `bun build.js streamline` → 90 KB bundle, zero raw `await` (esbuild
  `__async` generators), `getStreams` + `onSettings` exported.
- `bun run test` → 13/13 offline tests green.
- Live (run pre-release): 35 streams for a TMDB movie across Vidlink,
  Videasy, Vidfast, VaPlayer, MovieBox, 4KHDHub and VegaMovies; 10 for a TV
  S01E01 via Hexa and Vidfast.

## Troubleshooting

- **No streams for a title** — disable slow/broken origins in provider
  settings, raise concurrency on fast networks, and check the title resolves
  on TMDB (sources keyed on IMDb/title depend on that lookup).
- **ShowBox empty** — it requires `showboxToken`; without it the source
  returns nothing by design.
- **Plugin URL errors in Nuvio** — plugins go in the **Plugins** section, not
  Addons; use a sideloaded build, since store builds disable plugins.
- **A mirror died** — most Indian hosts re-resolve via `urls.json`; if the
  page layout itself changed, the corresponding module in
  `src/streamline/sources/` needs updating, then rebuild.

## Contributing

1. Fork, create a branch, add or fix a module under `src/streamline/sources/`
   (keep the `scrape(ctx) → streams[]` shape and fail-soft contract).
2. Register toggles in `onSettings` if you add a source.
3. Run `bun build.js streamline` and `bun run test` (plus `LIVE=1 bun run test` if
   you touched network code).
4. Commit `src/`, `providers/streamline.js` and `manifest.json` together —
   Nuvio serves the built file, so all three must stay in sync — and open a PR.

## Legal

Streamline ships no content and hosts nothing. Like the upstream project, each
provider behaves as an ordinary client fetching publicly reachable pages and
APIs; what you access with it is your responsibility under your jurisdiction's
laws. The reference code under `references/` belongs to its authors and is
included for porting reference under its GPL-3.0 terms.

## License

GPL-3.0-only, matching the upstream CineStream/CSX licensing.
