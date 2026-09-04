/**
 * VaPlayer provider (Streamline). Single JSON API, M3U8 + default subs.
 * Port of CineStream `invokeVaPlayer()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { scrapeVaplayer } from '../_shared/sources/misc.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        return dedupe(await withTimeout(scrapeVaplayer(ctx), 20000, "vaplayer"));
    } catch (e) {
        console.log("[Streamline][vaplayer] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
