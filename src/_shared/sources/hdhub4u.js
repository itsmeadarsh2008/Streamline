/**
 * HDHub4u (Streamline). Port of CineStream master `invokeHdhub4u()`.
 * Typesense search (IMDb id first, then title) -> post page -> per-quality /
 * per-episode hub rows -> shared hub resolvers (hubcloud, hubdrive, hubcdn,
 * hdstream4u, hubstream, hblinks).
 */
import { dynUrl } from '../constants.js';
import { fetchText } from '../utils.js';
import { resolveSourceLink } from './hubcloud.js';

const MAIN_FALLBACK = "https://new8.hdhub4u.cl";
const PINGORA = "https://search.pingora.fyi/collections/post/documents/search";

const EXCLUDE_HOST = /catimages|imdb\.|whatsapp|telegram|twitter\.|facebook|instagram|youtube|snvhost|4khdhub\./i;
const SELF_HOST = /hdhub4u\./i;
const RESOLVER_HOST = /hubcloud|vcloud|hubdrive|hubcdn|hdstream4u|hubstream|hblinks|hubstream\.dad|gdflix|gdlink|greenmotors|greenmount|pixeldra|filepress|r2\.dev|workers\.dev/i;
const QUALITY_TEXT = /(480|720|1080|2160|\b4K\b|HEVC|x264|x265|WATCH|PLAYER|DOWNLOAD)/i;

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.hdhub4u !== false;
    } catch (e) {
        return true;
    }
}

async function base() {
    return (await dynUrl("hdhub4u")) || MAIN_FALLBACK;
}

/** Typesense hit -> permalinks (CineStream queries pingora with the IMDb id). */
async function searchCandidates(baseUrl, ctx) {
    const queries = [];
    if (ctx.imdbId) {
        queries.push({
            q: ctx.imdbId,
            fields: "post_title%2Ccategory%2Cstars%2Cdirector%2Cimdb_id",
            weights: "4%2C2%2C2%2C2%2C4"
        });
    }
    if (ctx.title) {
        queries.push({
            q: ctx.title + (ctx.isTv && ctx.season ? " Season " + ctx.season : "") + (ctx.year ? " " + ctx.year : ""),
            fields: "post_title%2Ccategory",
            weights: "4%2C2"
        });
    }
    const out = [];
    for (const qq of queries) {
        try {
            const url = PINGORA + "?q=" + encodeURIComponent(qq.q) +
                "&query_by=" + qq.fields + "&query_by_weights=" + qq.weights +
                "&sort_by=sort_by_date%3Adesc&limit=15&highlight_fields=none&use_cache=true&page=1";
            const json = JSON.parse(await fetchText(url,
                { Accept: "application/json", Referer: baseUrl + "/" }, 15000));
            ((json && json.hits) || []).forEach(function (h) {
                const p = h && h.document && h.document.permalink;
                if (p && out.indexOf(p) === -1) out.push(p);
            });
            if (out.length) break;
        } catch (e) { /* try next query */ }
    }
    return out.slice(0, 6);
}

/** Rewrite a permalink onto the live domain (stale mirrors rotate constantly). */
function normalizePermalink(baseUrl, permalink) {
    if (/^https?:/i.test(permalink)) {
        try {
            const u = new URL(permalink);
            if (SELF_HOST.test(u.hostname)) return baseUrl + u.pathname + (u.search || "");
            return permalink;
        } catch (e) {
            return permalink;
        }
    }
    if (permalink.charAt(0) === "/") return baseUrl + permalink;
    return baseUrl + "/" + permalink;
}

function stripTags(html) {
    return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Season guard: page titles carry "Season N" for series (CineStream checks it). */
function seasonMatches(html, ctx) {
    if (!ctx.isTv) return true;
    const t = (String(html).match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
    const m = t.match(/Season\s*0*(\d+)/i);
    if (!m) return true;
    return parseInt(m[1], 10) === ctx.season;
}

/** {href, hint} rows from a page slice, filtered to real download rows. */
function collectLinks(html) {
    const out = [];
    const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a\s*>/gi;
    let m;
    while ((m = re.exec(String(html || ""))) !== null) {
        const href = m[1];
        const text = stripTags(m[2]);
        if (!/^https?:/i.test(href)) continue;
        if (EXCLUDE_HOST.test(href) || SELF_HOST.test(href)) continue;
        if (!RESOLVER_HOST.test(href) && !QUALITY_TEXT.test(text) && !/[?&]id=/.test(href)) continue;
        if (out.some(function (o) { return o.href === href; })) continue;
        out.push({ href: href, hint: text });
    }
    return out;
}

/** Slice of the page belonging to one EPiSODE heading (raw-HTML walk). */
function episodeSlice(html, episode) {
    const blocks = [];
    const re = /<h[2-5][^>]*>[\s\S]*?<\/h[2-5]\s*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const text = stripTags(m[0]);
        const em = text.match(/EPiSODE\s*0*(\d+)/i);
        blocks.push({ start: m.index, ep: em ? parseInt(em[1], 10) : null });
    }
    const idx = blocks.findIndex(function (b) { return b.ep === episode; });
    if (idx === -1) return "";
    const start = blocks[idx].start;
    let end = html.length;
    for (let i = idx + 1; i < blocks.length; i++) {
        if (blocks[i].ep !== null) { end = blocks[i].start; break; }
    }
    if (end - start > 40000) end = start + 40000;
    return html.slice(start, end);
}

export async function scrapeHdhub4u(ctx) {
    if (!enabled()) return [];
    if (!ctx.imdbId && !ctx.title) return [];
    let baseUrl = "";
    try {
        baseUrl = await base();
    } catch (e) {
        baseUrl = MAIN_FALLBACK;
    }
    const candidates = await searchCandidates(baseUrl, ctx);
    if (!candidates.length) return [];
    const out = [];
    for (const raw of candidates.slice(0, 4)) {
        try {
            const url = normalizePermalink(baseUrl, raw);
            const html = await fetchText(url, { Referer: baseUrl + "/", Cookie: "xla=s4t" }, 20000);
            if (!seasonMatches(html, ctx)) continue;
            const rows = (ctx.isTv ? collectLinks(episodeSlice(html, ctx.episode)) : collectLinks(html)).slice(0, 10);
            if (!rows.length) continue;
            for (let i = 0; i < rows.length; i += 3) {
                const chunk = rows.slice(i, i + 3);
                const settled = await Promise.all(chunk.map(function (row) {
                    try {
                        return resolveSourceLink("HDHub4u", row.href, row.hint).catch(function () { return []; });
                    } catch (e) {
                        return Promise.resolve([]);
                    }
                }));
                settled.forEach(function (r) {
                    if (Array.isArray(r)) out.push.apply(out, r);
                });
            }
            if (out.length) break;
        } catch (e) { /* next candidate */ }
    }
    return out;
}
