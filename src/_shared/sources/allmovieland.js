/**
 * AllMovieLand source. Port of CineStream `invokeAllmovieland()`.
 * player.js host discovery -> /play/{imdb} playlist -> per-server .txt resolve.
 */
import { ALLMOVIELAND_API, UA } from '../constants.js';
import { fetchText, makeStream } from '../utils.js';

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.allmovieland !== false;
    } catch (e) {
        return true;
    }
}

export async function scrape(ctx) {
    if (!enabled()) return [];
    if (!ctx.imdbId) return [];
    const referer = ALLMOVIELAND_API + "/";
    try {
        const playerJs = await fetchText(ALLMOVIELAND_API + ".link/player.js?v=60%20128", { "User-Agent": UA }, 15000);
        const hostM = playerJs.match(/const AwsIndStreamDomain.*'(.*)';/);
        const host = hostM ? hostM[1] : null;
        if (!host) return [];

        const playHtml = await fetchText(host + "/play/" + ctx.imdbId, { Referer: referer, "User-Agent": UA }, 20000);
        const scriptM = playHtml.match(/<script[^>]*>([\s\S]*?playlist[\s\S]*?)<\/script>/);
        const scriptBody = scriptM ? scriptM[1] : playHtml;
        let blob = scriptBody.substring(scriptBody.indexOf("{"));
        blob = blob.substring(0, blob.indexOf(";"));
        const cut = blob.lastIndexOf(")");
        if (cut !== -1) blob = blob.substring(0, cut);
        let playlist;
        try {
            playlist = JSON.parse(blob);
        } catch (e) {
            return [];
        }
        if (!playlist || !playlist.file) return [];

        const fileUrl = String(playlist.file).indexOf("http") === 0
            ? playlist.file
            : host + playlist.file;
        const serversText = (await (async function () {
            const res = await fetch(fileUrl, {
                headers: {
                    "X-CSRF-TOKEN": playlist.key || "",
                    Referer: referer,
                    "User-Agent": UA
                }
            });
            return await res.text();
        })()).replace(/,\s*\[]/g, "");
        let servers;
        try {
            servers = JSON.parse(serversText);
        } catch (e) {
            return [];
        }

        let pairs = [];
        if (!ctx.isTv) {
            pairs = (servers || []).map(function (s) {
                return { file: s.file, lang: s.title || "Server" };
            });
        } else {
            const season = (servers || []).find(function (s) {
                return String(s.id) === String(ctx.season);
            });
            const folder = season && season.folder;
            const ep = folder && Object.keys(folder).map(function (k) { return folder[k]; }).find(function (e) {
                return e && String(e.episode) === String(ctx.episode);
            });
            const epFolder = ep && ep.folder;
            if (epFolder) {
                pairs = Object.keys(epFolder).map(function (k) {
                    return { file: epFolder[k].file, lang: epFolder[k].title || "Server" };
                });
            }
        }

        const out = [];
        for (const p of pairs) {
            try {
                if (!p.file) continue;
                const res = await fetch(host + "/playlist/" + p.file + ".txt", {
                    headers: { "X-CSRF-TOKEN": playlist.key || "", Referer: referer, "User-Agent": UA }
                });
                const path = (await res.text()).trim();
                if (!path) continue;
                const s = makeStream(
                    "Allmovieland",
                    "Allmovieland [" + p.lang + "] [HLS]",
                    path,
                    "1080p",
                    { Referer: referer, "User-Agent": UA },
                    []
                );
                if (s) out.push(s);
            } catch (e) {
                continue;
            }
        }
        return out;
    } catch (e) {
        console.log("[Streamline][allmovieland] " + e.message);
        return [];
    }
}
