/**
 * Just4Anime (Streamline). Port of CineStream master `invokeJust4Anime()`.
 * AniList id -> per-server availability -> per-type sources (proxied HLS)
 * bundles with real VTT subtitles.
 */
import { UA } from '../constants.js';
import { fetchText, fetchWithTimeout, makeStream, normalizeTitle, postJson } from '../utils.js';
import { enrichStream, headline, seasonEpCode } from '../meta.js';
import { resolveSourceLink } from './hubcloud.js';

const API = "https://api.just4anime.online/api/v1";
const BASE = "https://just4anime.online";

const ANILIST_QUERY =
    "query ($s: String) { Page(perPage: 6) { media(search: $s, type: ANIME, sort: SEARCH_MATCH) " +
    "{ id seasonYear title { romaji english native } } } }";

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.just4anime !== false;
    } catch (e) {
        return true;
    }
}

function cap(s) {
    const t = String(s || "");
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** AniList GraphQL title search -> best matching anime id. */
async function anilistId(ctx) {
    if (!ctx.title) return null;
    const json = await postJson("https://graphql.anilist.co", {
        query: ANILIST_QUERY,
        variables: { s: ctx.title }
    }, {}, 15000);
    const media = ((((json || {}).data || {}).Page) || {}).media || [];
    if (!media.length) return null;
    const want = normalizeTitle(ctx.title);
    let best = null;
    media.forEach(function (m) {
        const names = [
            m.title && m.title.english,
            m.title && m.title.romaji,
            m.title && m.title.native
        ].filter(Boolean).map(normalizeTitle);
        let score = 0;
        if (names.indexOf(want) !== -1) score = 3;
        else if (names.some(function (n) { return n && (n.indexOf(want) !== -1 || want.indexOf(n) !== -1); })) score = 2;
        if (score && ctx.year && m.seasonYear && Math.abs(m.seasonYear - ctx.year) <= 1) score += 1;
        if (!best || score > best.score) best = { id: m.id, score: score };
    });
    if (best && best.score >= 2) return best.id;
    if (media.length === 1 && media[0].id) return media[0].id;
    return null;
}

function subMap(data, label) {
    return ((data && data.subtitles) || [])
        .filter(function (s) { return s && s.url; })
        .map(function (s) {
            return {
                url: s.url,
                language: s.language || s.lang || s.label || "en",
                name: label + " Subtitle"
            };
        });
}

/** Merge the source's own referer/origin with a J4A fallback (case-safe). */
function sourceHeaders(src) {
    const headers = {};
    Object.keys(src.headers || {}).forEach(function (k) { headers[k] = src.headers[k]; });
    const hasRef = Object.keys(headers).some(function (k) { return /referer/i.test(k); });
    if (!hasRef) headers.Referer = BASE + "/";
    return headers;
}

function variantQuality(height) {
    const n = parseInt(height, 10);
    if (n >= 4000) return "8K";
    if (n >= 2000) return "4K";
    if (n >= 1000) return "1080p";
    if (n >= 700) return "720p";
    if (n >= 400) return "480p";
    if (n > 0) return "360p";
    return "Auto";
}

function absUrl(base, ref) {
    try {
        return new URL(ref, base).toString();
    } catch (e) {
        return ref;
    }
}

/**
 * Port of CineStream's M3u8Helper step: fetch the proxied master, keep only
 * playable rows, and split variants into one stream each (with real quality).
 */
async function m3u8Rows(label, src, subs, headers) {
    const direct = function () {
        const s = makeStream(label, label + (src.quality && src.quality !== "auto" ? " " + src.quality : ""),
            src.url, src.quality || "Auto", headers, subs);
        return s ? [s] : [];
    };
    if (src.isM3U8 === false) return direct();
    let text = "";
    try {
        const res = await fetchWithTimeout(src.url, { headers: headers }, 12000);
        if (!res.ok) return [];
        text = await res.text();
    } catch (e) {
        return [];
    }
    if (text.indexOf("#EXTM3U") === -1) {
        // A 200 that is not a playlist is an error page — a dead row either way.
        if (/^\s*</.test(text)) return [];
        return direct();
    }
    if (/#EXT-X-STREAM-INF/i.test(text)) {
        const rows = [];
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            if (!/^#EXT-X-STREAM-INF/i.test(lines[i])) continue;
            let next = "";
            for (let j = i + 1; j < lines.length; j++) {
                const l = lines[j].trim();
                if (l && l.charAt(0) !== "#") { next = l; break; }
            }
            if (!next) continue;
            const rm = lines[i].match(/RESOLUTION=\d+x(\d+)/i);
            const q = rm ? variantQuality(rm[1]) : (src.quality && src.quality !== "auto" ? src.quality : "Auto");
            const s = makeStream(label, label + " " + q, absUrl(src.url, next), q, headers, subs);
            if (s) rows.push(s);
        }
        if (rows.length) return rows;
    }
    const s = makeStream(label, label + (src.quality && src.quality !== "auto" ? " " + src.quality : ""),
        src.url, src.quality || "Auto", headers, subs);
    return s ? [s] : [];
}

async function fetchServerSources(aniId, srv, type, episode, line1) {
    const label = "Just4Anime [" + cap(srv.displayName || srv.code) + "] [" + cap(type) + "]";
    const url = API + "/meta/sources/" + aniId + "?provider=" + encodeURIComponent(srv.code) +
        "&num=" + episode + "&type=" + encodeURIComponent(type);
    const json = JSON.parse(await fetchText(url, { Referer: BASE + "/" }, 15000));
    const data = (json && json.data) || null;
    if (!data) return [];
    const subs = subMap(data, label);
    const out = [];
    const tasks = [];
    ((data.sources) || []).forEach(function (src) {
        if (!src || !src.url) return;
        // Asset-proxy URLs without a token are already dead ("Invalid asset
        // proxy token") — skip instead of showing an unplayable row.
        if (/\/proxy\/a\//.test(src.url) && !/[?&]t=/.test(src.url)) return;
        tasks.push(function () {
            return m3u8Rows(label, src, subs, sourceHeaders(src));
        });
    });
    const settled = await Promise.all(tasks.map(function (t) {
        return t().catch(function () { return []; });
    }));
    settled.forEach(function (rows) {
        (rows || []).forEach(function (s) {
            out.push(enrichStream(s, s.title, line1, { skipUrl: true, container: "HLS" }));
        });
    });
    for (const fr of ((data.iframe) || []).slice(0, 3)) {
        const furl = typeof fr === "string" ? fr : (fr && fr.url);
        if (!furl) continue;
        try {
            const r = await resolveSourceLink(label, furl);
            r.forEach(function (s) {
                if (!s.subtitles || !s.subtitles.length) s.subtitles = subs;
            });
            out.push.apply(out, r);
        } catch (e) { /* skip iframe */ }
    }
    return out;
}

export async function scrapeJust4Anime(ctx) {
    if (!enabled()) return [];
    if (!ctx.title) return [];
    let aniId = null;
    try {
        aniId = await anilistId(ctx);
    } catch (e) {
        aniId = null;
    }
    if (!aniId) return [];
    const episode = ctx.isTv ? ctx.episode || 1 : 1;
    let servers = [];
    try {
        const json = JSON.parse(await fetchText(API + "/meta/availability/" + aniId + "/servers",
            { Referer: BASE + "/" }, 15000));
        servers = ((json && json.data && json.data.servers) || []).filter(function (s) {
            return s && s.code && s.hasEpisode !== false;
        });
    } catch (e) {
        return [];
    }
    if (!servers.length) return [];
    const line1 = headline(ctx.originalTitle || ctx.title, ctx.isTv ? null : ctx.year,
        ctx.isTv ? seasonEpCode(ctx.season, ctx.episode) : "");
    const tasks = [];
    servers.slice(0, 6).forEach(function (srv) {
        const types = [];
        (srv.types && srv.types.length ? srv.types : ["sub"]).forEach(function (t) {
            const clean = String(t || "").replace("h-sub", "hsub");
            if (clean && types.indexOf(clean) === -1) types.push(clean);
        });
        types.slice(0, 3).forEach(function (type) {
            tasks.push(function () {
                return fetchServerSources(aniId, srv, type, episode, line1);
            });
        });
    });
    const out = [];
    for (let i = 0; i < tasks.length; i += 6) {
        const settled = await Promise.all(tasks.slice(i, i + 6).map(function (t) {
            return t().catch(function () { return []; });
        }));
        settled.forEach(function (r) {
            if (Array.isArray(r)) out.push.apply(out, r);
        });
    }
    return out;
}
