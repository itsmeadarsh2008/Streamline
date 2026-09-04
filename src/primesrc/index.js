/**
 * PrimeSrc provider (Streamline). Server list -> per-key link resolve.
 * Port of CineStream `invokePrimeSrc()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { presentStreams } from '../_shared/meta.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrapePrimesrc } from '../_shared/sources/misc.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrapePrimesrc(ctx), 20000, "primesrc");
        return presentStreams(dedupe(await withSharedSubs(out, ctx)), ctx);
    } catch (e) {
        console.log("[Streamline][primesrc] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
