/**
 * VaPlayer + PrimeSrc sources. Ports of CineStream `invokeVaPlayer()` and
 * `invokePrimeSrc()`. Both are single-roundtrip JSON APIs keyed on IMDb id.
 */
import { PRIMESRC_API, UA, VAPLAYER_API } from '../constants.js';
import { fetchText, makeStream, parseQuality } from '../utils.js';

function enabled(key) {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s[key] !== false;
    } catch (e) {
        return true;
    }
}

export async function scrapeVaplayer(ctx) {
    if (!enabled("vaplayer")) return [];
    if (!ctx.imdbId) return [];
    const url = !ctx.isTv
        ? VAPLAYER_API + "/api.php?imdb=" + ctx.imdbId + "&type=movie"
        : VAPLAYER_API + "/api.php?imdb=" + ctx.imdbId + "&type=tv&season=" + ctx.season + "&episode=" + ctx.episode;
    try {
        const json = JSON.parse(
            await fetchText(url, { Referer: "https://nextgencloudfabric.com/" }, 20000)
        );
        const data = (json && json.data) || {};
        const urls = data.stream_urls || [];
        const subs = ((json && json.default_subs) || [])
            .filter(function (s) {
                return s && s.url;
            })
            .map(function (s) {
                return {
                    url: s.url,
                    language: s.lang || s.code || "en",
                    name: (s.lang || s.code || "Subtitle") + " [VaPlayer]"
                };
            });
        return urls
            .map(function (u) {
                return makeStream(
                    "VaPlayer",
                    "VaPlayer [HLS]",
                    u,
                    "Auto",
                    { Referer: "https://nextgencloudfabric.com/" },
                    subs.slice(0, 8)
                );
            })
            .filter(Boolean);
    } catch (e) {
        console.log("[Streamline][vaplayer] " + e.message);
        return [];
    }
}

export async function scrapePrimesrc(ctx) {
    if (!enabled("primesrc")) return [];
    if (!ctx.imdbId) return [];
    const headers = { Referer: PRIMESRC_API + "/", "User-Agent": UA };
    const url = !ctx.isTv
        ? PRIMESRC_API + "/api/v1/s?imdb=" + ctx.imdbId + "&type=movie"
        : PRIMESRC_API + "/api/v1/s?imdb=" + ctx.imdbId + "&season=" + ctx.season + "&episode=" + ctx.episode + "&type=tv";
    try {
        const list = JSON.parse(await fetchText(url, headers, 20000));
        const servers = (list && list.servers) || [];
        const out = [];
        for (const srv of servers) {
            try {
                if (!srv || !srv.key) continue;
                const raw = JSON.parse(
                    await fetchText(PRIMESRC_API + "/api/v1/l?key=" + srv.key, headers, 15000)
                );
                const link = raw && raw.link;
                if (!link) continue;
                const quality = parseQuality(srv.quality || srv.name || link);
                const s = makeStream(
                    "PrimeSrc",
                    "PrimeSrc [" + (srv.name || "server") + "] - " + quality,
                    link,
                    quality,
                    headers,
                    []
                );
                if (s) out.push(s);
            } catch (e) {
                continue;
            }
        }
        return out;
    } catch (e) {
        console.log("[Streamline][primesrc] " + e.message);
        return [];
    }
}
