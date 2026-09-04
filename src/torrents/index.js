/**
 * Torrents provider (Streamline). Torrentio + TorrentsDB magnets for
 * Nuvio's native debrid resolution (Torbox/Premiumize).
 * Port of CineStream `invokeStremioTorrents()`. Full quality kept —
 * including giant REMUX swarms; pick by size label to taste.
 */
import { buildCtx } from '../_shared/tmdb.js';
import { dedupe, withTimeout } from '../_shared/utils.js';
import { torrentSources } from '../_shared/torrents.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const ctx = await buildCtx(tmdbId, mediaType, season, episode);
        const out = await withTimeout(
            torrentSources(ctx.imdbId, ctx.season, ctx.episode, ctx.isTv),
            20000,
            "torrents"
        );
        return dedupe(out);
    } catch (e) {
        console.log("[Streamline][torrents] " + (e && e.message));
        return [];
    }
}

async function onSettings() {
    return [
        { type: "header", label: "P2P backends (resolved by Nuvio debrid)" },
        { type: "toggle", key: "enableTorrents", label: "Enable torrent sources", defaultValue: true },
        { type: "toggle", key: "torrentio", label: "Torrentio", defaultValue: true },
        { type: "toggle", key: "torrentsdb", label: "TorrentsDB", defaultValue: true }
    ];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
