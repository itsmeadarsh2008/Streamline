/**
 * Videasy source. Port of CineStream `invokeVideasy()`.
 * GET {videasy}/seed -> per-server sources-with-title (double-urlencoded title)
 * -> POST enc-dec.app/api/dec-videasy -> sources + subtitles.
 */
import { MULTI_DECRYPT_API, UA, VIDEASY_API } from '../constants.js';
import { fetchText, makeStream, postJson } from '../utils.js';

const SERVERS = [
    "myflixerzupcloud",
    "downloader2",
    "m4uhd",
    "hdmovie",
    "cdn",
    "superflix",
    "lamovie",
    "jett",
    "tejo",
    "neon2",
    "ym"
];

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.videasy !== false;
    } catch (e) {
        return true;
    }
}

function dblEncode(s) {
    return encodeURIComponent(encodeURIComponent(s)).replace(/%20/g, "%2520");
}

export async function scrape(ctx) {
    if (!enabled()) return [];
    if (!ctx.tmdbId || !ctx.title) return [];
    const isTv = ctx.isTv;

    const seedJson = JSON.parse(
        await fetchText(
            VIDEASY_API + "/seed?mediaId=" + encodeURIComponent(String(ctx.tmdbId)),
            {},
            15000
        )
    );
    const seed = (seedJson && seedJson.seed) || seedJson;
    if (!seed || typeof seed !== "string") return [];

    const headers = {
        Accept: "*/*",
        "User-Agent": UA,
        Origin: "https://player.videasy.to",
        Referer: "https://player.videasy.to/"
    };

    const mediaType = isTv ? "tv" : "movie";
    const base =
        "?title=" + dblEncode(ctx.title) +
        "&mediaType=" + mediaType +
        "&year=" + (ctx.year || "") +
        "&tmdbId=" + ctx.tmdbId +
        "&imdbId=" + (ctx.imdbId || "") +
        "&enc=2&seed=" + encodeURIComponent(seed) +
        (isTv ? "&episodeId=" + ctx.episode + "&seasonId=" + ctx.season : "");

    const jobs = SERVERS.map(function (server) {
        return (async function () {
            try {
                const encData = await fetchText(
                    VIDEASY_API + "/" + server + "/sources-with-title" + base,
                    headers,
                    15000
                );
                const dec = await postJson(
                    MULTI_DECRYPT_API + "/dec-videasy",
                    { text: encData, id: ctx.tmdbId, seed: seed },
                    {},
                    15000
                );
                const result = (dec && dec.result) || {};
                const sources = result.sources || [];
                const subs = (result.subtitles || [])
                    .filter(function (t) {
                        return t && t.url;
                    })
                    .map(function (t) {
                        return {
                            url: t.url,
                            language: t.language || "en",
                            name: (t.language || "Subtitle") + " [Videasy]"
                        };
                    });
                return sources
                    .map(function (src) {
                        if (!src || !src.url) return null;
                        const u = String(src.url);
                        const quality = /1080/.test(src.quality || u)
                            ? "1080p"
                            : /720/.test(src.quality || u)
                                ? "720p"
                                : /2160|4k/i.test(src.quality || u)
                                    ? "4K"
                                    : "Auto";
                        return makeStream(
                            "Videasy",
                            "Videasy [" + server + "] - " + quality,
                            u,
                            quality,
                            headers,
                            subs.slice(0, 8)
                        );
                    })
                    .filter(Boolean);
            } catch (e) {
                return [];
            }
        })();
    });

    const settled = await Promise.all(jobs);
    const out = [];
    settled.forEach(function (r) {
        out.push.apply(out, r);
    });
    return out;
}
