/**
 * Torrent aggregation. Port of CineStream `invokeStremioTorrents()` for
 * Torrentio + TorrentsDB. Returns magnet streams so Nuvio's native debrid
 * integration (Torbox/Premiumize) can resolve them on-device.
 */
import { TORRENTIO_API, TORRENTSDB_API } from './constants.js';
import { fetchText, makeStream } from './utils.js';
import { headline, parseMeta, richTitle, seasonEpCode } from './meta.js';

function settings() {
    try {
        return globalThis.SCRAPER_SETTINGS || {};
    } catch (e) {
        return {};
    }
}

function buildMagnet(infoHash, fileIdx, trackers) {
    let magnet = "magnet:?xt=urn:btih:" + infoHash + "&dn=" + infoHash;
    (trackers || []).forEach(function (t) {
        magnet += "&tr=" + encodeURIComponent(t);
    });
    if (fileIdx != null) magnet += "&index=" + fileIdx;
    return magnet;
}

async function stremioTorrents(sourceName, api, ctx) {
    const imdbId = ctx.imdbId, season = ctx.season, episode = ctx.episode, isTv = ctx.isTv;
    const path = !isTv
        ? "/stream/movie/" + imdbId + ".json"
        : "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json";
    const json = JSON.parse(await fetchText(api + path, {}, 20000));
    const streams = (json && json.streams) || [];
    const line1 = (ctx.title || ctx.originalTitle)
        ? headline(ctx.originalTitle || ctx.title, isTv ? null : ctx.year,
            isTv ? seasonEpCode(season, episode) : "")
        : null;
    const out = [];
    streams.forEach(function (s) {
        if (!s || !s.infoHash) return;
        const label = s.title || s.description || s.name || "";
        const seedM = String(label).match(/[👤👥]\s*(\d+)/);
        const seeders = seedM ? parseInt(seedM[1], 10) : 0;
        if (seeders && seeders < 20) return; // CineStream drops <25; be a touch lenient
        // Full metadata block: quality, size, HDR, codec, DV, audio+Atmos,
        // language, source — nothing filtered, giant REMUX kept.
        const meta = parseMeta(label + " " + (s.name || ""));
        const rt = richTitle(sourceName, line1 || ("🎬 " + label.split("\n")[0].slice(0, 80)), meta, "MKV");
        const stream = makeStream(
            sourceName + " 👥" + seeders + " ⬆️" + meta.quality,
            rt.text,
            buildMagnet(s.infoHash, s.fileIdx, s.sources),
            meta.quality === "Auto" ? "Auto" : meta.quality,
            {},
            [],
            {
                size: meta.size || undefined,
                language: meta.lang ? meta.lang.split(" + ")[0] : undefined,
                seeders: seeders || undefined,
                infoHash: s.infoHash
            }
        );
        if (stream) {
            stream._rank = meta.rank;
            stream._sizeMB = meta.sizeMB;
            stream._rich = true;
            out.push(stream);
        }
    });
    return out;
}

export async function torrentSources(imdbId, season, episode, isTv, ctx) {
    if (!imdbId) return [];
    const full = ctx || { imdbId: imdbId, season: season, episode: episode, isTv: isTv };
    const cfg = settings();
    if (cfg.enableTorrents === false) return [];
    const jobs = [];
    if (cfg.torrentio !== false) {
        jobs.push(
            (async function () {
                try {
                    return await stremioTorrents("Torrentio", TORRENTIO_API, full);
                } catch (e) {
                    console.log("[Streamline][torrentio] " + e.message);
                    return [];
                }
            })()
        );
    }
    if (cfg.torrentsdb !== false) {
        jobs.push(
            (async function () {
                try {
                    return await stremioTorrents("TorrentsDB", TORRENTSDB_API, full);
                } catch (e) {
                    console.log("[Streamline][torrentsdb] " + e.message);
                    return [];
                }
            })()
        );
    }
    const settled = await Promise.all(jobs);
    const out = [];
    settled.forEach(function (r) {
        out.push.apply(out, r);
    });
    return out;
}
