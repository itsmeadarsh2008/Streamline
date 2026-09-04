/**
 * ShowBox/FebBox source. Port of CineStream `invokeShowbox()` +
 * `searchSuperstream / getShareKey / getFileList / getVideoQualities()`.
 * Requires a FebBox token (same token CineStream stores in settings);
 * expose it as the `showboxToken` provider setting.
 */
import { FEBBOX_API, SHOWBOX_API } from '../constants.js';
import { fetchText, makeStream, parseQuality } from '../utils.js';

const SHOWBOX_HEADERS = {
    Accept: "application/json, text/html, */*",
    "Accept-Language": "en",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
};
const VIDEO_HEADERS = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.8",
    Connection: "keep-alive",
    Range: "bytes=0-",
    Referer: FEBBOX_API,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
};

function cfg() {
    try {
        return globalThis.SCRAPER_SETTINGS || {};
    } catch (e) {
        return {};
    }
}

function parseSearchHref(html) {
    const m =
        html.match(/class="film-name[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"/) ||
        html.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*film-name[^"]*"/);
    return m ? SHOWBOX_API + m[1] : null;
}

function parseHeadingId(html) {
    const m = html.match(/class="heading-name[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/);
    if (!m) return null;
    const parts = m[1].split("/");
    const last = parts[parts.length - 1];
    const n = parseInt(last, 10);
    return isNaN(n) ? null : n;
}

function normalizeToken(token) {
    if (token.indexOf("eyJ") === 0) return "ui=" + token;
    if (token.indexOf("ui=") === 0) return token;
    return "ui=" + token;
}

function parseQualityDivs(html) {
    const out = [];
    const divs = html.match(/<div[^>]*class="[^"]*file_quality[^"]*"[^>]*>/g) || [];
    divs.forEach(function (tag) {
        const u = tag.match(/data-url="([^"]+)"/);
        const q = tag.match(/data-quality="([^"]+)"/);
        if (u && q) out.push({ url: u[1].replace(/\\\//g, "/"), quality: q[1] });
    });
    return out;
}

async function searchSuperstream(imdbId) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const searchHtml = await fetchText(
                SHOWBOX_API + "/search?keyword=" + encodeURIComponent(imdbId),
                SHOWBOX_HEADERS,
                15000
            );
            const detailUrl = parseSearchHref(searchHtml);
            if (!detailUrl) continue;
            const detailHtml = await fetchText(detailUrl, SHOWBOX_HEADERS, 15000);
            const id = parseHeadingId(detailHtml);
            if (id != null) return id;
        } catch (e) {
            continue;
        }
    }
    return null;
}

export async function scrape(ctx) {
    const settings = cfg();
    if (settings.showbox === false) return [];
    const token = settings.showboxToken;
    if (!token || !ctx.imdbId) return [];
    const isTv = ctx.isTv;
    try {
        const mediaId = await searchSuperstream(ctx.imdbId);
        if (mediaId == null) return [];
        const type = !isTv ? 1 : 2;
        const shareJson = JSON.parse(
            await fetchText(SHOWBOX_API + "/index/share_link?id=" + mediaId + "&type=" + type, SHOWBOX_HEADERS, 15000)
        );
        const link = (shareJson && shareJson.data && shareJson.data.link) || "";
        const shareKey = link.split("/").pop();
        if (!shareKey) return [];

        const listJson = JSON.parse(
            await fetchText(FEBBOX_API + "/file/file_share_list?share_key=" + shareKey, SHOWBOX_HEADERS, 15000)
        );
        const root = (listJson && listJson.data && listJson.data.file_list) || [];
        let fid = null;
        if (!isTv) {
            const file = root.find(function (f) {
                return !f.is_dir;
            });
            fid = file && file.fid;
        } else {
            const sPad = String(ctx.season).padStart(2, "0");
            let folder =
                root.find(function (f) {
                    return f.is_dir && /season/i.test(f.file_name || "");
                }) ||
                root.find(function (f) {
                    return f.is_dir;
                });
            if (!folder) return [];
            const subJson = JSON.parse(
                await fetchText(
                    FEBBOX_API + "/file/file_share_list?share_key=" + shareKey + "&parent_id=" + folder.fid + "&page=1",
                    SHOWBOX_HEADERS,
                    15000
                )
            );
            const files = (subJson && subJson.data && subJson.data.file_list) || [];
            const ePad = String(ctx.episode).padStart(2, "0");
            const ep =
                files.find(function (f) {
                    const n = String(f.file_name || "").toLowerCase();
                    return !f.is_dir && (n.indexOf("e" + ePad) !== -1 || n.indexOf("ep" + ePad) !== -1 || n.indexOf("episode " + ctx.episode) !== -1);
                }) ||
                files.find(function (f) {
                    return !f.is_dir;
                });
            void sPad;
            fid = ep && ep.fid;
        }
        if (!fid) return [];

        const qJson = JSON.parse(
            await fetchText(
                FEBBOX_API + "/console/video_quality_list?fid=" + fid + "&share_key=" + shareKey,
                Object.assign({}, SHOWBOX_HEADERS, { Cookie: normalizeToken(token) }),
                15000
            )
        );
        const qualities = parseQualityDivs((qJson && qJson.html) || "");
        return qualities
            .map(function (q) {
                const isM3u8 = q.url.indexOf(".m3u8") !== -1;
                return makeStream(
                    "Showbox",
                    "ShowBox " + q.quality + (isM3u8 ? " [HLS]" : ""),
                    q.url,
                    q.quality === "ORG" ? "4K" : parseQuality(q.quality),
                    VIDEO_HEADERS,
                    []
                );
            })
            .filter(Boolean);
    } catch (e) {
        console.log("[Streamline][showbox] " + e.message);
        return [];
    }
}
