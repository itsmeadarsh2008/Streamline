/**
 * Vidzee provider (Streamline). AES-256-CBC link decrypt, multi-server.
 * Port of CineStream `invokeVidzee()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { presentStreams } from '../_shared/meta.js';
import { scrape } from '../_shared/sources/vidzee.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        // Vidzee ships its own subtitle tracks; no shared subs needed.
        const out = await withTimeout(scrape(ctx), 20000, "vidzee");
        return presentStreams(dedupe(out), ctx);
    } catch (e) {
        console.log("[Streamline][vidzee] " + (e && e.message));
        return [];
    }
}

module.exports = { getStreams: getStreams };
