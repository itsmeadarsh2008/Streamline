/**
 * Vidcore provider (Streamline). Same family as VidFast, Vidcore endpoints.
 * Port of CineStream `invokeVidcore()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { scrapeVidcore } from '../_shared/sources/vidfast.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        return dedupe(await withTimeout(scrapeVidcore(ctx), 20000, "vidcore"));
    } catch (e) {
        console.log("[Streamline][vidcore] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
