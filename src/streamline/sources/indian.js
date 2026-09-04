/**
 * Indian-mirror hosts. Ports of CineStream `invoke4khdhub()`,
 * `invokeUhdmovies()`, `invokeMoviesmod()`, `invokeMoviesdrive()`,
 * `invokeVegamovies()` and `invokeBollyflix()`.
 * Search pages are scraped with cheerio; hub links resolve via hubcloud.js.
 */
import cheerio from 'cheerio-without-node-native';
import { dynUrl } from '../constants.js';
import { b64DecodeUtf8, episodeSlug, fetchText } from '../utils.js';
import { bypassHrefli, extractMdriveLinks, fixUrl, getBaseUrl, getRedirectLinks, resolveSourceLink } from './hubcloud.js';

function enabled(key) {
    try {
        const s = globalThis.SCRAPER_SETTINGS || {};
        return s[key] !== false;
    } catch (e) {
        return true;
    }
}

async function resolveMany(source, links) {
    const out = [];
    for (const link of links.slice(0, 8)) {
        try {
            const r = await resolveSourceLink(source, link);
            out.push.apply(out, r);
        } catch (e) {
            continue;
        }
    }
    return out;
}

/** 4KHDHub — title search, hubcloud or redirect-chain links. */
export async function scrape4khdhub(ctx) {
    if (!enabled("hdhub")) return [];
    const base = await dynUrl("4khdhub");
    if (!base || !ctx.title) return [];
    try {
        const searchHtml = await fetchText(base + "/?s=" + encodeURIComponent(ctx.title), {}, 20000);
        let $ = cheerio.load(searchHtml);
        const want = ctx.title.toLowerCase();
        let href = null;
        $("div.card-grid > a").each(function (_, el) {
            const content = ($(el).find("div.movie-card-content").text() || "").toLowerCase();
            if (content.indexOf(want) !== -1 && (!ctx.year || content.indexOf(String(ctx.year)) !== -1)) {
                href = $(el).attr("href");
                return false;
            }
        });
        if (!href) return [];
        const pageHtml = await fetchText(fixUrl(href, base), {}, 20000);
        $ = cheerio.load(pageHtml);
        let raws = [];
        if (!ctx.isTv) {
            $("div.download-item a").each(function (_, el) {
                raws.push($(el).attr("href"));
            });
        } else {
            const slug = episodeSlug(ctx.season, ctx.episode);
            $("div.episode-download-item").each(function (_, el) {
                const t = $(el).find("div.episode-file-title").text() || "";
                if (t.indexOf(slug.code) !== -1 || t.indexOf(slug.alt) !== -1) {
                    $(el).find("div.episode-links > a").each(function (_, a) {
                        raws.push($(a).attr("href"));
                    });
                }
            });
        }
        const links = [];
        for (const r of raws) {
            if (!r) continue;
            if (/hubcloud|hubdrive/i.test(r)) links.push(r);
            else {
                const resolved = await getRedirectLinks(r);
                if (resolved) links.push(resolved);
            }
        }
        return await resolveMany("4KHDHub", links);
    } catch (e) {
        console.log("[Streamline][4khdhub] " + e.message);
        return [];
    }
}

/** UHDMovies — title+year search, hrefli bypass, hub terminals. */
export async function scrapeUhdmovies(ctx) {
    if (!enabled("uhdmovies")) return [];
    const base = await dynUrl("uhdmovies");
    if (!base || !ctx.title) return [];
    try {
        const searchHtml = await fetchText(
            base + "/search/" + encodeURIComponent(ctx.title + (ctx.year ? " " + ctx.year : "")),
            {},
            20000
        );
        let $ = cheerio.load(searchHtml);
        const href = $("article div.entry-image a").attr("href");
        if (!href) return [];
        const pageHtml = await fetchText(fixUrl(href, base), {}, 20000);
        $ = cheerio.load(pageHtml);
        const links = [];
        if (!ctx.isTv) {
            $("div.entry-content p").each(function (_, el) {
                const t = $(el).text() || "";
                if (ctx.year && t.indexOf(String(ctx.year)) === -1) return;
                const n = $(el).next();
                n.find("a").each(function (_, a) {
                    if (/download/i.test($(a).text())) links.push($(a).attr("href"));
                });
            });
        } else {
            const slug = episodeSlug(ctx.season, ctx.episode);
            $("div.entry-content p").each(function (_, el) {
                const t = $(el).text() || "";
                if (!new RegExp("S0?" + ctx.season + "|Season 0?" + ctx.season, "i").test(t)) return;
                const n = $(el).next();
                n.find("a").each(function (_, a) {
                    if (new RegExp("Episode " + ctx.episode, "i").test($(a).text())) links.push($(a).attr("href"));
                });
            });
            void slug;
        }
        const finals = [];
        for (const l of links.slice(0, 8)) {
            if (!l) continue;
            if (/driveleech|driveseed/i.test(l)) {
                try {
                    const t = await fetchText(l, {}, 15000);
                    const m = t.match(/window\.location\.replace\(["'](.*?)["']\)/);
                    finals.push(m ? getBaseUrl(l) + m[1] : l);
                } catch (e) {
                    continue;
                }
            } else {
                const b = await bypassHrefli(l);
                if (b) finals.push(b);
            }
        }
        return await resolveMany("UHDMovies", finals);
    } catch (e) {
        console.log("[Streamline][uhdmovies] " + e.message);
        return [];
    }
}

/** MoviesMod (Modflix flow) — IMDb search, quality headers, hrefli bypass. */
export async function scrapeMoviesmod(ctx) {
    if (!enabled("moviesmod")) return [];
    const base = await dynUrl("moviesmod");
    if (!base || !ctx.imdbId) return [];
    try {
        const q = ctx.isTv ? ctx.imdbId + " " + ctx.season : ctx.imdbId;
        const searchHtml = await fetchText(base + "/search/" + encodeURIComponent(q), {}, 20000);
        let $ = cheerio.load(searchHtml);
        const href = $("#content_box article > a").attr("href");
        if (!href) return [];
        const pageHtml = await fetchText(fixUrl(href, base), {}, 20000);
        $ = cheerio.load(pageHtml);
        const sTag = !ctx.isTv ? "" : "(S0?" + ctx.season + "|Season " + ctx.season + ")";
        const heads = [];
        $("div.thecontent h4, div.thecontent h3").each(function (_, el) {
            const t = $(el).text() || "";
            if (sTag && !new RegExp(sTag, "i").test(t)) return;
            if (!/(480p|720p|1080p|2160p)/i.test(t)) return;
            if (/MoviesMod/i.test(t)) return;
            heads.push(el);
        });
        const finals = [];
        for (const h of heads.slice(0, 6)) {
            const sib = $(h).next();
            const aTag = !ctx.isTv ? "Download" : "Episode";
            let link = null;
            sib.find("a").each(function (_, a) {
                if (new RegExp(aTag, "i").test($(a).text())) {
                    const raw = $(a).attr("href") || "";
                    link = raw.indexOf("=") !== -1 ? raw.split("=").pop() : raw;
                    return false;
                }
            });
            if (!link) continue;
            try {
                let target = link;
                if (ctx.isTv) {
                    const sub = await fetchText(link, {}, 15000);
                    const $s = cheerio.load(sub);
                    let found = null;
                    $s("p a.maxbutton, h3 a").each(function (_, a) {
                        if (new RegExp("Episode " + ctx.episode, "i").test($s(a).text())) {
                            found = $s(a).attr("href");
                            return false;
                        }
                    });
                    if (!found) continue;
                    target = found;
                }
                const b = await bypassHrefli(target);
                if (b) finals.push(b);
            } catch (e) {
                continue;
            }
        }
        return await resolveMany("Moviesmod", finals);
    } catch (e) {
        console.log("[Streamline][moviesmod] " + e.message);
        return [];
    }
}

/** MoviesDrive — IMDb JSON search, mdrive hub links. */
export async function scrapeMoviesdrive(ctx) {
    if (!enabled("moviesdrive")) return [];
    const base = await dynUrl("moviesdrive");
    if (!base || !ctx.imdbId) return [];
    try {
        const searchJson = JSON.parse(
            await fetchText(base + "/search.php?q=" + encodeURIComponent(ctx.imdbId), {}, 20000)
        );
        const hits = (searchJson && searchJson.hits) || [];
        let permalink = null;
        for (const h of hits) {
            const doc = h.document || h;
            if ((doc.imdb_id || doc.imdbId) === ctx.imdbId) {
                permalink = doc.permalink;
                break;
            }
        }
        if (!permalink) return [];
        const pageHtml = await fetchText(fixUrl(permalink, base), {}, 20000);
        let $ = cheerio.load(pageHtml);
        const hubLinks = [];
        if (!ctx.isTv) {
            $("h5 > a").each(function (_, el) {
                hubLinks.push($(el).attr("href"));
            });
            const out = [];
            for (const h of hubLinks.slice(0, 4)) {
                try {
                    const sub = await fetchText(fixUrl(h, base), {}, 15000);
                    out.push.apply(out, extractMdriveLinks(sub));
                } catch (e) {
                    continue;
                }
            }
            return await resolveMany("MoviesDrive", out);
        }
        const slug = episodeSlug(ctx.season, ctx.episode);
        let seasonHref = null;
        $("h5").each(function (_, el) {
            const t = $(el).text() || "";
            if (new RegExp("Season " + ctx.season + "|S" + slug.s, "i").test(t)) {
                seasonHref = $(el).next().find("a").attr("href") || $(el).parent().find("a").attr("href");
                return false;
            }
        });
        if (!seasonHref) return [];
        const seasonHtml = await fetchText(fixUrl(seasonHref, base), {}, 20000);
        $ = cheerio.load(seasonHtml);
        const out = [];
        $("h5").each(function (_, el) {
            const t = $(el).text() || "";
            if (new RegExp("Ep" + slug.e + "|Ep" + ctx.episode, "i").test(t)) {
                $(el).next().find("a").each(function (_, a) {
                    out.push($(a).attr("href"));
                });
                $(el).next().next().find("a").each(function (_, a) {
                    out.push($(a).attr("href"));
                });
            }
        });
        const hubOnly = [];
        for (const h of out) {
            if (!h) continue;
            if (/hubcloud|gdflix|gdlink/i.test(h)) hubOnly.push(h);
            else {
                try {
                    const sub = await fetchText(fixUrl(h, base), {}, 15000);
                    hubOnly.push.apply(hubOnly, extractMdriveLinks(sub));
                } catch (e) {
                    continue;
                }
            }
        }
        return await resolveMany("MoviesDrive", hubOnly);
    } catch (e) {
        console.log("[Streamline][moviesdrive] " + e.message);
        return [];
    }
}

/** VegaMovies / RogMovies — IMDb JSON search, dwd-button / season trees. */
async function scrapeVegaLike(apiKey, source, ctx) {
    const base = await dynUrl(apiKey);
    if (!base || !ctx.imdbId) return [];
    try {
        const searchJson = JSON.parse(
            await fetchText(base + "/search.php?q=" + encodeURIComponent(ctx.imdbId) + "&page=1", {}, 20000)
        );
        const hits = (searchJson && searchJson.hits) || [];
        let permalink = null;
        for (const h of hits) {
            const doc = h.document || h;
            if ((doc.imdb_id || doc.imdbId) === ctx.imdbId) {
                permalink = doc.permalink;
                break;
            }
        }
        if (!permalink) return [];
        const pageUrl = fixUrl(permalink, base);
        const pageHtml = await fetchText(pageUrl, {}, 20000);
        let $ = cheerio.load(pageHtml);
        const imdbHref = $("a[href*=\"imdb\"]").attr("href") || "";
        if (imdbHref && imdbHref.indexOf(ctx.imdbId) === -1) return [];
        const links = [];
        if (!ctx.isTv) {
            const btns = $("button.dwd-button").toArray();
            for (const b of btns.slice(0, 6)) {
                const href = $(b).parent().attr("href") || $(b).closest("a").attr("href");
                if (!href) continue;
                try {
                    const sub = await fetchText(fixUrl(href, base), {}, 15000);
                    const $s = cheerio.load(sub);
                    $s("p > a").each(function (_, a) {
                        links.push($s(a).attr("href"));
                    });
                } catch (e) {
                    continue;
                }
            }
        } else {
            $("h4, h3").each(function (_, el) {
                const t = $(el).text() || "";
                if (!new RegExp("Season " + ctx.season, "i").test(t)) return;
                $(el).next().find("a").each(function (_, a) {
                    if (/V-Cloud|Single|Episode|G-Direct/i.test($(a).text())) links.push($(a).attr("href"));
                });
            });
            const epLinks = [];
            for (const l of links.slice(0, 4)) {
                try {
                    const sub = await fetchText(fixUrl(l, base), {}, 15000);
                    const $s = cheerio.load(sub);
                    $s("h4").each(function (_, el) {
                        if (!new RegExp("Episode.*?" + ctx.episode, "i").test($s(el).text())) return;
                        const v = $s(el).next().find("a").filter(function (_, a) {
                            return /V-Cloud/i.test($s(a).text());
                        }).attr("href");
                        if (v) epLinks.push(v);
                    });
                } catch (e) {
                    continue;
                }
            }
            return await resolveMany(source, epLinks);
        }
        return await resolveMany(source, links);
    } catch (e) {
        console.log("[Streamline][" + source + "] " + e.message);
        return [];
    }
}

export async function scrapeVegamovies(ctx) {
    if (!enabled("vegamovies")) return [];
    if (ctx.isBollywood) return [];
    return await scrapeVegaLike("vegamovies", "VegaMovies", ctx);
}

export async function scrapeRogmovies(ctx) {
    if (!enabled("rogmovies")) return [];
    if (!ctx.isBollywood) return [];
    return await scrapeVegaLike("rogmovies", "RogMovies", ctx);
}

/** Bollyflix — IMDb search, quality headers, sidexfee unwrap, episode pages. */
export async function scrapeBollyflix(ctx) {
    if (!enabled("bollyflix")) return [];
    const base = await dynUrl("bollyflix");
    if (!base || !ctx.imdbId) return [];
    try {
        const searchHtml = await fetchText(base + "/search/" + encodeURIComponent(ctx.imdbId), {}, 20000);
        let $ = cheerio.load(searchHtml);
        const articles = $("div > article > a").toArray().slice(0, 4);
        const out = [];
        for (const art of articles) {
            try {
                const pageHtml = await fetchText(fixUrl($(art).attr("href"), base), {}, 20000);
                const $p = cheerio.load(pageHtml);
                const hTag = !ctx.isTv ? "h5" : "h4";
                const sTag = !ctx.isTv ? "" : "Season " + ctx.season;
                $p("div.thecontent.clearfix > " + hTag).each(function (_, el) {
                    const t = $p(el).text() || "";
                    if (sTag && !new RegExp(sTag, "i").test(t)) return;
                    if (!/(480p|720p|1080p|2160p)/i.test(t)) return;
                    if (/download/i.test(t)) return;
                    $p(el).next().find("a").each(function (_, a) {
                        const h = $p(a).attr("href");
                        if (h) out.push(h);
                    });
                });
            } catch (e) {
                continue;
            }
        }
        const finals = [];
        for (const href of out.slice(0, 8)) {
            try {
                let h = href;
                if (h.indexOf("fastdlserver") === -1 && h.indexOf("?id=") !== -1) {
                    const token = h.split("id=")[1];
                    const side = await fetchText("https://web.sidexfee.com/?id=" + token, {}, 15000);
                    const m = side.match(/link\\?":\\?"([^"]+)/) || side.match(/link":"([^"]+)/);
                    if (m) h = b64DecodeUtf8(m[1]);
                }
                if (!ctx.isTv) {
                    finals.push(h);
                } else {
                    const epText = "Episode " + String(ctx.episode).padStart(2, "0");
                    const sub = await fetchText(h, {}, 15000);
                    const $s = cheerio.load(sub);
                    let found = null;
                    $s("article h3 a").each(function (_, a) {
                        if ($s(a).text().indexOf(epText) !== -1) {
                            found = $s(a).attr("href");
                            return false;
                        }
                    });
                    if (found) finals.push(found);
                }
            } catch (e) {
                continue;
            }
        }
        return await resolveMany("Bollyflix", finals);
    } catch (e) {
        console.log("[Streamline][bollyflix] " + e.message);
        return [];
    }
}
