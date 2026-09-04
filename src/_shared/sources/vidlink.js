/**
 * Vidlink source. Port of CineStream `invokeVidlink()`.
 * GET enc-dec.app/api/enc-vidlink -> GET vidlink.pro/api/b/{movie|tv} -> qualities + captions.
 */
import { MULTI_DECRYPT_API, VIDLINK_API, UA_MOBILE } from '../constants.js';
import { fetchText, makeStream, parseQuality } from '../utils.js';

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.vidlink !== false;
    } catch (e) {
        return true;
    }
}

const HEADERS = {
    "User-Agent": UA_MOBILE,
    Connection: "keep-alive",
    Referer: VIDLINK_API + "/",
    Origin: VIDLINK_API
};

export async function scrape(ctx) {
    if (!enabled()) return [];
    const tmdbId = ctx.tmdbId;
    if (!tmdbId) return [];
    const isTv = ctx.isTv;

    const encText = await fetchText(
        MULTI_DECRYPT_API + "/enc-vidlink?text=" + encodeURIComponent(String(tmdbId)),
        {},
        15000
    );
    let enc = "";
    try {
        enc = JSON.parse(encText).result || "";
    } catch (e) {
        return [];
    }
    if (!enc) return [];

    const epUrl = !isTv
        ? VIDLINK_API + "/api/b/movie/" + enc
        : VIDLINK_API + "/api/b/tv/" + enc + "/" + ctx.season + "/" + ctx.episode;

    const json = JSON.parse(await fetchText(epUrl, HEADERS, 20000));
    const stream = (json && json.stream) || json;
    if (!stream) return [];
    const qualities = stream.qualities || {};
    const out = [];
    Object.keys(qualities).forEach(function (k) {
        const v = qualities[k] || {};
        const url = v.url;
        if (!url) return;
        const isM3u8 = v.type === "m3u8" || String(url).indexOf(".m3u8") !== -1;
        const qmap = { 1080: "1080p", 720: "720p", 480: "480p", 360: "360p" };
        const quality = qmap[k] || parseQuality(k);
        const streamHeaders = v.headers || {
            Referer: "https://filmboom.top/",
            Origin: "https://filmboom.top"
        };
        const s = makeStream(
            "Vidlink",
            "Vidlink - " + quality + (isM3u8 ? " [HLS]" : ""),
            url,
            quality,
            streamHeaders,
            []
        );
        if (s) out.push(s);
    });

    const captions = stream.captions || [];
    const subs = captions
        .filter(function (c) {
            return c && c.url;
        })
        .map(function (c) {
            return {
                url: c.url,
                language: c.language || "en",
                name: (c.language || "Subtitle") + " [Vidlink]"
            };
        });
    if (subs.length) {
        return out.map(function (s) {
            const copy = Object.assign({}, s);
            copy.subtitles = subs.slice(0, 8);
            return copy;
        });
    }
    return out;
}
