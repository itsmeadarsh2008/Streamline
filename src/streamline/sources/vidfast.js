/**
 * VidFastPro + Vidcore sources. Ports of CineStream `invokeVidFastPro()` and
 * `invokeVidcore()`. Same page -> enc-* -> servers -> dec-* -> stream flow,
 * differing only in endpoint slugs. All server-side crypto via enc-dec.app.
 */
import { MULTI_DECRYPT_API, UA, VIDCORE_API, VIDFAST_API } from '../constants.js';
import { fetchText, makeStream, parseQuality, postJson } from '../utils.js';

function enabled(key) {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s[key] !== false;
    } catch (e) {
        return true;
    }
}

function extractToken(page) {
    const m = String(page || "").match(/\\"(?:en|token)\\":\\"(.*?)\\"/);
    return m ? m[1] : null;
}

async function scrapeGeneric(opts, ctx) {
    const base = opts.base;
    const tag = opts.tag;
    const encName = opts.enc;
    const decName = opts.dec;

    const pageUrl = !ctx.isTv
        ? base + "/movie/" + ctx.tmdbId + "/"
        : base + "/tv/" + ctx.tmdbId + "/" + ctx.season + "/" + ctx.episode + "/";
    const headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        Referer: base + "/"
    };
    const page = await fetchText(pageUrl, headers, 20000);
    const tokenText = extractToken(page);
    if (!tokenText) return [];

    const initJson = JSON.parse(
        await fetchText(
            MULTI_DECRYPT_API + "/" + encName + "?text=" + encodeURIComponent(tokenText),
            {},
            15000
        )
    );
    const init = (initJson && initJson.result) || {};
    const serversUrl = init.servers;
    const streamBase = init.stream;
    const csrf = init.token;
    if (!serversUrl || !streamBase) return [];
    if (csrf) headers["X-CSRF-Token"] = csrf;

    const serversEnc = await (async function () {
        const res = await fetch(serversUrl, { method: "POST", headers: headers });
        return await res.text();
    })();
    const serversJson = await postJson(
        MULTI_DECRYPT_API + "/" + decName,
        { text: serversEnc },
        {},
        15000
    );
    const servers = (serversJson && serversJson.result) || [];
    if (!Array.isArray(servers) || !servers.length) return [];

    const out = [];
    for (const server of servers) {
        try {
            const streamRes = await fetch(streamBase + "/" + server.data, {
                method: "POST",
                headers: headers
            });
            const streamEnc = await streamRes.text();
            const streamJson = await postJson(
                MULTI_DECRYPT_API + "/" + decName,
                { text: streamEnc },
                {},
                15000
            );
            const data = (streamJson && streamJson.result) || {};
            const fileUrl = data.url;
            if (!fileUrl) continue;
            const subs = ((data.tracks || [])
                .filter(function (t) {
                    return t && t.file;
                })
                .map(function (t) {
                    return {
                        url: t.file,
                        language: t.label || "en",
                        name: (t.label || "Subtitle") + " [" + tag + "]"
                    };
                }));
            const quality = data.is4kAvailable || /4k/i.test(server.description || server.name || "")
                ? "4K"
                : parseQuality(server.description || fileUrl);
            const s = makeStream(
                tag,
                tag + " [" + (server.name || "server") + "] - " + quality,
                fileUrl,
                quality,
                headers,
                subs.slice(0, 8)
            );
            if (s) out.push(s);
        } catch (e) {
            continue;
        }
    }
    return out;
}

export async function scrapeVidfast(ctx) {
    if (!enabled("vidfast")) return [];
    if (!ctx.tmdbId) return [];
    try {
        return await scrapeGeneric(
            { base: VIDFAST_API, tag: "Vidfast", enc: "enc-vidfast", dec: "dec-vidfast" },
            ctx
        );
    } catch (e) {
        console.log("[Streamline][vidfast] " + e.message);
        return [];
    }
}

export async function scrapeVidcore(ctx) {
    if (!enabled("vidcore")) return [];
    if (!ctx.tmdbId) return [];
    try {
        const extra = { Referer: VIDCORE_API + "/", "X-Requested-With": "XMLHttpRequest", "User-Agent": UA };
        const pageUrl = !ctx.isTv
            ? VIDCORE_API + "/movie/" + ctx.tmdbId
            : VIDCORE_API + "/tv/" + ctx.tmdbId + "/" + ctx.season + "/" + ctx.episode;
        const page = await fetchText(pageUrl, extra, 20000);
        const tokenText = extractToken(page);
        if (!tokenText) return [];
        const initJson = JSON.parse(
            await fetchText(
                MULTI_DECRYPT_API + "/enc-vidcore?text=" + encodeURIComponent(tokenText),
                {},
                15000
            )
        );
        const init = (initJson && initJson.result) || {};
        if (!init.servers || !init.stream) return [];
        const headers = Object.assign({}, extra);
        if (init.token) headers["X-CSRF-Token"] = init.token;
        const serversEnc = await (async function () {
            const res = await fetch(init.servers, { method: "POST", headers: headers });
            return await res.text();
        })();
        const serversJson = await postJson(MULTI_DECRYPT_API + "/dec-vidcore", { text: serversEnc }, {}, 15000);
        const servers = (serversJson && serversJson.result) || [];
        const out = [];
        for (const server of servers) {
            try {
                const streamRes = await fetch(init.stream + "/" + server.data, { method: "POST", headers: headers });
                const streamEnc = await streamRes.text();
                const streamJson = await postJson(MULTI_DECRYPT_API + "/dec-vidcore", { text: streamEnc }, {}, 15000);
                const data = (streamJson && streamJson.result) || {};
                if (!data.url) continue;
                const subs = ((data.tracks || [])
                    .filter(function (t) {
                        return t && t.file;
                    })
                    .map(function (t) {
                        return {
                            url: t.file,
                            language: t.label || "en",
                            name: (t.label || "Subtitle") + " [Vidcore]"
                        };
                    }));
                const s = makeStream(
                    "Vidcore",
                    "Vidcore - " + (server.name || "server"),
                    data.url,
                    "Auto",
                    { Referer: VIDCORE_API + "/" },
                    subs.slice(0, 8)
                );
                if (s) out.push(s);
            } catch (e) {
                continue;
            }
        }
        return out;
    } catch (e) {
        console.log("[Streamline][vidcore] " + e.message);
        return [];
    }
}
