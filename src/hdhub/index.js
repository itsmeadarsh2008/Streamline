/**
 * 4KHDHub provider (Streamline). Title search -> HubCloud terminals.
 * Full quality kept, from 480p up to UHD REMUX. Port of CineStream
 * `invoke4khdhub()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrape4khdhub } from '../_shared/sources/indian.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrape4khdhub(ctx), 20000, "4khdhub");
        return dedupe(await withSharedSubs(out, ctx));
    } catch (e) {
        console.log("[Streamline][4khdhub] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
