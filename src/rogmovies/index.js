/**
 * RogMovies provider (Streamline). Used for Indian (Bollywood) titles.
 * Port of CineStream `invokeVegamovies()` ("RogMovies" branch).
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { presentStreams } from '../_shared/meta.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrapeRogmovies } from '../_shared/sources/indian.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrapeRogmovies(ctx), 20000, "rogmovies");
        return presentStreams(dedupe(await withSharedSubs(out, ctx)), ctx);
    } catch (e) {
        console.log("[Streamline][rogmovies] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
