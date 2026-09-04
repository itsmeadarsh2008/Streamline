/**
 * Shared HTTP + data helpers. Port of the small utilities scattered across
 * CineStream `CineStreamUtils.kt` / `CineStreamParser.kt` that are meaningful
 * in a fetch-only JS runtime.
 */
import { UA } from './constants.js';

export function defaultHeaders(extra) {
    return Object.assign({ "User-Agent": UA, "Accept": "*/*" }, extra || {});
}

/** Nuvio's QuickJS runtime has no timers — degrade to untimed fetch. */
function hasTimers() {
    try {
        return typeof setTimeout === "function" && typeof clearTimeout === "function";
    } catch (e) {
        return false;
    }
}

export async function fetchWithTimeout(url, options, timeoutMs) {
    if (!hasTimers()) {
        return fetch(url, options || {});
    }
    const timeout = timeoutMs || 20000;
    let timer = null;
    try {
        const fetchPromise = fetch(url, options || {});
        const timeoutPromise = new Promise(function (_, reject) {
            timer = setTimeout(function () {
                reject(new Error("timeout after " + timeout + "ms: " + url));
            }, timeout);
        });
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        if (timer) clearTimeout(timer);
        return res;
    } catch (e) {
        if (timer) clearTimeout(timer);
        throw e;
    }
}

export async function fetchText(url, headers, timeoutMs) {
    const res = await fetchWithTimeout(url, { headers: defaultHeaders(headers) }, timeoutMs);
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    return await res.text();
}

export async function fetchJson(url, headers, timeoutMs) {
    const text = await fetchText(url, headers, timeoutMs);
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error("Bad JSON from " + url + ": " + e.message);
    }
}

export async function postJson(url, body, headers, timeoutMs) {
    const res = await fetchWithTimeout(
        url,
        {
            method: "POST",
            headers: defaultHeaders(
                Object.assign({ "Content-Type": "application/json", Accept: "application/json" }, headers || {})
            ),
            body: typeof body === "string" ? body : JSON.stringify(body == null ? {} : body)
        },
        timeoutMs
    );
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
}

/** Port of CineStream `getIndexQuality()`. Returns a Nuvio quality label. */
export function parseQuality(raw) {
    if (raw == null) return "Auto";
    const s = String(raw).toLowerCase();
    if (/\b8k\b/.test(s)) return "8K";
    if (/2160|4k|uhd/.test(s)) return "4K";
    const m = s.match(/(\d{3,4})\s*p?/);
    if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 2000) return "4K";
        if (n >= 1000) return "1080p";
        if (n >= 700) return "720p";
        if (n >= 400) return "480p";
        if (n > 0) return "360p";
    }
    if (/org/.test(s)) return "4K";
    if (/cam|ts|telesync|telecine|hdcam/.test(s)) return "CAM";
    if (/hd/.test(s)) return "720p";
    return "Auto";
}

export function formatOf(url) {
    const u = String(url || "").toLowerCase();
    if (u.indexOf(".m3u8") !== -1) return "HLS";
    if (u.indexOf(".mpd") !== -1) return "DASH";
    if (u.indexOf(".mp4") !== -1) return "MP4";
    if (u.indexOf(".mkv") !== -1) return "MKV";
    return "VIDEO";
}

/** Normalize a Nuvio stream object (mirrors DOCUMENTATION.md output format). */
export function makeStream(source, title, url, quality, headers, subtitles) {
    if (!url) return null;
    const u = String(url);
    if (u.indexOf("http") !== 0 && u.indexOf("magnet:?") !== 0) return null;
    return {
        name: source,
        title: title || source,
        url: u,
        quality: quality || parseQuality(title),
        headers: headers || {},
        subtitles: subtitles || []
    };
}

export function normalizeTitle(s) {
    if (!s) return "";
    return String(s)
        .replace(/\[.*?\]/g, " ")
        .replace(/\(.*?\)/g, " ")
        .trim()
        .toLowerCase()
        .replace(/:/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ");
}

export function episodeSlug(season, episode) {
    const s = String(season).padStart(2, "0");
    const e = String(episode).padStart(2, "0");
    return { s: s, e: e, code: "S" + s + "E" + e, alt: "s" + s + "e" + e };
}

/** Never-reject wrapper so one dead source can't kill the aggregation. */
export async function safeRun(label, fn) {
    try {
        const out = await fn();
        return Array.isArray(out) ? out : [];
    } catch (e) {
        console.log("[Streamline][" + label + "] " + (e && e.message));
        return [];
    }
}

/** Run async tasks with capped concurrency (port of `runLimitedAsync`). */
export async function runLimited(tasks, concurrency) {
    const limit = Math.max(1, concurrency || 6);
    const results = [];
    for (let i = 0; i < tasks.length; i += limit) {
        const chunk = tasks.slice(i, i + limit);
        const settled = await Promise.all(
            chunk.map(function (t) {
                try {
                    return Promise.resolve(t()).catch(function () {
                        return [];
                    });
                } catch (e) {
                    return Promise.resolve([]);
                }
            })
        );
        settled.forEach(function (r) {
            if (Array.isArray(r)) results.push.apply(results, r);
        });
    }
    return results;
}

export function withTimeout(promise, ms, label) {
    if (!hasTimers()) return promise;
    const timeout = ms || 25000;
    return Promise.race([
        promise,
        new Promise(function (resolve) {
            setTimeout(function () {
                console.log("[Streamline] timeout: " + label);
                resolve([]);
            }, timeout);
        })
    ]);
}

/** De-duplicate streams by URL (providers occasionally repeat hosts). */
export function dedupe(streams) {
    const seen = {};
    const out = [];
    (streams || []).forEach(function (s) {
        if (!s || !s.url || seen[s.url]) return;
        seen[s.url] = true;
        out.push(s);
    });
    return out;
}

/** Base64 helpers that work in Hermes/QuickJS (no Buffer/atob assumed). */
export function b64DecodeToBytes(b64) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    const clean = String(b64 || "").replace(/[^A-Za-z0-9+/=]/g, "");
    const bytes = [];
    let i = 0;
    while (i < clean.length) {
        const e1 = chars.indexOf(clean.charAt(i++));
        const e2 = chars.indexOf(clean.charAt(i++));
        const e3 = chars.indexOf(clean.charAt(i++));
        const e4 = chars.indexOf(clean.charAt(i++));
        const n1 = (e1 << 2) | (e2 >> 4);
        const n2 = ((e2 & 15) << 4) | (e3 >> 2);
        const n3 = ((e3 & 3) << 6) | e4;
        bytes.push(n1);
        if (e3 !== 64) bytes.push(n2);
        if (e4 !== 64) bytes.push(n3);
    }
    return bytes;
}

export function bytesToUtf8(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    try {
        return decodeURIComponent(escape(out));
    } catch (e) {
        return out;
    }
}

export function b64DecodeUtf8(b64) {
    try {
        return bytesToUtf8(b64DecodeToBytes(b64));
    } catch (e) {
        return "";
    }
}
