/**
 * MovieBox provider (Streamline). x-user token -> search -> download/play.
 * Port of CineStream `invokeMoviebox()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { scrape } from '../_shared/sources/moviebox.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        return dedupe(await withTimeout(scrape(ctx), 20000, "moviebox"));
    } catch (e) {
        console.log("[Streamline][moviebox] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
