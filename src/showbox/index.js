/**
 * ShowBox provider (Streamline). Superstream search -> FebBox share ->
 * quality list. Requires a FebBox token (same token CineStream uses).
 * Port of CineStream `invokeShowbox()`.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { withSharedSubs, wyzieKeyField } from '../_shared/subs.js';
import { scrape } from '../_shared/sources/showbox.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(scrape(ctx), 20000, "showbox");
        return dedupe(await withSharedSubs(out, ctx));
    } catch (e) {
        console.log("[Streamline][showbox] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [
        {
            type: "text",
            key: "showboxToken",
            label: "ShowBox / FebBox token",
            placeholder: "Paste FebBox ui token",
            description: "Same token CineStream uses for ShowBox quality lists. ShowBox returns nothing without it."
        },
        wyzieKeyField()
    ];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
