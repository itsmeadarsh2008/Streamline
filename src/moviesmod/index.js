/**
 * MoviesMod provider (Streamline). IMDb search -> quality headers -> bypass.
 * Port of CineStream `invokeMoviesmod()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrapeMoviesmod } from '../_shared/sources/indian.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrapeMoviesmod(ctx), 20000, "moviesmod");
        return dedupe(await withSharedSubs(out, ctx));
    } catch (e) {
        console.log("[Streamline][moviesmod] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
