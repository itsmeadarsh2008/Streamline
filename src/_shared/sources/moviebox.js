/**
 * MovieBox source (h5-api variant). Port of CineStream `invokeMoviebox()`.
 * x-user token -> subject search -> detail path -> download + play endpoints.
 */
import { MOVIEBOX_BASE, UA } from '../constants.js';
import { fetchText, makeStream, postJson } from '../utils.js';

function enabled() {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s.moviebox !== false;
    } catch (e) {
        return true;
    }
}

function unwrap(obj) {
    if (!obj || typeof obj !== "object") return {};
    if (obj.data && obj.data.data) return obj.data.data;
    if (obj.data) return obj.data;
    return obj;
}

function cleanTitle(t) {
    return String(t || "")
        .replace(/\sS\d+.*$/i, "")
        .trim()
        .toLowerCase();
}

export async function scrape(ctx) {
    if (!enabled()) return [];
    if (!ctx.title) return [];
    const isTv = ctx.isTv;
    try {
        const pkgRes = await fetch(MOVIEBOX_BASE + "/wefeed-h5api-bff/app/get-latest-app-pkgs?app_name=moviebox", {
            headers: { "User-Agent": UA }
        });
        let token = "";
        try {
            const xUser =
                (pkgRes.headers && (pkgRes.headers.get("x-user") || pkgRes.headers.get("X-User"))) || "";
            token = (JSON.parse(xUser) || {}).token || "";
        } catch (e) {
            token = "";
        }

        const baseHeaders = {
            "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
            "Accept-Language": "en-US,en;q=0.5",
            Accept: "application/json",
            Referer: MOVIEBOX_BASE,
            Host: "h5-api.aoneroom.com",
            Connection: "keep-alive",
            Authorization: "Bearer " + token,
            "User-Agent": UA
        };

        const searchObj = await postJson(
            MOVIEBOX_BASE + "/wefeed-h5api-bff/subject/search",
            { keyword: ctx.title, page: 1, perPage: 24, subjectType: !isTv ? 1 : 2 },
            baseHeaders,
            20000
        );
        const items = unwrap(searchObj).items || [];
        const want = cleanTitle(ctx.title);
        let subjectId = null;
        let lang = "Original";
        for (const it of items) {
            const t = cleanTitle(it.title || it.name);
            if (t === want || t.indexOf(want) !== -1 || want.indexOf(t) !== -1) {
                subjectId = it.id || it.subjectId;
                lang = it.lanName || it.language || lang;
                break;
            }
        }
        if (!subjectId && items.length) {
            subjectId = items[0].id || items[0].subjectId;
            lang = items[0].lanName || items[0].language || lang;
        }
        if (!subjectId) return [];

        const detailObj = JSON.parse(
            await fetchText(
                "https://h5.aoneroom.com/wefeed-h5-bff/web/post/list/subject?id=" + subjectId,
                {},
                15000
            )
        );
        const detailItems = (((detailObj.data || {}).items) || []);
        const detailPath = detailItems.length && detailItems[0].subject
            ? detailItems[0].subject.detailPath || ""
            : "";

        const params =
            "subjectId=" + subjectId +
            (isTv ? "&se=" + ctx.season + "&ep=" + ctx.episode : "") +
            (detailPath ? "&detailPath=" + encodeURIComponent(detailPath) : "");
        const reqHeaders = Object.assign({}, baseHeaders, {
            Referer: "https://fmoviesunblocked.net/spa/videoPlayPage/movies/" + detailPath + "?id=" + subjectId + "&type=/movie/detail",
            Origin: "https://fmoviesunblocked.net"
        });

        const playHeaders = { Referer: reqHeaders.Referer, Origin: reqHeaders.Origin, "User-Agent": UA };
        const out = [];
        const seen = {};
        async function collect(url) {
            try {
                const obj = JSON.parse(await fetchText(MOVIEBOX_BASE + url + params, reqHeaders, 20000));
                const data = unwrap(obj);
                (data.downloads || data.streams || []).forEach(function (d) {
                    if (!d || !d.url || d.vipLocked) return;
                    const res = d.resolution || d.resolutions || "Auto";
                    if (seen[res]) return;
                    seen[res] = true;
                    const s = makeStream(
                        "MovieBox",
                        "MovieBox [" + lang + "] - " + res,
                        d.url,
                        res,
                        playHeaders,
                        []
                    );
                    if (s) out.push(s);
                });
                ((data.captions) || []).forEach(function (c) {
                    if (!c || !c.url) return;
                    const sub = {
                        url: c.url,
                        language: c.lan || c.lanName || "en",
                        name: (c.lanName || c.lan || "Subtitle") + " [MovieBox]"
                    };
                    out.forEach(function (s) {
                        s.subtitles = (s.subtitles || []).concat([sub]).slice(0, 8);
                    });
                });
            } catch (e) {
                return;
            }
        }
        await collect("/wefeed-h5api-bff/subject/download?");
        await collect("/wefeed-h5api-bff/subject/play?");
        return out;
    } catch (e) {
        console.log("[Streamline][moviebox] " + e.message);
        return [];
    }
}
