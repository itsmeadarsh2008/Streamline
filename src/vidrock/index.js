/**
 * Vidrock provider (Streamline). AES-256-GCM per-server URL decrypt.
 * Port of CineStream `invokeVidrock()`. Skips cleanly where the runtime
 * has no WebCrypto (AES-GCM needs SubtleCrypto).
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrape } from '../_shared/sources/vidrock.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrape(ctx), 20000, "vidrock");
        return dedupe(await withSharedSubs(out, ctx));
    } catch (e) {
        console.log("[Streamline][vidrock] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
