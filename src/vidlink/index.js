/**
 * Vidlink provider (Streamline). Encoded TMDB lookup + qualities/captions.
 * Port of CineStream `invokeVidlink()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { scrape } from '../_shared/sources/vidlink.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        return dedupe(await withTimeout(scrape(ctx), 20000, "vidlink"));
    } catch (e) {
        console.log("[Streamline][vidlink] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
