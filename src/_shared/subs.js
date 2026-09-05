/**
 * Subtitle aggregation. Port of CineStream `invokeStremioSubtitles()` and
 * `invokeWYZIESubs()` — subtitles are attached to streams Nuvio-side.
 */
import { WYZIE_API } from './constants.js';
import { fetchText } from './utils.js';

// Full configured Stremio subtitle endpoints (port of CineStream
// invokeStremioSubtitles — the language/config segments are part of the
// route; bare bases 404).
export const STREMIO_SUBS = [
    "https://opensubtitles.stremio.homes/en|hi|de|ar|tr|es|ta|te|ru|ko/ai-translated=true|from=all|auto-adjustment=true",
    "https://subsense.nepiraw.com/n0tcjfba-{\"languages\":[\"en\",\"hi\",\"ta\",\"es\",\"ar\"],\"maxSubtitles\":10}"
];

function settings() {
    try {
        return globalThis.SCRAPER_SETTINGS || {};
    } catch (e) {
        return {};
    }
}

export async function stremioSubtitles(imdbId, season, episode, isTv) {
    const out = [];
    if (!imdbId) return out;
    const path = isTv
        ? "/subtitles/series/" + imdbId + ":" + season + ":" + episode + ".json"
        : "/subtitles/movie/" + imdbId + ".json";
    const jobs = STREMIO_SUBS.map(function (base) {
        return (async function () {
            try {
                const json = JSON.parse(await fetchText(base + path, {}, 12000));
                const list = (json && json.subtitles) || [];
                list.slice(0, 12).forEach(function (s) {
                    if (!s || !s.url) return;
                    out.push({
                        url: s.url,
                        language: s.lang || s.lang_code || "en",
                        name: (s.title || s.lang || "Subtitle") + " [Stremio]"
                    });
                });
            } catch (e) {
                console.log("[Streamline][subs] " + base + ": " + e.message);
            }
        })();
    });
    await Promise.all(jobs);
    return out;
}

export async function wyzieSubtitles(imdbId, season, episode, isTv) {
    const key = settings().wyzieKey;
    if (!key || !imdbId) return [];
    const url = isTv
        ? WYZIE_API + "/search?id=" + imdbId + "&season=" + season + "&episode=" + episode + "&source=all&key=" + key
        : WYZIE_API + "/search?id=" + imdbId + "&source=all&key=" + key;
    try {
        const list = JSON.parse(await fetchText(url, {}, 12000));
        return (Array.isArray(list) ? list : []).slice(0, 12).map(function (s) {
            return {
                url: s.url,
                language: s.language || "en",
                name: (s.display || s.language || "Subtitle") + " [Wyzie]"
            };
        });
    } catch (e) {
        console.log("[Streamline][wyzie] " + e.message);
        return [];
    }
}

/** Attach shared subtitles to streams that came back without any. */
export function attachSubtitles(streams, subtitles) {
    if (!subtitles || !subtitles.length) return streams;
    return streams.map(function (s) {
        if (s.subtitles && s.subtitles.length) return s;
        const copy = Object.assign({}, s);
        copy.subtitles = subtitles.slice(0, 8);
        return copy;
    });
}

/** Fetch + attach shared subtitles (Stremio backends + Wyzie) in one call. */
export async function withSharedSubs(streams, ctx) {
    try {
        if (!ctx || !ctx.imdbId) return streams;
        const subs = (await stremioSubtitles(ctx.imdbId, ctx.season, ctx.episode, ctx.isTv)).concat(
            await wyzieSubtitles(ctx.imdbId, ctx.season, ctx.episode, ctx.isTv)
        );
        return attachSubtitles(streams, subs);
    } catch (e) {
        return streams;
    }
}

/** Wyzie key field for provider settings screens that use shared subs. */
export function wyzieKeyField() {
    return {
        type: "text",
        key: "wyzieKey",
        label: "Wyzie subtitles key",
        placeholder: "Optional Wyzie API key",
        description: "Extra subtitles alongside the built-in Stremio ones."
    };
}
