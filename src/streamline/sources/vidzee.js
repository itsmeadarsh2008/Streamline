/**
 * Vidzee source. Port of CineStream `invokeVidzee()`.
 * GET player.vidzee.wtf/api/server -> AES-256-CBC decrypt each link with
 * the embedded secret (CryptoJS, same params as Cipher AES/CBC/PKCS5Padding).
 */
import CryptoJS from 'crypto-js';
import { UA, VIDZEE_API, VIDZEE_SECRET_B64 } from '../constants.js';
import { b64DecodeUtf8, fetchText, makeStream } from '../utils.js';

const SERVERS = [0, 1, 2, 4, 5, 6, 7];

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.vidzee !== false;
    } catch (e) {
        return true;
    }
}

let _key = null;
function aesKey() {
    if (!_key) {
        const secret = b64DecodeUtf8(VIDZEE_SECRET_B64);
        const padded = (secret + new Array(33).join("\0")).substring(0, 32);
        _key = CryptoJS.enc.Utf8.parse(padded);
    }
    return _key;
}

/** Port of CineStream `decryptVidzeeUrl()`. */
export function decryptVidzeeUrl(encryptedUrl) {
    try {
        const outer = b64DecodeUtf8(encryptedUrl);
        const idx = outer.indexOf(":");
        if (idx === -1) return null;
        const ivB64 = outer.substring(0, idx);
        const ctB64 = outer.substring(idx + 1);
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(ctB64) },
            aesKey(),
            { iv: CryptoJS.enc.Base64.parse(ivB64), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );
        const text = decrypted.toString(CryptoJS.enc.Utf8);
        return text || null;
    } catch (e) {
        return null;
    }
}

export async function scrape(ctx) {
    if (!enabled()) return [];
    if (!ctx.tmdbId) return [];
    const isTv = ctx.isTv;

    const jobs = SERVERS.map(function (sr) {
        return (async function () {
            try {
                const url = !isTv
                    ? VIDZEE_API + "/api/server?id=" + ctx.tmdbId + "&sr=" + sr
                    : VIDZEE_API + "/api/server?id=" + ctx.tmdbId + "&sr=" + sr + "&ss=" + ctx.season + "&ep=" + ctx.episode;
                const json = JSON.parse(await fetchText(url, { "User-Agent": UA }, 15000));
                const globalHeaders = (json && json.headers) || {};
                const links = (json && json.url) || [];
                const tracks = (json && json.tracks) || [];
                const subs = tracks
                    .filter(function (t) {
                        return t && t.url;
                    })
                    .map(function (t) {
                        return {
                            url: t.url,
                            language: t.lang || "en",
                            name: (t.lang || "Subtitle") + " [Vidzee]"
                        };
                    });
                const out = [];
                links.forEach(function (entry) {
                    if (!entry || !entry.link) return;
                    const finalUrl = decryptVidzeeUrl(entry.link);
                    if (!finalUrl || finalUrl.indexOf("https:") === -1) return;
                    const lang = entry.lang ? " (" + entry.lang + (entry.flag ? " - " + entry.flag : "") + ")" : "";
                    const isHls = entry.type === "hls" || finalUrl.indexOf(".m3u8") !== -1;
                    const s = makeStream(
                        "Vidzee",
                        "Vidzee " + (entry.name || "") + lang + (isHls ? " [HLS]" : ""),
                        finalUrl,
                        "1080p",
                        Object.assign({ Referer: VIDZEE_API + "/" }, globalHeaders),
                        subs.slice(0, 8)
                    );
                    if (s) out.push(s);
                });
                return out;
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
