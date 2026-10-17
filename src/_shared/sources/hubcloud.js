/**
 * Shared resolvers for the Indian-mirror hosts. Ports of CineStream
 * `HubCloud.getUrl()`, `getRedirectLinks()`, `bypassHrefli()`,
 * `extractMdrive()` and the Gofile terminal from `Extractors.kt`.
 */
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';
import { UA, dynUrl } from '../constants.js';
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
        // Port of getLatestBaseUrl(): migrate stale hub mirrors to the live
        // one from urls.json before fetching anything.
        let baseUrl = getBaseUrl(url);
        try {
            const latest = await dynUrl(url.indexOf("vcloud") !== -1 ? "vcloud" : "hubcloud");
            if (latest && baseUrl !== latest) {
                url = url.replace(baseUrl, latest);
                baseUrl = latest;
            }
        } catch (e) { /* keep scraped base */ }
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
        // `server` (FSL/Pixeldrain/10Gbps/Buzz/…) is shown in the name badge
        // AND as a 🖥️ line in the full description.
        function push(u, server) {
            const container = /\.m3u8/i.test(u) ? "HLS" : /\.mp4/i.test(u) ? "MP4" : /\.mkv/i.test(u) ? "MKV" : "VIDEO";
            const meta = parseMeta(header + " " + size + " " + u);
            if (!meta.container) meta.container = container;
            const rt = richTitle(name, "🎬 " + header + (size ? " [" + size + "]" : ""), meta, container);
            const title = server ? rt.text + "\n🖥️ " + server : rt.text;
            const s = makeStream(
                server ? richName(name + " [" + server + "]", meta) : richName(name, meta),
                title,
                u,
                meta.quality === "Auto" ? parseQuality(header) : meta.quality,
                { "User-Agent": UA, Referer: link },
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

        // 1-byte playability probe: expired single-use links (Access Denied)
        // are dropped so listed rows actually play. 206 always counts;
        // a 200 must carry a video-ish content-type (HTML error pages and
        // unredirected interstitials are rejected, not listed).
        async function probeOk(u) {
            try {
                const res = await fetch(u, {
                    redirect: "follow",
                    headers: { "User-Agent": UA, Referer: link, Range: "bytes=0-0" }
                });
                if (res.status === 206) {
                    try { await res.text(); } catch (e) { /* 1-byte body */ }
                    return true;
                }
                if (res.status === 200) {
                    const ct = (res.headers && typeof res.headers.get === "function"
                        ? res.headers.get("content-type") : "") || "";
                    if (/video|octet-stream|matroska|mp4|mpegurl|m3u8/i.test(ct)) return true;
                }
            } catch (e) { /* dead link */ }
            return false;
        }

        // Follow redirects to a fresh-signed URL (Range-capped, body unread).
        // Manual walk first (deterministic final URL, like upstream
        // resolveFinalUrl); fall back to auto-follow + response.url since
        // some bridges don't honor redirect:"manual".
        async function resolveFinal(u) {
            const H = { "User-Agent": UA, Referer: link, Range: "bytes=0-0" };
            let cur = u;
            try {
                for (let i = 0; i < 7; i++) {
                    const res = await fetch(cur, { redirect: "manual", headers: H });
                    if (!res || res.status < 300 || res.status > 399) break;
                    const loc = (res.headers && typeof res.headers.get === "function"
                        ? res.headers.get("location") : "") || "";
                    if (!loc) break;
                    try {
                        cur = new URL(loc, cur).toString();
                    } catch (e) {
                        break;
                    }
                }
            } catch (e) { /* fall through */ }
            if (cur !== u) {
                if (cur.indexOf("link=") !== -1) cur = cur.split("link=")[1];
                return cur;
            }
            try {
                const r = await fetch(u, { redirect: "follow", headers: H });
                let finalUrl = (r && r.url) || u;
                if (finalUrl.indexOf("link=") !== -1) finalUrl = finalUrl.split("link=")[1];
                return finalUrl || u;
            } catch (e) {
                return u;
            }
        }

        const btns = $2("h2 a.btn").toArray();
        const cands = [];
        for (const el of btns) {
            const href = $2(el).attr("href") || "";
            const text = $2(el).text() || "";
            if (!href) continue;
            if (/FSL Server|FSLv2|Mega Server|Download File/.test(text)) {
                cands.push({
                    href: href,
                    server: /FSLv2/.test(text) ? "FSLv2" : /Mega/.test(text) ? "Mega" : /Download File/.test(text) ? "Download" : "FSL"
                });
            } else if (href.indexOf("pixeldra") !== -1) {
                const pxl = extractPxlUrl(page2);
                if (pxl) {
                    const b = getBaseUrl(pxl);
                    cands.push({
                        href: /download/i.test(pxl) ? pxl : b + "/api/file/" + pxl.split("/").pop() + "?download",
                        server: "Pixeldrain",
                        direct: true
                    });
                }
            } else if (/Server : 10Gbps/.test(text)) {
                cands.push({ href: href, server: "10Gbps" });
            } else if (/Buzz Server/.test(text)) {
                try {
                    const bHtml = await fetchText(href, {}, 15000);
                    const $b = cheerio.load(bHtml);
                    const dl = $b(".download-btn").attr("href");
                    if (dl) cands.push({ href: getBaseUrl(href) + dl, server: "Buzz", direct: true });
                } catch (e) { /* skip */ }
            } else if (/Gofile/i.test(text)) {
                const g = await resolveGofile(href);
                if (g && g.url) cands.push({ href: g.url, server: "Gofile", direct: true });
            }
        }
        // Resolve indirect links, then probe everything in parallel and
        // keep only rows that actually play.
        const probed = await Promise.all(cands.map(async function (c) {
            try {
                const url = c.direct ? c.href : await resolveFinal(c.href);
                return { server: c.server, url: url, ok: await probeOk(url) };
            } catch (e) {
                return { server: c.server, url: "", ok: false };
            }
        }));
        probed.forEach(function (p) {
            if (p.ok && p.url) push(p.url, p.server);
        });
    } catch (e) {
        console.log("[Streamline][hubcloud] " + e.message);
    }
    return out;
}

/** Port of `Hubdrive.getUrl()`: success-button href -> terminal chain. */
export async function resolveHubdrive(url, source) {
    try {
        const html = await fetchText(url, {}, 20000);
        let href = "";
        try {
            const $ = cheerio.load(html);
            href = $(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href") || "";
        } catch (e) { /* fall through to regex */ }
        if (!href) {
            const m = html.match(/<a[^>]*class="[^"]*btn-success1[^"]*"[^>]*href="([^"]+)"/i) ||
                html.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*btn-success1[^"]*"/i);
            href = m ? m[1] : "";
        }
        if (!href) return [];
        return await resolveSourceLink(source || "Hubdrive", fixUrl(href, getBaseUrl(url)));
    } catch (e) {
        return [];
    }
}

/** Port of the `getPacked` + `unpack` pair used by CineStream's VidHidePro. */
export function unpackEval(code) {
    const call = String(code || "").match(
        /eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('([^']+)'\)/
    );
    if (!call) return "";
    let p = call[1];
    const a = parseInt(call[2], 10);
    const c = parseInt(call[3], 10);
    const k = call[4].split(call[5]);
    for (let i = c - 1; i >= 0; i--) {
        if (k[i]) {
            p = p.replace(new RegExp("\\b" + i.toString(a) + "\\b", "g"), function () { return k[i]; });
        }
    }
    return p;
}

/** Port of the VidHidePro extractor (hdstream4u & friends): `/file/x` -> `/v/x` -> packed JW config -> HLS. */
export async function resolveVidhide(source, url) {
    const name = source || "HdStream4u";
    try {
        const embed = String(url).replace("/download/", "/v/").replace("/file/", "/v/").replace("/d/", "/v/");
        const host = getBaseUrl(embed);
        const html = await fetchText(embed, { Referer: host + "/" }, 20000);
        let script = html.indexOf("eval(function(p,a,c,k,e") !== -1 ? unpackEval(html) : "";
        if (!script) {
            const si = html.match(/sources:\s*(\[[\s\S]*?\])/);
            if (si) script = "sources:" + si[1];
        }
        if (!script) return [];
        let hls = "";
        const first = script.match(/"hls4"\s*:\s*"([^"]+)"/) || script.match(/"hls3"\s*:\s*"([^"]+)"/) ||
            script.match(/"hls2"\s*:\s*"([^"]+)"/) || script.match(/"hls1"\s*:\s*"([^"]+)"/);
        if (first) hls = first[1];
        if (!hls) {
            const any = script.match(/https?:\/\/[^"'\s\\]+(?:\.m3u8|master\.txt)[^"'\s\\]*/);
            if (any) hls = any[0];
        }
        if (!hls) {
            const m = script.match(/["']?file["']?\s*:\s*["'](https?:\/\/[^"']+)["']/);
            if (m && !/\.(png|jpe?g|gif|webp|vtt)$/i.test(m[1])) hls = m[1];
        }
        if (!hls) return [];
        hls = hls.replace(/\\\//g, "/");
        const subs = [];
        const tracks = script.match(/["']?tracks["']?\s*:\s*(\[[\s\S]*?\])/);
        if (tracks) {
            tracks[1].split(/\},?\s*\{/).forEach(function (chunk) {
                const fm = chunk.match(/["']?file["']?\s*:\s*["']([^"']+\.vtt[^"']*)["']/);
                if (!fm) return;
                const lm = chunk.match(/["']?label["']?\s*:\s*["']([^"']+)["']/);
                subs.push({
                    url: fm[1].replace(/\\\//g, "/"),
                    language: lm ? lm[1] : "en",
                    name: name + " Subtitle"
                });
            });
        }
        const s = makeStream(name, name + " [HLS]", hls, "Auto",
            { Referer: embed, Origin: host, "User-Agent": UA }, subs);
        return s ? [s] : [];
    } catch (e) {
        return [];
    }
}

/** Port of the VidStack extractor (hubstream & friends): `/api/v1/video?id=<hash>` -> AES-CBC -> HLS. */
export async function resolveVidstack(source, url) {
    const name = source || "Hubstream";
    try {
        const hash = String(url).split("#").pop().split("/").pop();
        const base = getBaseUrl(url);
        const enc = (await fetchText(base + "/api/v1/video?id=" + hash, { Accept: "application/json" }, 15000)).trim();
        for (const ivStr of ["1234567890oiuytr", "0123456789abcdef"]) {
            let txt = "";
            try {
                const dec = CryptoJS.AES.decrypt(
                    { ciphertext: CryptoJS.enc.Hex.parse(enc) },
                    CryptoJS.enc.Utf8.parse("kiemtienmua911ca"),
                    { iv: CryptoJS.enc.Utf8.parse(ivStr), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
                );
                txt = dec.toString(CryptoJS.enc.Utf8);
            } catch (e) { txt = ""; }
            if (!txt || txt.indexOf("source") === -1) continue;
            const m = txt.match(/"source":"(.*?)"/);
            if (!m) continue;
            let m3u8 = m[1].replace(/\\\//g, "/");
            // Bare-IP CDN hosts ship an invalid TLS cert (upstream forces http).
            try {
                const h = new URL(m3u8).hostname;
                if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) m3u8 = m3u8.replace(/^https:/, "http:");
            } catch (e) { /* keep scheme */ }
            const subs = [];
            const sec = (txt.match(/"subtitle":\{(.*?)\}/) || [])[1];
            if (sec) {
                const re = /"([^"]+)":\s*"([^"]+)"/g;
                let mm;
                while ((mm = re.exec(sec)) !== null) {
                    const path = mm[2].split("#")[0].replace(/\\\//g, "/");
                    if (path) {
                        subs.push({
                            url: path.indexOf("http") === 0 ? path : base + path,
                            language: mm[1],
                            name: name + " Subtitle"
                        });
                    }
                }
            }
            const s = makeStream(name, name + " [HLS]", m3u8, "Auto",
                { Referer: url, Origin: base, "User-Agent": UA }, subs);
            return s ? [s] : [];
        }
        return [];
    } catch (e) {
        return [];
    }
}

/** Port of the HubCdn chain: `/file/<id>` JS `reurl` -> base64 `r=` -> `link=` target. */
export async function resolveHubcdn(source, url) {
    const name = source || "HubCdn";
    try {
        const html = await fetchText(url, {}, 20000);
        let target = "";
        const reurl = html.match(/reurl\s*=\s*["']([^"']+)["']/);
        const candidate = reurl ? reurl[1] : "";
        if (candidate) {
            let decoded = candidate;
            const rq = candidate.match(/[?&]r=([A-Za-z0-9+/=]+)/);
            if (rq) decoded = b64DecodeUtf8(rq[1]);
            const li = decoded.lastIndexOf("link=");
            if (li !== -1) target = decoded.substring(li + 5);
            else if (decoded.indexOf("http") === 0) target = decoded;
        }
        if (!target) {
            const rq = html.match(/[?&]r=([A-Za-z0-9+/=]{24,})/);
            if (rq) {
                const decoded = b64DecodeUtf8(rq[1]);
                const li = decoded.lastIndexOf("link=");
                if (li !== -1) target = decoded.substring(li + 5);
            }
        }
        target = String(target || "").trim();
        if (!target || target.indexOf("http") !== 0) return [];
        if (/hubcloud\.|vcloud\.|hubdrive\.|gdflix\.|hblinks\./i.test(target)) {
            return await resolveSourceLink(name, target);
        }
        const s = makeStream(name, name + " [Direct]", target, "Auto",
            { "User-Agent": UA, Referer: url }, []);
        return s ? [s] : [];
    } catch (e) {
        return [];
    }
}

/** Port of the Hblinks extractor (archive pages full of hub links). */
export async function resolveHblinks(source, url) {
    try {
        const html = await fetchText(url, { Referer: url }, 20000);
        const rows = [];
        const seen = function (href) {
            return rows.some(function (r) { return r.href === href; });
        };
        try {
            const $ = cheerio.load(html);
            const sels = [
                "div#primary p a", "h3 a", "h4 a", "h5 a",
                "div.entry-content p a", "div.entry-content a"
            ];
            sels.forEach(function (sel) {
                $(sel).each(function (_, el) {
                    const href = $(el).attr("href") || "";
                    if (/^https?:/i.test(href) &&
                        !/whatsapp|telegram|catimages|imdb\.|facebook|twitter|instagram|youtube|hblinks|snvhost/i.test(href) &&
                        !seen(href)) {
                        rows.push({ href: href, hint: $(el).text().replace(/\s+/g, " ").trim() });
                    }
                });
            });
        } catch (e) { /* regex fallback below */ }
        if (!rows.length) {
            const re = /<a[^>]+href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a\s*>/gi;
            let m;
            while ((m = re.exec(html)) !== null) {
                const href = m[1];
                if (/hubcloud|hubdrive|hubcdn|hdstream4u|hubstream|gdflix|pixeldrain|greenmotors/i.test(href) &&
                    !seen(href)) {
                    rows.push({ href: href, hint: m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() });
                }
            }
        }
        const out = [];
        for (let i = 0; i < Math.min(rows.length, 9); i += 3) {
            const chunk = rows.slice(i, i + 3);
            const settled = await Promise.all(chunk.map(function (row) {
                return resolveSourceLink(source, row.href, row.hint).catch(function () { return []; });
            }));
            settled.forEach(function (r) { if (Array.isArray(r)) out.push.apply(out, r); });
        }
        return out;
    } catch (e) {
        return [];
    }
}

/** Fold an anchor's quality text (e.g. "1080p HEVC [2GB]") into bare streams
 *  so the final presentation pass parses it together with the ctx headline. */
function applyHint(streams, hint) {
    const h = String(hint || "").trim();
    if (!h) return streams || [];
    (streams || []).forEach(function (s) {
        if (!s || s._rich) return;
        s.title = (s.title || s.name || "") + " " + h;
        if (!s.quality || s.quality === "Auto") {
            const q = parseQuality(h);
            if (q && q !== "Auto") s.quality = q;
        }
    });
    return streams || [];
}

/** Route a scraped href through the right terminal (port of `loadSourceNameExtractor`). */
export async function resolveSourceLink(source, url, hint) {
    return applyHint(await routeSourceLink(source, url, hint), hint);
}

async function routeSourceLink(source, url, hint) {
    const u = String(url || "");
    if (!u) return [];
    if (/[?&]id=/.test(u) || /techyboy4u|gadgetsweb|cryptoinsights|bloggingvector|ampproject\./i.test(u)) {
        const next = await getRedirectLinks(u);
        if (next && next !== u) return await routeSourceLink(source, next, hint);
        return [];
    }
    if (/hblinks\.|hubstream\.dad/i.test(u)) return await resolveHblinks(source, u);
    if (/hubcdn\./i.test(u)) return await resolveHubcdn(source, u);
    if (/hdstream4u\./i.test(u)) return await resolveVidhide(source, u);
    if (/hubstream\.|vidstack/i.test(u)) return await resolveVidstack(source, u);
    if (/hubdrive\./i.test(u)) return await resolveHubdrive(u, source);
    if (/hubcloud\.|vcloud\./i.test(u)) return await resolveHubcloud(u, source);
    if (/gofile\.io\/d\//i.test(u)) {
        const g = await resolveGofile(u);
        if (!g || !g.url) return [];
        const s = makeStream(source, source + " [Gofile] " + g.name, g.url, parseQuality(g.name), {}, []);
        return s ? [enrichStream(s, g.name + " " + g.url, null)] : [];
    }
    if (/pixeldra\./i.test(u)) {
        const id = u.split("/").filter(Boolean).pop();
        if (!id) return [];
        const target = u.indexOf("/api/file/") !== -1 ? u : getBaseUrl(u) + "/api/file/" + id + "?download";
        const s = makeStream(source, source + " [Pixeldrain]", target, "Auto", { "User-Agent": UA }, []);
        return s ? [s] : [];
    }
    if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(u)) {
        const s = makeStream(source, source + " - " + parseQuality(u), u, parseQuality(u), { "User-Agent": UA }, []);
        return s ? [enrichStream(s, u, null)] : [];
    }
    return [];
}
