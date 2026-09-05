# Streamline

A complete multimedia streaming **plugin** for [Nuvio](https://nuvio.wiki) — a
port of **CineStream** (Cloudstream) released under the **Streamline** name:
**one provider per source** (like the big community repos), all running
on-device.

## Plugin, not an addon

Nuvio finds streams through two independent systems:

| | Addons | Plugins (this repo) |
|---|---|---|
| Protocol | Stremio addon protocol (`catalog` / `meta` / `stream` HTTP endpoints) | Nuvio's own plugin repository format (`manifest.json` + provider scripts) |
| Where the logic runs | On the addon developer's remote server | **On your device**, inside Nuvio's sandboxed JS runtime |
| Scope | Catalogs, metadata, subtitles, streams | Streams only |
| Portability | Any Stremio-protocol client | Nuvio-specific |

Streamline is a **plugin**: Nuvio downloads the provider scripts you enable,
executes them locally, and calls `getStreams(tmdbId, mediaType, season, episode)`
per title. Install it under **Plugins** in Nuvio — a plugin URL in the Addons
section errors out. Only sideloaded Nuvio builds support plugins; app-store
builds do not.

## Features

- **23 providers, one per source.** Enable only what you use; test each in
  isolation. No mega-provider, no 22-source pile-up in a single test run.
- **Full quality, giant files kept.** From 480p to UHD REMUX — nothing is
  filtered by size. Each row carries its size/quality label so you pick to
  taste (and to fit your connection/debrid).
- **Movies, series and anime.** Season/episode pass through to every source;
  title-based anime (Anizone) needs no IMDb mapping.
- **Direct HTTP streams** (HLS/DASH/MP4/MKV) with the playback headers each
  host requires.
- **Subtitles attached per stream.** Built-in Stremio backends plus optional
  Wyzie key, plus per-source captions where the origin provides them.
- **P2P magnets for Nuvio's native debrid.** The Torrents provider returns
  Torrentio/TorrentsDB magnets so linked Torbox/Premiumize accounts resolve
  them on-device.
- **Per-provider settings.** Tokens and toggles live on the provider that
  needs them (FebBox token → ShowBox, Wyzie key → subtitle-carrying
  providers, backend toggles → Torrents).
- **Hermes/QuickJS-safe bundles.** `src/` is modern ESM; `build.js` bundles
  each provider to generator-based CommonJS. Only `fetch`,
  `cheerio-without-node-native` and `crypto-js` exist at runtime — and the
  code is written against Nuvio's actual runtime limits (no timers, no
  `arrayBuffer`, no `.closest()`/`.parent()`).
- **Stays lively updated.** Rotating mirror domains re-resolve at runtime
  from the same `urls.json` CineStream uses, and a weekly CI workflow
  exercises real sources so dead origins surface immediately.

## Install in Nuvio

**Option A — GitHub raw (recommended)**

1. Push this repo (or your fork) to GitHub.
2. Copy your manifest URL:
   `https://raw.githubusercontent.com/itsmeadarsh2008/Streamline/main/manifest.json`
3. In Nuvio: **Settings → Content & Discovery → Plugins → Add Repository**,
   paste the URL, refresh, and enable the providers you want (start with
   Vidlink + Videasy + one Indian mirror + Torrents).

**Option B — Account dashboard**

Log in on the Nuvio website → **Plugins → Add Plugin**, paste the same
manifest URL with the name `Streamline`, save, and let it sync to your devices.

**Option C — Local testing (Plugin Tester)**

```bash
bun run serve   # serves manifest.json + providers/ on :3000
```

In a Nuvio development build go to **Settings → Developer → Plugin Tester**,
load `http://<your-LAN-IP>:3000/manifest.json` (Repo Tester) or a single
`http://<your-LAN-IP>:3000/providers/<id>.js` (Individual Plugin), and iterate
with `bun build.js <id>`.

You also need your own (free) TMDB API key set on Nuvio's TMDB screen —
Nuvio disables provider testing entirely without it. Use the **API Key**
(short hex string), not the Read Access Token.

## Providers

All ported from `references/CSX/CineStream` (`ProviderRegistry` source list,
`CineStreamExtractors` scrapers, `Extractors.kt` HubCloud/VCloud terminals,
Stremio torrent/subtitle helpers):

| Provider | What it does |
|---|---|
| Vidlink / Videasy / Hexa / Vidzee / Vidrock | Direct APIs + decrypt flows (AES-CBC/GCM) |
| VidFast / Vidcore / VaPlayer / PrimeSrc | Multi-step JSON APIs |
| ShowBox (needs token) / MovieBox / AllMovieLand / Cinejoy | Token/search/play flows |
| 4KHDHub / UHDMovies / MoviesMod / MoviesDrive / VegaMovies / RogMovies / Bollyflix | Mirror scrapes + HubCloud/VCloud terminals |
| Anizone | Title-based multi-audio anime |
| AniDB | Subbed/dubbed anime, multi-audio HLS (clean-room port, unobfuscated) |
| Torrents | Torrentio + TorrentsDB magnets for native debrid |

Shared HubCloud/VCloud terminals (FSL, Mega, Pixeldrain, 10Gbps, Buzz,
Gofile), the hrefli bypass and the redirect-chain decoder live in
`src/_shared/sources/hubcloud.js`.

Dynamic mirror domains resolve at runtime from the same `urls.json`
CineStream's `init()` loads, so host rotations rarely need a code change.

**Not ported:** Castle and MovieBlast require private keys CineStream keeps in
untracked `local.properties`, so they are intentionally absent rather than
shipped broken. Kitsu/MAL-mapped anime-only providers were reduced to the
title-based Anizone flow because Nuvio supplies TMDB ids.

## Settings

Each provider's settings screen carries only what it needs:

| Provider(s) | Keys |
|---|---|
| ShowBox | `showboxToken` (FebBox `ui` token — required, same token CineStream uses) |
| Hexa, Vidrock, PrimeSrc, ShowBox, AllMovieLand, Cinejoy, mirrors | `wyzieKey` (optional extra subtitles) |
| Torrents | `enableTorrents`, `torrentio`, `torrentsdb` backend toggles |

Nuvio itself handles the per-provider enable switch.

## Develop

```bash
bun install              # esbuild + runtime deps (cheerio, crypto-js)
bun build.js             # build all providers: src/<id>/ -> providers/<id>.js
bun build.js vidlink     # build one
bun run test             # manifest + surface + Hermes-safety + crypto +
                         # full Nuvio-runtime simulation, per provider
                         # (use `bun run test`, not `bun test` — the latter
                         # invokes Bun's own test runner)
LIVE=1 bun run test      # + live spot-checks against real sources
bun run serve            # static server for the in-app Plugin Tester
```

Rules that keep bundles working in Nuvio:

- Edit **`src/`**, never `providers/` by hand — build output (committed
  because Nuvio loads it directly via the manifest URL).
- One folder per provider under `src/` with an `index.js` exporting
  `getStreams`; shared code lives in `src/_shared/` (skipped by the build).
- Only `fetch`, `cheerio-without-node-native` and `crypto-js` exist at
  runtime (see `build.js` externals). No Node builtins, no `Buffer`, no
  timers, no `arrayBuffer()` — and only the subset of cheerio Nuvio shims
  (no `.closest()`/`.parent()`, no `:contains`).
- Every provider must fail soft: catch internally and return `[]`.

```
manifest.json               # plugin repository manifest (23 providers)
src/<provider>/index.js      # one entry per source (edit here)
src/_shared/                # library: tmdb/ctx, utils, subs, torrents, sources
providers/<id>.js           # built artifacts — what Nuvio downloads
test-streamline.js          # offline + runtime-sim + opt-in live tests
build.js server.js package.json bun.lock
.github/workflows/ci.yml    # install → build → tests → sync guard
.github/workflows/health.yml# weekly live source check
references/CSX/             # upstream reference, not shipped to Nuvio
```

### Verified behavior

- `bun build.js` → 22 bundles, zero raw `await`, `getStreams` (+ `onSettings`
  where flagged) exported everywhere.
- `bun run test` → 76 checks green, including executing every bundle the way
  Nuvio does (module wrapper, shimmed `require`, timers removed).
- Live: Vidlink/Videasy/Vidfast/VaPlayer/MovieBox/4KHDHub/VegaMovies streams
  for movies; Hexa/Vidfast for TV; 35 Torrentio/TorrentsDB magnets for movies.

## Troubleshooting

- **Test hangs / never finishes** — enable fewer providers; each should
  resolve in ≤20s. If one consistently stalls, disable it and file an issue.
- **No streams for a title** — check the title resolves on TMDB (most
  providers key on IMDb/title from that lookup).
- **ShowBox empty** — it requires `showboxToken`; without it the source
  returns nothing by design.
- **Magnets buffer forever** — link Torbox/Premiumize in
  Settings → Integrations; without debrid, magnets can't resolve.
- **Giant REMUX buffers** — nothing is filtered, so 60 GB files are listed;
  pick a smaller entry if your connection can't keep up.
- **Plugin URL errors in Nuvio** — plugins go in the **Plugins** section, not
  Addons; use a sideloaded build, since store builds disable plugins.
- **A mirror died** — most re-resolve via `urls.json`; if the page layout
  itself changed, the module in `src/_shared/sources/` needs updating, then
  rebuild. The weekly health workflow flags this automatically.

## Contributing

1. Fork, create a branch, add a folder under `src/<id>/` (keep the
   `getStreams(tmdbId, mediaType, season, episode) → streams[]` shape and the
   fail-soft contract) or fix a module under `src/_shared/`.
2. Register the provider in `manifest.json` (bump its version when behavior
   changes — Nuvio invalidates cached code on version change).
3. Run `bun build.js` and `bun run test` (plus `LIVE=1 bun run test` if you
   touched network code).
4. Commit `src/`, `providers/*.js` and `manifest.json` together — Nuvio
   serves the built files, so all three must stay in sync — and open a PR.

## Credits & source of inspiration

Streamline is a port of **CineStream** by megix, from the upstream Cloudstream
extensions repository:

- **Source repo:** [SaurabhKaperwan/CSX](https://github.com/SaurabhKaperwan/CSX)
  (see `references/CSX/CineStream` — provider registry, `CineStreamExtractors`
  scrapers, `Extractors.kt` HubCloud/VCloud terminals, Stremio helpers)
- **Nuvio provider conventions:** [yoruix/nuvio-providers](https://github.com/yoruix/nuvio-providers)
  and the [All-in-One-Nuvio](https://github.com/NuvioPlugin/All-in-One-Nuvio)
  collection (per-source layout, rich result rows)

## Legal

Streamline ships no content and hosts nothing. Like the upstream project, each
provider behaves as an ordinary client fetching publicly reachable pages and
APIs; what you access with it is your responsibility under your jurisdiction's
laws. The reference code under `references/` belongs to its authors and is
included for porting reference under its GPL-3.0 terms.

## License

GPL-3.0-only, matching the upstream CineStream/CSX licensing.
