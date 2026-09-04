/**
 * Cinejoy source (simplified-but-faithful port of `invokeCinejoy()`).
 * GET servers -> per-server enc-cinejoy -> octet POST /g -> dec-cinejoy.
 * Base64url codec implemented manually (no Buffer in QuickJS/Hermes).
 */
import { CINEJOY_API, CINEJOY_BASE, MULTI_DECRYPT_API, UA } from '../constants.js';
import { fetchText, makeStream, parseQuality, postJson } from '../utils.js';

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function b64urlDecodeToBytes(s) {
    let std = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    while (std.length % 4 !== 0) std += "=";
    const out = [];
    for (let i = 0; i < std.length; i += 4) {
        const n =
            (B64.indexOf(std[i]) << 18) |
            (B64.indexOf(std[i + 1]) << 12) |
            ((B64.indexOf(std[i + 2]) & 63) << 6) |
            (B64.indexOf(std[i + 3]) & 63);
        out.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
    }
    while (out.length && out[out.length - 1] === 0 && std.slice(-2) !== "==") break;
    return out;
}

function b64urlEncodeNoPad(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const n = (a << 16) | (b << 8) | c;
        out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
        out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "";
        out += i + 2 < bytes.length ? B64[n & 63] : "";
    }
    return out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.cinejoy !== false;
    } catch (e) {
        return true;
    }
}

export async function scrape(ctx) {
    if (!enabled()) return [];
    if (!ctx.title) return [];
    const isTv = ctx.isTv;
    const type = isTv ? "series" : "movie";
    const headers = {
        Accept: "*/*",
        Origin: CINEJOY_BASE,
        Referer: CINEJOY_BASE + "/",
        "User-Agent": UA
    };
    try {
        const serversJson = JSON.parse(await fetchText(CINEJOY_API + "/servers", headers, 15000));
        const servers = (serversJson && serversJson.servers) || [];
        if (!servers.length) return [];
        const out = [];
        for (const srv of servers.slice(0, 6)) {
            try {
                const name = (srv && srv.name) || srv;
                let target =
                    CINEJOY_API + "/?title=" + encodeURIComponent(ctx.title) +
                    "&type=" + type + "&year=" + (ctx.year || "") +
                    "&imdb=" + (ctx.imdbId || "") + "&tmdb=" + (ctx.tmdbId || "") +
                    "&server=" + encodeURIComponent(name);
                if (isTv) target += "&season=" + ctx.season + "&episode=" + ctx.episode;
                const encJson = JSON.parse(
                    await fetchText(MULTI_DECRYPT_API + "/enc-cinejoy?url=" + encodeURIComponent(target), {}, 15000)
                );
                const result = (encJson && encJson.result) || encJson;
                if (!result || !result.data) continue;
                const bodyBytes = b64urlDecodeToBytes(result.data);
                // Nuvio's fetch has no arrayBuffer() and the bridge takes
                // string bodies: send bytes as a binary string, recover the
                // reply the same way (latin-1 round-trip).
                let binBody = "";
                for (let i = 0; i < bodyBytes.length; i++) binBody += String.fromCharCode(bodyBytes[i] & 255);
                const gRes = await fetch(CINEJOY_API + "/g", {
                    method: "POST",
                    headers: Object.assign({}, headers, { "Content-Type": "application/octet-stream" }),
                    body: binBody
                });
                const gText = await gRes.text();
                const gBuf = [];
                for (let i = 0; i < gText.length; i++) gBuf.push(gText.charCodeAt(i) & 255);
                const payload = b64urlEncodeNoPad(gBuf);
                const decJson = await postJson(
                    MULTI_DECRYPT_API + "/dec-cinejoy",
                    { text: payload, state: result.state },
                    {},
                    15000
                );
                const streams = (((decJson && decJson.result) || {}).data || {}).stream;
                if (!streams) continue;
                const list = Array.isArray(streams) ? streams : [streams];
                list.forEach(function (st) {
                    if (!st) return;
                    if (st.playlist) {
                        const s = makeStream("Cinejoy", "Cinejoy - " + (st.id || name) + " [HLS]", st.playlist, "1080p", { Referer: CINEJOY_BASE + "/" }, []);
                        if (s) out.push(s);
                    }
                    const quals = st.qualities || st.files || {};
                    Object.keys(quals).forEach(function (k) {
                        const u = quals[k];
                        if (!u || String(u).indexOf("https") !== 0) return;
                        const s = makeStream("Cinejoy", "Cinejoy - " + (st.id || name) + " " + k, u, parseQuality(k), { Referer: CINEJOY_BASE + "/" }, []);
                        if (s) out.push(s);
                    });
                    ((st.captions) || []).forEach(function () { /* captions surfaced via shared subs */ });
                });
            } catch (e) {
                continue;
            }
        }
        return out;
    } catch (e) {
        console.log("[Streamline][cinejoy] " + e.message);
        return [];
    }
}
