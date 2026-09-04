/**
 * Cinejoy provider (Streamline). Encrypted /g exchange, multi-server.
 * Port of CineStream `invokeCinejoy()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrape } from '../_shared/sources/cinejoy.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrape(ctx), 20000, "cinejoy");
        return dedupe(await withSharedSubs(out, ctx));
    } catch (e) {
        console.log("[Streamline][cinejoy] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
