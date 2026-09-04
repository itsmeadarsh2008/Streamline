/**
 * VidFast provider (Streamline). Page token -> servers -> streams + subs.
 * Port of CineStream `invokeVidFastPro()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { presentStreams } from '../_shared/meta.js';
import { scrapeVidfast } from '../_shared/sources/vidfast.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrapeVidfast(ctx), 20000, "vidfast");
        return presentStreams(dedupe(out), ctx);
    } catch (e) {
        console.log("[Streamline][vidfast] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
