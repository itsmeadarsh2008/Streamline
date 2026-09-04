/**
 * Hexa provider (Streamline). Random key + token -> images -> dec-hexa.
 * Port of CineStream `invokeHexa()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrape } from '../_shared/sources/hexa.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrape(ctx), 20000, "hexa");
        return dedupe(await withSharedSubs(out, ctx));
    } catch (e) {
        console.log("[Streamline][hexa] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
