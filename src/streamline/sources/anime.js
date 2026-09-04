/**
 * Anime sources keyed on title only (no IMDb mapping needed).
 * Port of CineStream `invokeAnizone()` (anizone.to).
 */
import { UA } from '../constants.js';
import { fetchText, makeStream } from '../utils.js';
import cheerio from 'cheerio-without-node-native';

const ANIZONE_API = "https://anizone.to";

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.anizone !== false;
    } catch (e) {
        return true;
    }
}

export async function scrapeAnizone(ctx) {
    if (!enabled()) return [];
    const title = ctx.originalTitle || ctx.title;
    if (!title) return [];
    try {
        const searchHtml = await fetchText(
            ANIZONE_API + "/anime?search=" + encodeURIComponent(title),
            { "User-Agent": UA },
            20000
        );
        let $ = cheerio.load(searchHtml);
        const link = $("div.truncate > a").attr("href");
        if (!link) return [];
        const ep = ctx.isTv ? ctx.episode || 1 : 1;
        const pageHtml = await fetchText(
            (link.indexOf("http") === 0 ? link : ANIZONE_API + link) + "/" + ep,
            { "User-Agent": UA },
            20000
        );
        $ = cheerio.load(pageHtml);
        const subs = [];
        $("track").each(function (_, el) {
            const src = $(el).attr("src");
            if (src) {
                subs.push({
                    url: src,
                    language: $(el).attr("srclang") || "en",
                    name: ($(el).attr("label") || "Subtitle") + " [Anizone]"
                });
            }
        });
        const src = $("media-player").attr("src");
        if (!src) return [];
        const s = makeStream(
            "Anizone",
            "Anizone Multi Audio E" + ep + " [HLS]",
            src,
            "1080p",
            { Referer: ANIZONE_API + "/", "User-Agent": UA },
            subs.slice(0, 8)
        );
        return s ? [s] : [];
    } catch (e) {
        console.log("[Streamline][anizone] " + e.message);
        return [];
    }
}
