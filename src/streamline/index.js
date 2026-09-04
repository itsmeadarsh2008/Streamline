/**
 * Streamline — Nuvio provider entry point.
 *
 * Port of CineStream (`CineStreamProvider` + `CineStreamExtractors`
 * fan-out) under the Streamline name. Nuvio invokes `getStreams()` with a
 * TMDB id; we resolve title/year/IMDb via TMDB, then fan out to every
 * enabled source concurrently (port of `invokeAllSources`) and merge the
 * results into one normalized stream list.
 */
import { fetchTmdbMeta } from './tmdb.js';
import { runLimited, withTimeout } from './utils.js';
import { attachSubtitles, stremioSubtitles, wyzieSubtitles } from './subs.js';
import { torrentSources } from './torrents.js';
import { scrape as scrapeVidlink } from './sources/vidlink.js';
import { scrape as scrapeVideasy } from './sources/videasy.js';
import { scrape as scrapeHexa } from './sources/hexa.js';
import { scrape as scrapeVidzee } from './sources/vidzee.js';
import { scrape as scrapeVidrock } from './sources/vidrock.js';
import { scrapeVidcore, scrapeVidfast } from './sources/vidfast.js';
import { scrapePrimesrc, scrapeVaplayer } from './sources/misc.js';
import { scrape as scrapeShowbox } from './sources/showbox.js';
import { scrape as scrapeMoviebox } from './sources/moviebox.js';
import { scrape as scrapeAllmovieland } from './sources/allmovieland.js';
import { scrape as scrapeCinejoy } from './sources/cinejoy.js';
import { scrapeAnizone } from './sources/anime.js';
import {
    scrape4khdhub,
    scrapeBollyflix,
    scrapeMoviesdrive,
    scrapeMoviesmod,
    scrapeRogmovies,
    scrapeUhdmovies,
    scrapeVegamovies
} from './sources/indian.js';

function settings() {
    try {
        return globalThis.SCRAPER_SETTINGS || {};
    } catch (e) {
        return {};
    }
}

function dedupe(streams) {
    const seen = {};
    const out = [];
    streams.forEach(function (s) {
        if (!s || !s.url) return;
        const key = s.url;
        if (seen[key]) return;
        seen[key] = true;
        out.push(s);
    });
    return out;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isTv = mediaType === "tv";
    const seasonNum = season != null ? season : 1;
    const episodeNum = episode != null ? episode : 1;
    console.log(
        "[Streamline] getStreams tmdb=" + tmdbId + " type=" + mediaType +
        (isTv ? " s=" + seasonNum + " e=" + episodeNum : "")
    );

    const meta = await fetchTmdbMeta(String(tmdbId), mediaType);
    const countries = meta.countries || [];
    const isBollywood = countries.some(function (c) {
        return /india|\bIN\b/i.test(String(c));
    });

    const ctx = {
        tmdbId: meta.tmdbId || parseInt(tmdbId, 10) || null,
        imdbId: meta.imdbId,
        title: meta.title,
        originalTitle: meta.originalTitle,
        year: meta.year,
        season: seasonNum,
        episode: episodeNum,
        isTv: isTv,
        isBollywood: isBollywood
    };

    const cfg = settings();
    // Keep the whole fan-out comfortably inside Nuvio's ~60s execution cap:
    // 22 sources / 8-wide waves / <=15s each ≈ <=45s worst case.
    const concurrency = Math.max(2, Math.min(10, cfg.concurrency || 8));

    const tasks = [
        function () { return withTimeout(scrapeVidlink(ctx), 15000, "vidlink"); },
        function () { return withTimeout(scrapeVideasy(ctx), 15000, "videasy"); },
        function () { return withTimeout(scrapeHexa(ctx), 15000, "hexa"); },
        function () { return withTimeout(scrapeVidzee(ctx), 12000, "vidzee"); },
        function () { return withTimeout(scrapeVidrock(ctx), 15000, "vidrock"); },
        function () { return withTimeout(scrapeVidfast(ctx), 15000, "vidfast"); },
        function () { return withTimeout(scrapeVidcore(ctx), 15000, "vidcore"); },
        function () { return withTimeout(scrapeVaplayer(ctx), 12000, "vaplayer"); },
        function () { return withTimeout(scrapePrimesrc(ctx), 12000, "primesrc"); },
        function () { return withTimeout(scrapeShowbox(ctx), 15000, "showbox"); },
        function () { return withTimeout(scrapeMoviebox(ctx), 15000, "moviebox"); },
        function () { return withTimeout(scrapeAllmovieland(ctx), 15000, "allmovieland"); },
        function () { return withTimeout(scrapeCinejoy(ctx), 15000, "cinejoy"); },
        function () { return withTimeout(scrape4khdhub(ctx), 15000, "4khdhub"); },
        function () { return withTimeout(scrapeUhdmovies(ctx), 15000, "uhdmovies"); },
        function () { return withTimeout(scrapeMoviesmod(ctx), 15000, "moviesmod"); },
        function () { return withTimeout(scrapeMoviesdrive(ctx), 15000, "moviesdrive"); },
        function () { return withTimeout(scrapeVegamovies(ctx), 15000, "vegamovies"); },
        function () { return withTimeout(scrapeRogmovies(ctx), 15000, "rogmovies"); },
        function () { return withTimeout(scrapeBollyflix(ctx), 15000, "bollyflix"); },
        function () { return withTimeout(scrapeAnizone(ctx), 12000, "anizone"); },
        function () { return withTimeout(torrentSources(ctx.imdbId, seasonNum, episodeNum, isTv), 12000, "torrents"); }
    ];

    let streams = dedupe(await runLimited(tasks, concurrency));

    // Shared subtitles (port of invokeStremioSubtitles / invokeWYZIESubs):
    // attach to streams that arrived without any.
    try {
        const subs = (await stremioSubtitles(ctx.imdbId, seasonNum, episodeNum, isTv)).concat(
            await wyzieSubtitles(ctx.imdbId, seasonNum, episodeNum, isTv)
        );
        streams = attachSubtitles(streams, subs);
    } catch (e) {
        console.log("[Streamline][subs] " + e.message);
    }

    console.log("[Streamline] returning " + streams.length + " streams for " + (meta.title || tmdbId));
    return streams;
}

/**
 * Provider settings screen (Nuvio `onSettings` blueprint).
 * Mirrors the CineStream settings: per-provider toggles plus the tokens
 * CineStream keeps in its own settings (ShowBox/FebBox token, Wyzie key).
 */
async function onSettings() {
    function toggle(key, label, defaultValue) {
        return { type: "toggle", key: key, label: label, defaultValue: defaultValue !== false };
    }
    return [
        { type: "header", label: "Streamline Sources" },
        { type: "info", label: "Port of CineStream. Disable any source that is slow or broken for you." },
        toggle("vidlink", "Vidlink", true),
        toggle("videasy", "Videasy", true),
        toggle("hexa", "Hexa", true),
        toggle("vidzee", "Vidzee", true),
        toggle("vidrock", "Vidrock", true),
        toggle("vidfast", "VidFast", true),
        toggle("vidcore", "Vidcore", true),
        toggle("vaplayer", "VaPlayer", true),
        toggle("primesrc", "PrimeSrc", true),
        toggle("showbox", "ShowBox (needs token)", true),
        toggle("moviebox", "MovieBox", true),
        toggle("allmovieland", "AllMovieLand", true),
        toggle("cinejoy", "Cinejoy", true),
        toggle("anizone", "Anizone (anime)", true),
        { type: "header", label: "Indian mirrors" },
        toggle("hdhub", "4KHDHub", true),
        toggle("uhdmovies", "UHDMovies", true),
        toggle("moviesmod", "MoviesMod", true),
        toggle("moviesdrive", "MoviesDrive", true),
        toggle("vegamovies", "VegaMovies", true),
        toggle("rogmovies", "RogMovies", true),
        toggle("bollyflix", "Bollyflix", true),
        { type: "header", label: "Torrents (P2P — resolved by Nuvio debrid)" },
        toggle("enableTorrents", "Enable torrent sources", true),
        toggle("torrentio", "Torrentio", true),
        toggle("torrentsdb", "TorrentsDB", true),
        { type: "header", label: "Tokens & performance" },
        {
            type: "text",
            key: "showboxToken",
            label: "ShowBox / FebBox token",
            placeholder: "Paste FebBox ui token",
            description: "Same token CineStream uses for ShowBox quality lists."
        },
        {
            type: "text",
            key: "wyzieKey",
            label: "Wyzie subtitles key",
            placeholder: "Optional Wyzie API key",
            description: "Enables extra Wyzie subtitles alongside the built-in Stremio ones."
        },
        {
            type: "select",
            key: "concurrency",
            label: "Max parallel sources",
            options: [
                { label: "2 (slow networks)", value: 2 },
                { label: "4", value: 4 },
                { label: "6", value: 6 },
                { label: "8 (default)", value: 8 },
                { label: "10 (fast networks)", value: 10 }
            ],
            defaultValue: 8
        }
    ];
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
