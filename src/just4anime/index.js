/**
 * Just4Anime provider (Streamline). Multi-server anime sub/dub HLS with
 * real VTT subtitles. Port of CineStream master `invokeJust4Anime()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { presentStreams } from '../_shared/meta.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrapeJust4Anime } from '../_shared/sources/just4anime.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrapeJust4Anime(ctx), 25000, "just4anime");
        return presentStreams(dedupe(await withSharedSubs(out, ctx)), ctx);
    } catch (e) {
        console.log("[Streamline][just4anime] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [wyzieKeyField()];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
