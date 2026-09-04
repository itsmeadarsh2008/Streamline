/**
 * Bollyflix provider (Streamline). IMDb search -> sidexfee unwrap.
 * Port of CineStream `invokeBollyflix()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrapeBollyflix } from '../_shared/sources/indian.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrapeBollyflix(ctx), 20000, "bollyflix");
        return dedupe(await withSharedSubs(out, ctx));
    } catch (e) {
        console.log("[Streamline][bollyflix] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
