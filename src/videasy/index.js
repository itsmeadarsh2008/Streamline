/**
 * Videasy provider (Streamline). Seed + multi-server sources with decrypt.
 * Port of CineStream `invokeVideasy()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { scrape } from '../_shared/sources/videasy.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        return dedupe(await withTimeout(scrape(ctx), 20000, "videasy"));
    } catch (e) {
        console.log("[Streamline][videasy] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
