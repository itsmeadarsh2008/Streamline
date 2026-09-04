/**
 * TMDB meta resolution. Nuvio calls providers with (tmdbId, mediaType, ...),
 * while CineStream scrapers are keyed on title/year/IMDb id — so every
 * Streamline source starts here. Port of the `load()` meta stage of
 * `CineStreamProvider.kt`.
 */
import { TMDB_API_KEY, TMDB_BASE_URL, UA } from './constants.js';

let metaCache = {};

export async function fetchTmdbMeta(tmdbId, mediaType) {
    const type = mediaType === "tv" ? "tv" : "movie";
    const cacheKey = type + ":" + tmdbId;
    if (metaCache[cacheKey]) return metaCache[cacheKey];

    const url =
        TMDB_BASE_URL + "/" + type + "/" + tmdbId +
        "?api_key=" + TMDB_API_KEY + "&append_to_response=external_ids";
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": UA, Accept: "application/json" }
        });
        if (!res.ok) throw new Error("TMDB HTTP " + res.status);
        const data = await res.json();
        const title =
            type === "movie"
                ? data.title || data.original_title || ""
                : data.name || data.original_name || "";
        const originalTitle = data.original_title || data.original_name || title;
        const date = data.release_date || data.first_air_date || "";
        const imdbId =
            (data.external_ids && data.external_ids.imdb_id) || null;
        const meta = {
            title: title,
            originalTitle: originalTitle,
            year: date ? parseInt(String(date).substring(0, 4), 10) || null : null,
            imdbId: imdbId,
            tmdbId: parseInt(tmdbId, 10) || null,
            countries: ((data.production_countries || []).map(function (c) {
                return c && (c.name || c.iso_3166_1);
            }).filter(Boolean))
        };
        metaCache[cacheKey] = meta;
        return meta;
    } catch (e) {
        console.log("[Streamline][tmdb] " + e.message);
        return { title: "", originalTitle: "", year: null, imdbId: null, tmdbId: null, countries: [] };
    }
}
