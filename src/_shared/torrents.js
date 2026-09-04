/**
 * Torrent aggregation. Port of CineStream `invokeStremioTorrents()` for
 * Torrentio + TorrentsDB. Returns magnet streams so Nuvio's native debrid
 * integration (Torbox/Premiumize) can resolve them on-device.
 */
import { TORRENTIO_API, TORRENTSDB_API } from './constants.js';
import { fetchText, makeStream, parseQuality } from './utils.js';

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

function parseTitleMeta(title) {
    const t = String(title || "");
    const seedM = t.match(/[👤👥]\s*(\d+)/);
    const sizeM = t.match(/💾\s*([0-9.]+\s*[A-Za-z]+)/);
    return {
        seeders: seedM ? parseInt(seedM[1], 10) : 0,
        size: sizeM ? sizeM[1] : ""
    };
}

async function stremioTorrents(sourceName, api, imdbId, season, episode, isTv) {
    const path = !isTv
        ? "/stream/movie/" + imdbId + ".json"
        : "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json";
    const json = JSON.parse(await fetchText(api + path, {}, 20000));
    const streams = (json && json.streams) || [];
    const out = [];
    streams.forEach(function (s) {
        if (!s || !s.infoHash) return;
        const label = s.title || s.description || s.name || "";
        const meta = parseTitleMeta(label);
        if (meta.seeders && meta.seeders < 20) return; // CineStream drops <25; be a touch lenient
        const magnet = buildMagnet(s.infoHash, s.fileIdx, s.sources);
        const quality = parseQuality(s.name || label);
        const stream = makeStream(
            sourceName,
            sourceName + " | " + quality + (meta.size ? " | " + meta.size : "") + " | S" + meta.seeders,
            magnet,
            quality,
            {}
        );
        if (stream) out.push(stream);
    });
    return out;
}

export async function torrentSources(imdbId, season, episode, isTv) {
    if (!imdbId) return [];
    const cfg = settings();
    if (cfg.enableTorrents === false) return [];
    const jobs = [];
    if (cfg.torrentio !== false) {
        jobs.push(
            (async function () {
                try {
                    return await stremioTorrents("Torrentio", TORRENTIO_API, imdbId, season, episode, isTv);
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
                    return await stremioTorrents("TorrentsDB", TORRENTSDB_API, imdbId, season, episode, isTv);
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
