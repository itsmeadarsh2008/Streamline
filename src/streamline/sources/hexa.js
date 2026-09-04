/**
 * Hexa source. Port of CineStream `invokeHexa()`.
 * Random API key + enc-hexa token -> GET hexa images endpoint -> POST dec-hexa.
 * All crypto happens server-side on enc-dec.app; this port needs none locally.
 */
import { HEXA_API, MULTI_DECRYPT_API, UA } from '../constants.js';
import { fetchText, makeStream, postJson } from '../utils.js';

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.hexa !== false;
    } catch (e) {
        return true;
    }
}

function randomKeyHex() {
    let out = "";
    const hex = "0123456789abcdef";
    for (let i = 0; i < 64; i++) out += hex[Math.floor(Math.random() * 16)];
    return out;
}

export async function scrape(ctx) {
    if (!enabled()) return [];
    if (!ctx.tmdbId) return [];
    const isTv = ctx.isTv;

    const target = !isTv
        ? HEXA_API + "/api/tmdb/movie/" + ctx.tmdbId + "/images"
        : HEXA_API + "/api/tmdb/tv/" + ctx.tmdbId + "/season/" + ctx.season + "/episode/" + ctx.episode + "/images";

    const key = randomKeyHex();
    const tokenJson = JSON.parse(
        await fetchText(MULTI_DECRYPT_API + "/enc-hexa", {}, 15000)
    );
    const token = (tokenJson && tokenJson.result && tokenJson.result.token) || tokenJson.token || "";
    if (!token) return [];

    const encData = await fetchText(
        target,
        {
            "User-Agent": UA,
            Accept: "text/plain",
            "X-Api-Key": key,
            "X-Fingerprint-Lite": "e9136c41504646444",
            Referer: "https://hexa.su/",
            "X-Cap-Token": token
        },
        20000
    );
    const dec = await postJson(
        MULTI_DECRYPT_API + "/dec-hexa",
        { text: encData, key: key },
        {},
        15000
    );
    const sources = ((dec && dec.result && dec.result.sources) || []);
    return sources
        .map(function (src) {
            if (!src || !src.url) return null;
            const server = src.server || "Hexa";
            return makeStream(
                "Hexa",
                "Hexa " + String(server).charAt(0).toUpperCase() + String(server).slice(1),
                src.url,
                "Auto",
                { Referer: "https://hexa.su/", "User-Agent": UA },
                []
            );
        })
        .filter(Boolean);
}
