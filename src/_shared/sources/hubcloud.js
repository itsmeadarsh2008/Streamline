/**
 * Shared resolvers for the Indian-mirror hosts. Ports of CineStream
 * `HubCloud.getUrl()`, `getRedirectLinks()`, `bypassHrefli()`,
 * `extractMdrive()` and the Gofile terminal from `Extractors.kt`.
 */
import cheerio from 'cheerio-without-node-native';
import { UA } from '../constants.js';
import { b64DecodeUtf8, fetchText, makeStream, parseQuality } from '../utils.js';
import { parseMeta, enrichStream, richName, richTitle } from '../meta.js';

export function getBaseUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol + "//" + u.host;
    } catch (e) {
        return url;
    }
}

export function fixUrl(url, domain) {
    if (!url) return "";
    if (url.indexOf("http") === 0) return url;
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url[0] === "/") return domain + url;
    return domain + "/" + url;
}

function rot13(s) {
    return String(s || "").replace(/[a-zA-Z]/g, function (c) {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
}

const B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function b64EncodeUtf8(s) {
    const bytes = [];
    const enc = unescape(encodeURIComponent(String(s || "")));
    for (let i = 0; i < enc.length; i++) bytes.push(enc.charCodeAt(i));
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const n = (a << 16) | (b << 8) | c;
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63];
        out += i + 1 < bytes.length ? B64C[(n >> 6) & 63] : "=";
        out += i + 2 < bytes.length ? B64C[n & 63] : "=";
    }
    return out;
}

/** Port of `getRedirectLinks()` (4KHDHub redirect chain). */
export async function getRedirectLinks(url) {
    try {
        const doc = await fetchText(url, {}, 15000);
        const re = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
        let m;
        let combined = "";
        while ((m = re.exec(doc)) !== null) combined += m[1] || m[2] || "";
        if (!combined) return "";
        const decoded = b64DecodeUtf8(rot13(b64DecodeUtf8(b64DecodeUtf8(combined))));
        let obj;
        try {
            obj = JSON.parse(decoded);
        } catch (e) {
            return "";
        }
        const encodedUrl = b64DecodeUtf8(obj.o || "").trim();
        const data = b64EncodeUtf8(obj.data || "").trim();
        const blogUrl = (obj.blog_url || "").trim();
        let direct = "";
        if (blogUrl && data) {
            try {
                direct = (await fetchText(blogUrl + "?re=" + encodeURIComponent(data), {}, 15000)).trim();
            } catch (e) {
                direct = "";
            }
        }
        return encodedUrl || direct;
    } catch (e) {
        return "";
    }
}

/** Port of `bypassHrefli()` (MoviesMod/UHDMovies shortlink bypass). */
export async function bypassHrefli(url) {
    try {
        const host = getBaseUrl(url);
        function parseForm(html) {
            const $ = cheerio.load(html);
            const form = $("form#landing");
            const action = form.attr("action") || url;
            const data = {};
            form.find("input").each(function (_, el) {
                data[$(el).attr("name")] = $(el).attr("value") || "";
            });
            return { action: action, data: data };
        }
        function encodeForm(data) {
            return Object.keys(data)
                .map(function (k) {
                    return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
                })
                .join("&");
        }
        let html = await fetchText(url, {}, 15000);
        for (let i = 0; i < 2; i++) {
            const f = parseForm(html);
            const res = await fetch(f.action.indexOf("http") === 0 ? f.action : host + f.action, {
                method: "POST",
                headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Referer: url },
                body: encodeForm(f.data)
            });
            html = await res.text();
        }
        const goM = html.match(/\?go=([^"']+)/);
        if (!goM) return null;
        const skToken = goM[1];
        const wpMatch = html.match(/name="_wp_http2"[^>]*value="([^"]*)"/) || html.match(/_wp_http2["']?\s*[:=]\s*["']([^"']+)/);
        const cookieVal = wpMatch ? wpMatch[1] : "";
        const goRes = await fetch(host + "?go=" + skToken, {
            headers: { "User-Agent": UA, Cookie: skToken + "=" + cookieVal, Referer: url }
        });
        const goHtml = await goRes.text();
        const metaM = goHtml.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"']+)/i);
        const driveUrl = metaM ? metaM[1] : null;
        if (!driveUrl) return null;
        const driveText = await fetchText(driveUrl, {}, 15000);
        const pathM = driveText.match(/replace\("([^"]+)"/);
        const path = pathM ? pathM[1] : null;
        if (!path || path === "/404") return null;
        return fixUrl(path, getBaseUrl(driveUrl));
    } catch (e) {
        return null;
    }
}

/** Port of `extractMdrive()` — hub/gd links off a MoviesDrive page. */
export function extractMdriveLinks(html) {
    const $ = cheerio.load(html);
    const out = [];
    $("a").each(function (_, el) {
        const href = $(el).attr("href") || "";
        if (/hubcloud|gdflix|gdlink/i.test(href)) out.push(href);
    });
    return out;
}

function extractDoubleAtob(scriptTag) {
    const m = scriptTag.match(/var\s+url\s*=\s*atob\s*\(\s*atob\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/);
    if (!m) return "";
    try {
        return b64DecodeUtf8(b64DecodeUtf8(m[1]));
    } catch (e) {
        return "";
    }
}

function extractPxlUrl(html) {
    const m = html.match(/var\s+pxl\s*=\s*["']([^"']+)["']/);
    return m ? m[1] : null;
}

/** Simplified Gofile terminal (port of `Gofile.getUrl()` happy path). */
async function resolveGofile(url) {
    try {
        const idM = url.match(/(?:d\/|\/d\/)([A-Za-z0-9-]+)/);
        const id = idM ? idM[1] : url.split("/").pop();
        const accRes = await fetch("https://api.gofile.io/accounts", {
            method: "POST",
            headers: { "User-Agent": UA, Accept: "application/json" }
        });
        const acc = await accRes.json();
        const token = acc && acc.data && acc.data.token;
        if (!token || !id) return null;
        const cRes = await fetch("https://api.gofile.io/contents/" + id + "?wt=4fd6sg89d7s6", {
            headers: { Authorization: "Bearer " + token, "User-Agent": UA, Accept: "application/json" }
        });
        const content = await cRes.json();
        const children = (content && content.data && content.data.children) || {};
        const files = Object.keys(children).map(function (k) {
            return children[k];
        });
        const best = files.find(function (f) {
            return f && f.link && /\.(mp4|mkv|m3u8)/i.test(f.link);
        }) || files[0];
        return best && best.link ? { url: best.link, name: best.name || "" } : null;
    } catch (e) {
        return null;
    }
}

/**
 * Port of `HubCloud.getUrl()` / `VCloud`. Resolves a hubcloud/vcloud page
 * into direct download/stream links (FSL, Mega, Pixeldrain, 10Gbps, Buzz…).
 */
export async function resolveHubcloud(url, sourceName) {
    const name = sourceName || "HubCloud";
    const out = [];
    try {
        const baseUrl = getBaseUrl(url);
        let doc = await fetchText(url, {}, 20000);
        let $ = cheerio.load(doc);
        let link = "";
        if (url.indexOf("/video/") !== -1) {
            link = ($("div.vd > center > a").attr("href") || "").trim();
        } else {
            // Nuvio's cheerio shim has no :contains — filter scripts in JS.
            let scriptText = "";
            $("script").each(function (_, el) {
                const t = $(el).html() || "";
                if (t.indexOf("url") !== -1 && t.length < 20000) scriptText += t + "\n";
            });
            const scriptTag = scriptText || doc;
            if (url.indexOf("vcloud") !== -1) {
                link = extractDoubleAtob(scriptTag);
            } else {
                const m = scriptTag.match(/var url = '([^']*)'/);
                link = m ? m[1] : "";
            }
        }
        if (!link) return out;
        if (link.indexOf("https://") !== 0) link = baseUrl + link;

        const page2 = await fetchText(link, {}, 20000);
        const $2 = cheerio.load(page2);
        const header = $2("div.card-header").text().trim();
        const size = $2("i#size").text().trim();
        // Full release blob -> rich metadata block (quality/size/HDR/codec/
        // Atmos/language/source), All-in-One style. No giant file is ever
        // dropped; the size label lets you pick to taste.
        function push(u, label) {
            const container = /\.m3u8/i.test(u) ? "HLS" : /\.mp4/i.test(u) ? "MP4" : /\.mkv/i.test(u) ? "MKV" : (blobMeta.container || "VIDEO");
            const meta = parseMeta(header + " " + size + " " + u);
            const rt = richTitle(name, "🎬 " + header + (size ? " [" + size + "]" : ""), meta, container);
            const s = makeStream(
                richName(name + (label ? " " + label : ""), meta),
                rt.text,
                u,
                meta.quality === "Auto" ? parseQuality(header) : meta.quality,
                { "User-Agent": UA },
                [],
                { size: meta.size, language: meta.lang ? meta.lang.split(" + ")[0] : undefined }
            );
            if (s) {
                s._rank = meta.rank;
                s._sizeMB = meta.sizeMB;
                s._rich = true;
                out.push(s);
            }
        }

        const btns = $2("h2 a.btn").toArray();
        for (const el of btns) {
            try {
                const href = $2(el).attr("href") || "";
                const text = $2(el).text() || "";
                if (/FSL Server|FSLv2|Mega Server|Download File/.test(text)) {
                    if (href) push(href, "");
                } else if (href.indexOf("pixeldra") !== -1) {
                    const pxl = extractPxlUrl(page2);
                    if (pxl) {
                        const b = getBaseUrl(pxl);
                        push(/download/i.test(pxl) ? pxl : b + "/api/file/" + pxl.split("/").pop() + "?download", "[Pixeldrain]");
                    }
                } else if (/Server : 10Gbps/.test(text)) {
                    try {
                        const r = await fetch(href, { redirect: "follow", headers: { "User-Agent": UA } });
                        let finalUrl = r.url || "";
                        if (finalUrl.indexOf("link=") !== -1) finalUrl = finalUrl.split("link=")[1];
                        if (finalUrl) push(finalUrl, "[Download]");
                    } catch (e) { /* skip */ }
                } else if (/Buzz Server/.test(text)) {
                    try {
                        const bHtml = await fetchText(href, {}, 15000);
                        const $b = cheerio.load(bHtml);
                        const dl = $b(".download-btn").attr("href");
                        if (dl) push(getBaseUrl(href) + dl, "[Buzz]");
                    } catch (e) { /* skip */ }
                } else if (/Gofile/i.test(text)) {
                    const g = await resolveGofile(href);
                    if (g) push(g.url, "[Gofile]");
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {
        console.log("[Streamline][hubcloud] " + e.message);
    }
    return out;
}

/** Route a scraped href through the right terminal (port of `loadSourceNameExtractor`). */
export async function resolveSourceLink(source, url) {
    const u = String(url || "");
    if (!u) return [];
    if (/hubcloud\.|vcloud\./i.test(u)) return await resolveHubcloud(u, source);
    if (/gofile\.io\/d\//i.test(u)) {
        const g = await resolveGofile(u);
        if (!g || !g.url) return [];
        const s = makeStream(source, source + " [Gofile] " + g.name, g.url, parseQuality(g.name), {}, []);
        return s ? [enrichStream(s, g.name + " " + g.url, null)] : [];
    }
    if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(u)) {
        const s = makeStream(source, source + " - " + parseQuality(u), u, parseQuality(u), { "User-Agent": UA }, []);
        return s ? [enrichStream(s, u, null)] : [];
    }
    return [];
}
