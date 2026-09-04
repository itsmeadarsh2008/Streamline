/**
 * Anizone provider (Streamline). Title-based anime, multi-audio + subs.
 * Port of CineStream `invokeAnizone()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { presentStreams } from '../_shared/meta.js';
import { scrapeAnizone } from '../_shared/sources/anime.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrapeAnizone(ctx), 20000, "anizone");
        return presentStreams(dedupe(out), ctx);
    } catch (e) {
        console.log("[Streamline][anizone] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
