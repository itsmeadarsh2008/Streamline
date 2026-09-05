/**
 * AniDB provider (Streamline). Clean-room port of the community AniDB
 * provider approach: TMDB title search on anidb.app, episodes + languages
 * JSON APIs, m3u8 regex extraction from embed pages. No packing, no
 * Cloudflare tricks — plain fetch, so it runs in Nuvio's runtime as-is.
 */
import cheerio from 'cheerio-without-node-native';
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, fetchText, withTimeout } from '../_shared/utils.js';
import { presentStreams } from '../_shared/meta.js';
import { withSharedSubs } from '../_shared/subs.js';

const BASE_URL = "https://anidb.app";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HLS_REGEXES = [
    /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
    /sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
    /["'](https?:\/\/[^"']+\/master\.m3u8[^"']*)["']/i,
    /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i
];

function normalize(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function rankResults(results, title) {
    const want = normalize(title);
    const exact = [];
    const partial = [];
    results.forEach(function (r) {
        const t = normalize(r.title);
        if (t === want) exact.push(r);
        else if (t.indexOf(want) !== -1 || want.indexOf(t) !== -1) partial.push(r);
    });
    return exact.concat(partial);
}

async function searchSite(title) {
    const html = await fetchText(BASE_URL + "/browse?q=" + encodeURIComponent(title), {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }, 15000);
    const $ = cheerio.load(html);
    const out = [];
    const seen = {};
    $("a.anime-card").each(function (_, el) {
        const href = $(el).attr("href") || "";
        const name = $(el).attr("title") || $(el).find("img").attr("alt") || "";
        const url = href.indexOf("http") === 0 ? href : href.indexOf("//") === 0 ? "https:" + href : href[0] === "/" ? BASE_URL + href : BASE_URL + "/" + href;
        if (url && name && !seen[url]) {
            seen[url] = true;
            out.push({ url: url, title: name.trim() });
        }
    });
    return out;
}

async function getEpisodes(animeId) {
    const json = JSON.parse(await fetchText(BASE_URL + "/api/frontend/anime/" + animeId + "/episodes", {
        "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest"
    }, 15000));
    return (json && json.episodes) || [];
}

async function getLanguages(episodeId, animeSlug) {
    const json = JSON.parse(await fetchText(BASE_URL + "/api/frontend/episode/" + episodeId + "/languages", {
        "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest",
        Referer: BASE_URL + "/anime/" + animeSlug
    }, 15000));
    return (json && json.languages) || [];
}

async function extractEmbed(url) {
    try {
        const html = await fetchText(url, { "User-Agent": UA, Referer: BASE_URL + "/" }, 15000);
        for (let i = 0; i < HLS_REGEXES.length; i++) {
            const m = html.match(HLS_REGEXES[i]);
            if (m && m[1]) return m[1];
        }
    } catch (e) { /* no embed */ }
    return null;
}

function audioLabel(name) {
    const t = String(name || "").toLowerCase();
    if (t.indexOf("japanese") !== -1 || t.indexOf("jap") !== -1 || t.indexOf("jp") !== -1) return { label: "Japanese Audio", flag: "🇯🇵", lang: "ja" };
    if (t.indexOf("korean") !== -1 || t.indexOf("kor") !== -1 || /(^|[^a-z])kr([^a-z]|$)/.test(t)) return { label: "Korean Audio", flag: "🇰🇷", lang: "ko" };
    if (t.indexOf("english") !== -1 || /(^|[^a-z])en([^a-z]|$)/.test(t)) return { label: "English Audio", flag: "🇺🇸", lang: "en" };
    if (t.indexOf("dub") !== -1) return { label: "Dubbed", flag: "🎙️", lang: "en" };
    return { label: "Subbed", flag: "💬", lang: "en" };
}

async function scrape(ctx) {
    if (!ctx.title) return [];
    const ranked = rankResults(await searchSite(ctx.title), ctx.title);
    const ep = ctx.isTv ? (ctx.episode || 1) : 1;
    const out = [];
    for (const cand of ranked.slice(0, 3)) {
        try {
            const segs = cand.url.split("/").filter(Boolean);
            const last = segs[segs.length - 1] || "";
            const animeId = parseInt(last.split("-")[0], 10);
            if (!animeId) continue;
            const episodes = await getEpisodes(animeId);
            if (!episodes.length) continue;
            let match = null;
            for (let i = 0; i < episodes.length; i++) {
                if (episodes[i].number === ep) {
                    match = episodes[i];
                    break;
                }
            }
            if (!match) match = episodes[ep - 1] || episodes[0];
            if (!match || match.id == null) continue;
            const slug = cand.url.split("/").filter(Boolean).pop() || "";
            const langs = await getLanguages(match.id, slug);
            const jobs = langs.map(function (l) {
                return (async function () {
                    if (!l || !l.embed_url) return null;
                    const m3u8 = await extractEmbed(l.embed_url);
                    if (!m3u8) return null;
                    const a = audioLabel(l.name || "");
                    return {
                        name: "AniDB | " + a.label,
                        title: "🎬 " + ctx.title + (ctx.isTv ? " - (S" + String(ctx.season).padStart(2, "0") + "E" + String(ep).padStart(2, "0") + ")" : "") +
                            "\n⚡ HLS | " + a.flag + " " + a.label,
                        url: m3u8,
                        quality: "Auto",
                        headers: { Referer: BASE_URL + "/" },
                        subtitles: [],
                        language: a.lang
                    };
                })();
            });
            const settled = await Promise.all(jobs);
            const seen = {};
            settled.forEach(function (s) {
                if (s && s.url && !seen[s.url]) {
                    seen[s.url] = true;
                    out.push(s);
                }
            });
            if (out.length) break;
        } catch (e) {
            continue;
        }
    }
    return out;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrape(ctx), 20000, "anidb");
        return presentStreams(dedupe(await withSharedSubs(out, ctx)), ctx);
    } catch (e) {
        console.log("[Streamline][anidb] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
