/**
 * Vidrock source. Port of CineStream `invokeVidrock()`.
 * GET vidrock.ru/api/{movie|tv}/{query} -> AES-256-GCM decrypt each server URL.
 * Port of CineStream `decryptVidrockUrl()` using WebCrypto AES-GCM when
 * available; gracefully skips when the runtime has no SubtleCrypto.
 */
import { UA, VIDROCK_API, VIDROCK_KEY_HEX } from '../constants.js';
import { b64DecodeToBytes, bytesToUtf8, fetchText, makeStream } from '../utils.js';

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.vidrock !== false;
    } catch (e) {
        return true;
    }
}

function hexToBytes(hex) {
    const out = [];
    for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
    return out;
}

function subtle() {
    try {
        if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto.subtle;
        // eslint-disable-next-line no-undef
        if (typeof require !== "undefined") {
            try {
                const nc = require("node:crypto");
                if (nc && nc.webcrypto && nc.webcrypto.subtle) return nc.webcrypto.subtle;
            } catch (e) { /* bundled runtime: no node crypto */ }
        }
    } catch (e) { /* ignore */ }
    return null;
}

/** Port of `decryptVidrockUrl()`: base64url -> nonce[12] + ct+tag -> AES-GCM. */
export async function decryptVidrockUrl(payload) {
    try {
        const sub = subtle();
        if (!sub) return null;
        let std = String(payload).replace(/-/g, "+").replace(/_/g, "/");
        while (std.length % 4 !== 0) std += "=";
        const data = b64DecodeToBytes(std);
        if (data.length <= 12) return null;
        const nonce = new Uint8Array(data.slice(0, 12));
        const ct = new Uint8Array(data.slice(12));
        const keyBytes = new Uint8Array(hexToBytes(VIDROCK_KEY_HEX));
        const key = await sub.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
        const plain = await sub.decrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, ct);
        return bytesToUtf8(Array.from(new Uint8Array(plain)));
    } catch (e) {
        return null;
    }
}

export async function scrape(ctx) {
    if (!enabled()) return [];
    if (!ctx.tmdbId) return [];
    const isTv = ctx.isTv;
    const type = !isTv ? "movie" : "tv";
    const query = !isTv
        ? String(ctx.tmdbId)
        : ctx.tmdbId + "_" + ctx.season + "_" + ctx.episode;

    let json;
    try {
        json = JSON.parse(
            await fetchText(VIDROCK_API + "/api/" + type + "/" + query + "/", {
                Origin: VIDROCK_API,
                Referer: VIDROCK_API + "/",
                "User-Agent": UA
            }, 20000)
        );
    } catch (e) {
        console.log("[Streamline][vidrock] " + e.message);
        return [];
    }

    const out = [];
    const entries = Object.keys(json || {});
    for (const server of entries) {
        const enc = json[server] && (json[server].url || json[server]);
        if (!enc || typeof enc !== "string" || enc === "error" || enc === "null") continue;
        const url = await decryptVidrockUrl(enc);
        if (!url || url.indexOf("http") !== 0) continue;
        const s = makeStream(
            "Vidrock",
            "Vidrock [" + server + "]",
            url,
            "Auto",
            { Origin: VIDROCK_API, Referer: VIDROCK_API + "/", "User-Agent": UA },
            []
        );
        if (s) out.push(s);
    }
    return out;
}
