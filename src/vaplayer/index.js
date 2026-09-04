/**
 * VaPlayer provider (Streamline). Single JSON API, M3U8 + default subs.
 * Port of CineStream `invokeVaPlayer()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { presentStreams } from '../_shared/meta.js';
import { scrapeVaplayer } from '../_shared/sources/misc.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrapeVaplayer(ctx), 20000, "vaplayer");
        return presentStreams(dedupe(out), ctx);
    } catch (e) {
        console.log("[Streamline][vaplayer] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
