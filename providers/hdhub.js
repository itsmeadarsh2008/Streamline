/**
 * hdhub - Built from src/hdhub/ (run bun build.js to regenerate)
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/_shared/constants.js
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var WYZIE_API = "https://sub.wyzie.io";
var STREMIO_SUBS = [
  "https://opensubtitles.stremio.homes",
  "https://subsense.nepiraw.com/n0tcjfba-"
];
var URLS_JSON = "https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json";
var _dynamicCache = null;
var _dynamicAt = 0;
function getDynamicUrls() {
  return __async(this, null, function* () {
    const now = Date.now();
    if (_dynamicCache && now - _dynamicAt < 30 * 60 * 1e3)
      return _dynamicCache;
    try {
      const res = yield fetch(URLS_JSON, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
      });
      if (res.ok) {
        const json = yield res.json();
        _dynamicCache = json || {};
        _dynamicAt = now;
        return _dynamicCache;
      }
    } catch (e) {
      console.log("[Streamline] dynamic urls.json failed: " + (e && e.message));
    }
    return _dynamicCache || {};
  });
}
function dynUrl(key) {
  return __async(this, null, function* () {
    const cfg = yield getDynamicUrls();
    return cfg && cfg[key] || "";
  });
}
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// src/_shared/tmdb.js
var metaCache = {};
function fetchTmdbMeta(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const cacheKey = type + ":" + tmdbId;
    if (metaCache[cacheKey])
      return metaCache[cacheKey];
    const url = TMDB_BASE_URL + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&append_to_response=external_ids";
    try {
      const res = yield fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" }
      });
      if (!res.ok)
        throw new Error("TMDB HTTP " + res.status);
      const data = yield res.json();
      const title = type === "movie" ? data.title || data.original_title || "" : data.name || data.original_name || "";
      const originalTitle = data.original_title || data.original_name || title;
      const date = data.release_date || data.first_air_date || "";
      const imdbId = data.external_ids && data.external_ids.imdb_id || null;
      const meta = {
        title,
        originalTitle,
        year: date ? parseInt(String(date).substring(0, 4), 10) || null : null,
        imdbId,
        tmdbId: parseInt(tmdbId, 10) || null,
        countries: (data.production_countries || []).map(function(c) {
          return c && (c.name || c.iso_3166_1);
        }).filter(Boolean)
      };
      metaCache[cacheKey] = meta;
      return meta;
    } catch (e) {
      console.log("[Streamline][tmdb] " + e.message);
      return { title: "", originalTitle: "", year: null, imdbId: null, tmdbId: null, countries: [] };
    }
  });
}
function buildCtx(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const isTv = mediaType === "tv";
    const meta = yield fetchTmdbMeta(String(tmdbId), mediaType);
    const countries = meta.countries || [];
    return {
      tmdbId: meta.tmdbId || parseInt(tmdbId, 10) || null,
      imdbId: meta.imdbId,
      title: meta.title,
      originalTitle: meta.originalTitle,
      year: meta.year,
      season: season != null ? season : 1,
      episode: episode != null ? episode : 1,
      isTv,
      isBollywood: countries.some(function(c) {
        return /india|\bIN\b/i.test(String(c));
      })
    };
  });
}

// src/_shared/utils.js
function defaultHeaders(extra) {
  return Object.assign({ "User-Agent": UA, "Accept": "*/*" }, extra || {});
}
function hasTimers() {
  try {
    return typeof setTimeout === "function" && typeof clearTimeout === "function";
  } catch (e) {
    return false;
  }
}
function fetchWithTimeout(url, options, timeoutMs) {
  return __async(this, null, function* () {
    if (!hasTimers()) {
      return fetch(url, options || {});
    }
    const timeout = timeoutMs || 2e4;
    let timer = null;
    try {
      const fetchPromise = fetch(url, options || {});
      const timeoutPromise = new Promise(function(_, reject) {
        timer = setTimeout(function() {
          reject(new Error("timeout after " + timeout + "ms: " + url));
        }, timeout);
      });
      const res = yield Promise.race([fetchPromise, timeoutPromise]);
      if (timer)
        clearTimeout(timer);
      return res;
    } catch (e) {
      if (timer)
        clearTimeout(timer);
      throw e;
    }
  });
}
function fetchText(url, headers, timeoutMs) {
  return __async(this, null, function* () {
    const res = yield fetchWithTimeout(url, { headers: defaultHeaders(headers) }, timeoutMs);
    if (!res.ok)
      throw new Error("HTTP " + res.status + " for " + url);
    return yield res.text();
  });
}
function parseQuality(raw) {
  if (raw == null)
    return "Auto";
  const s = String(raw).toLowerCase();
  if (/\b8k\b/.test(s))
    return "8K";
  if (/2160|4k|uhd/.test(s))
    return "4K";
  const m = s.match(/(\d{3,4})\s*p?/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 2e3)
      return "4K";
    if (n >= 1e3)
      return "1080p";
    if (n >= 700)
      return "720p";
    if (n >= 400)
      return "480p";
    if (n > 0)
      return "360p";
  }
  if (/org/.test(s))
    return "4K";
  if (/cam|ts|telesync|telecine|hdcam/.test(s))
    return "CAM";
  if (/hd/.test(s))
    return "720p";
  return "Auto";
}
function makeStream(source, title, url, quality, headers, subtitles) {
  if (!url)
    return null;
  const u = String(url);
  if (u.indexOf("http") !== 0 && u.indexOf("magnet:?") !== 0)
    return null;
  return {
    name: source,
    title: title || source,
    url: u,
    quality: quality || parseQuality(title),
    headers: headers || {},
    subtitles: subtitles || []
  };
}
function episodeSlug(season, episode) {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return { s, e, code: "S" + s + "E" + e, alt: "s" + s + "e" + e };
}
function withTimeout(promise, ms, label) {
  if (!hasTimers())
    return promise;
  const timeout = ms || 25e3;
  return Promise.race([
    promise,
    new Promise(function(resolve) {
      setTimeout(function() {
        console.log("[Streamline] timeout: " + label);
        resolve([]);
      }, timeout);
    })
  ]);
}
function dedupe(streams) {
  const seen = {};
  const out = [];
  (streams || []).forEach(function(s) {
    if (!s || !s.url || seen[s.url])
      return;
    seen[s.url] = true;
    out.push(s);
  });
  return out;
}
function b64DecodeToBytes(b64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const clean = String(b64 || "").replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes = [];
  let i = 0;
  while (i < clean.length) {
    const e1 = chars.indexOf(clean.charAt(i++));
    const e2 = chars.indexOf(clean.charAt(i++));
    const e3 = chars.indexOf(clean.charAt(i++));
    const e4 = chars.indexOf(clean.charAt(i++));
    const n1 = e1 << 2 | e2 >> 4;
    const n2 = (e2 & 15) << 4 | e3 >> 2;
    const n3 = (e3 & 3) << 6 | e4;
    bytes.push(n1);
    if (e3 !== 64)
      bytes.push(n2);
    if (e4 !== 64)
      bytes.push(n3);
  }
  return bytes;
}
function bytesToUtf8(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++)
    out += String.fromCharCode(bytes[i]);
  try {
    return decodeURIComponent(escape(out));
  } catch (e) {
    return out;
  }
}
function b64DecodeUtf8(b64) {
  try {
    return bytesToUtf8(b64DecodeToBytes(b64));
  } catch (e) {
    return "";
  }
}

// src/_shared/subs.js
function settings() {
  try {
    return globalThis.SCRAPER_SETTINGS || {};
  } catch (e) {
    return {};
  }
}
function stremioSubtitles(imdbId, season, episode, isTv) {
  return __async(this, null, function* () {
    const out = [];
    if (!imdbId)
      return out;
    const path = isTv ? "/subtitles/series/" + imdbId + ":" + season + ":" + episode + ".json" : "/subtitles/movie/" + imdbId + ".json";
    const jobs = STREMIO_SUBS.map(function(base) {
      return function() {
        return __async(this, null, function* () {
          try {
            const json = JSON.parse(yield fetchText(base + path, {}, 12e3));
            const list = json && json.subtitles || [];
            list.slice(0, 12).forEach(function(s) {
              if (!s || !s.url)
                return;
              out.push({
                url: s.url,
                language: s.lang || s.lang_code || "en",
                name: (s.title || s.lang || "Subtitle") + " [Stremio]"
              });
            });
          } catch (e) {
            console.log("[Streamline][subs] " + base + ": " + e.message);
          }
        });
      }();
    });
    yield Promise.all(jobs);
    return out;
  });
}
function wyzieSubtitles(imdbId, season, episode, isTv) {
  return __async(this, null, function* () {
    const key = settings().wyzieKey;
    if (!key || !imdbId)
      return [];
    const url = isTv ? WYZIE_API + "/search?id=" + imdbId + "&season=" + season + "&episode=" + episode + "&source=all&key=" + key : WYZIE_API + "/search?id=" + imdbId + "&source=all&key=" + key;
    try {
      const list = JSON.parse(yield fetchText(url, {}, 12e3));
      return (Array.isArray(list) ? list : []).slice(0, 12).map(function(s) {
        return {
          url: s.url,
          language: s.language || "en",
          name: (s.display || s.language || "Subtitle") + " [Wyzie]"
        };
      });
    } catch (e) {
      console.log("[Streamline][wyzie] " + e.message);
      return [];
    }
  });
}
function attachSubtitles(streams, subtitles) {
  if (!subtitles || !subtitles.length)
    return streams;
  return streams.map(function(s) {
    if (s.subtitles && s.subtitles.length)
      return s;
    const copy = Object.assign({}, s);
    copy.subtitles = subtitles.slice(0, 8);
    return copy;
  });
}
function withSharedSubs(streams, ctx) {
  return __async(this, null, function* () {
    try {
      if (!ctx || !ctx.imdbId)
        return streams;
      const subs = (yield stremioSubtitles(ctx.imdbId, ctx.season, ctx.episode, ctx.isTv)).concat(
        yield wyzieSubtitles(ctx.imdbId, ctx.season, ctx.episode, ctx.isTv)
      );
      return attachSubtitles(streams, subs);
    } catch (e) {
      return streams;
    }
  });
}
function wyzieKeyField() {
  return {
    type: "text",
    key: "wyzieKey",
    label: "Wyzie subtitles key",
    placeholder: "Optional Wyzie API key",
    description: "Extra subtitles alongside the built-in Stremio ones."
  };
}

// src/_shared/sources/indian.js
var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));

// src/_shared/sources/hubcloud.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function getBaseUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol + "//" + u.host;
  } catch (e) {
    return url;
  }
}
function fixUrl(url, domain) {
  if (!url)
    return "";
  if (url.indexOf("http") === 0)
    return url;
  if (url.indexOf("//") === 0)
    return "https:" + url;
  if (url[0] === "/")
    return domain + url;
  return domain + "/" + url;
}
function rot13(s) {
  return String(s || "").replace(/[a-zA-Z]/g, function(c) {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
  });
}
var B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64EncodeUtf8(s) {
  const bytes = [];
  const enc = unescape(encodeURIComponent(String(s || "")));
  for (let i = 0; i < enc.length; i++)
    bytes.push(enc.charCodeAt(i));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = a << 16 | b << 8 | c;
    out += B64C[n >> 18 & 63] + B64C[n >> 12 & 63];
    out += i + 1 < bytes.length ? B64C[n >> 6 & 63] : "=";
    out += i + 2 < bytes.length ? B64C[n & 63] : "=";
  }
  return out;
}
function getRedirectLinks(url) {
  return __async(this, null, function* () {
    try {
      const doc = yield fetchText(url, {}, 15e3);
      const re = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
      let m;
      let combined = "";
      while ((m = re.exec(doc)) !== null)
        combined += m[1] || m[2] || "";
      if (!combined)
        return "";
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
          direct = (yield fetchText(blogUrl + "?re=" + encodeURIComponent(data), {}, 15e3)).trim();
        } catch (e) {
          direct = "";
        }
      }
      return encodedUrl || direct;
    } catch (e) {
      return "";
    }
  });
}
function extractDoubleAtob(scriptTag) {
  const m = scriptTag.match(/var\s+url\s*=\s*atob\s*\(\s*atob\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/);
  if (!m)
    return "";
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
function resolveGofile(url) {
  return __async(this, null, function* () {
    try {
      const idM = url.match(/(?:d\/|\/d\/)([A-Za-z0-9-]+)/);
      const id = idM ? idM[1] : url.split("/").pop();
      const accRes = yield fetch("https://api.gofile.io/accounts", {
        method: "POST",
        headers: { "User-Agent": UA, Accept: "application/json" }
      });
      const acc = yield accRes.json();
      const token = acc && acc.data && acc.data.token;
      if (!token || !id)
        return null;
      const cRes = yield fetch("https://api.gofile.io/contents/" + id + "?wt=4fd6sg89d7s6", {
        headers: { Authorization: "Bearer " + token, "User-Agent": UA, Accept: "application/json" }
      });
      const content = yield cRes.json();
      const children = content && content.data && content.data.children || {};
      const files = Object.keys(children).map(function(k) {
        return children[k];
      });
      const best = files.find(function(f) {
        return f && f.link && /\.(mp4|mkv|m3u8)/i.test(f.link);
      }) || files[0];
      return best && best.link ? { url: best.link, name: best.name || "" } : null;
    } catch (e) {
      return null;
    }
  });
}
function resolveHubcloud(url, sourceName) {
  return __async(this, null, function* () {
    const name = sourceName || "HubCloud";
    const out = [];
    try {
      let push = function(u, label) {
        const s = makeStream(name, name + " " + header + " [" + size + "]" + (label ? " " + label : ""), u, quality, { "User-Agent": UA }, []);
        if (s)
          out.push(s);
      };
      const baseUrl = getBaseUrl(url);
      let doc = yield fetchText(url, {}, 2e4);
      let $ = import_cheerio_without_node_native.default.load(doc);
      let link = "";
      if (url.indexOf("/video/") !== -1) {
        link = ($("div.vd > center > a").attr("href") || "").trim();
      } else {
        let scriptText = "";
        $("script").each(function(_, el) {
          const t = $(el).html() || "";
          if (t.indexOf("url") !== -1 && t.length < 2e4)
            scriptText += t + "\n";
        });
        const scriptTag = scriptText || doc;
        if (url.indexOf("vcloud") !== -1) {
          link = extractDoubleAtob(scriptTag);
        } else {
          const m = scriptTag.match(/var url = '([^']*)'/);
          link = m ? m[1] : "";
        }
      }
      if (!link)
        return out;
      if (link.indexOf("https://") !== 0)
        link = baseUrl + link;
      const page2 = yield fetchText(link, {}, 2e4);
      const $2 = import_cheerio_without_node_native.default.load(page2);
      const header = $2("div.card-header").text().trim();
      const size = $2("i#size").text().trim();
      const quality = parseQuality(header);
      const btns = $2("h2 a.btn").toArray();
      for (const el of btns) {
        try {
          const href = $2(el).attr("href") || "";
          const text = $2(el).text() || "";
          if (/FSL Server|FSLv2|Mega Server|Download File/.test(text)) {
            if (href)
              push(href, "");
          } else if (href.indexOf("pixeldra") !== -1) {
            const pxl = extractPxlUrl(page2);
            if (pxl) {
              const b = getBaseUrl(pxl);
              push(/download/i.test(pxl) ? pxl : b + "/api/file/" + pxl.split("/").pop() + "?download", "[Pixeldrain]");
            }
          } else if (/Server : 10Gbps/.test(text)) {
            try {
              const r = yield fetch(href, { redirect: "follow", headers: { "User-Agent": UA } });
              let finalUrl = r.url || "";
              if (finalUrl.indexOf("link=") !== -1)
                finalUrl = finalUrl.split("link=")[1];
              if (finalUrl)
                push(finalUrl, "[Download]");
            } catch (e) {
            }
          } else if (/Buzz Server/.test(text)) {
            try {
              const bHtml = yield fetchText(href, {}, 15e3);
              const $b = import_cheerio_without_node_native.default.load(bHtml);
              const dl = $b(".download-btn").attr("href");
              if (dl)
                push(getBaseUrl(href) + dl, "[Buzz]");
            } catch (e) {
            }
          } else if (/Gofile/i.test(text)) {
            const g = yield resolveGofile(href);
            if (g)
              push(g.url, "[Gofile]");
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      console.log("[Streamline][hubcloud] " + e.message);
    }
    return out;
  });
}
function resolveSourceLink(source, url) {
  return __async(this, null, function* () {
    const u = String(url || "");
    if (!u)
      return [];
    if (/hubcloud\.|vcloud\./i.test(u))
      return yield resolveHubcloud(u, source);
    if (/gofile\.io\/d\//i.test(u)) {
      const g = yield resolveGofile(u);
      return g && g.url ? [makeStream(source, source + " [Gofile] " + g.name, g.url, parseQuality(g.name), {}, [])].filter(Boolean) : [];
    }
    if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(u)) {
      const s = makeStream(source, source + " - " + parseQuality(u), u, parseQuality(u), { "User-Agent": UA }, []);
      return s ? [s] : [];
    }
    return [];
  });
}

// src/_shared/sources/indian.js
function enabled(key) {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s[key] !== false;
  } catch (e) {
    return true;
  }
}
function resolveMany(source, links) {
  return __async(this, null, function* () {
    const out = [];
    for (const link of links.slice(0, 8)) {
      try {
        const r = yield resolveSourceLink(source, link);
        out.push.apply(out, r);
      } catch (e) {
        continue;
      }
    }
    return out;
  });
}
function scrape4khdhub(ctx) {
  return __async(this, null, function* () {
    if (!enabled("hdhub"))
      return [];
    const base = yield dynUrl("4khdhub");
    if (!base || !ctx.title)
      return [];
    try {
      const searchHtml = yield fetchText(base + "/?s=" + encodeURIComponent(ctx.title), {}, 2e4);
      let $ = import_cheerio_without_node_native2.default.load(searchHtml);
      const want = ctx.title.toLowerCase();
      let href = null;
      $("div.card-grid > a").each(function(_, el) {
        const content = ($(el).find("div.movie-card-content").text() || "").toLowerCase();
        if (content.indexOf(want) !== -1 && (!ctx.year || content.indexOf(String(ctx.year)) !== -1)) {
          href = $(el).attr("href");
          return false;
        }
      });
      if (!href)
        return [];
      const pageHtml = yield fetchText(fixUrl(href, base), {}, 2e4);
      $ = import_cheerio_without_node_native2.default.load(pageHtml);
      let raws = [];
      if (!ctx.isTv) {
        $("div.download-item a").each(function(_, el) {
          raws.push($(el).attr("href"));
        });
      } else {
        const slug = episodeSlug(ctx.season, ctx.episode);
        $("div.episode-download-item").each(function(_, el) {
          const t = $(el).find("div.episode-file-title").text() || "";
          if (t.indexOf(slug.code) !== -1 || t.indexOf(slug.alt) !== -1) {
            $(el).find("div.episode-links > a").each(function(_2, a) {
              raws.push($(a).attr("href"));
            });
          }
        });
      }
      const links = [];
      for (const r of raws) {
        if (!r)
          continue;
        if (/hubcloud|hubdrive/i.test(r))
          links.push(r);
        else {
          const resolved = yield getRedirectLinks(r);
          if (resolved)
            links.push(resolved);
        }
      }
      return yield resolveMany("4KHDHub", links);
    } catch (e) {
      console.log("[Streamline][4khdhub] " + e.message);
      return [];
    }
  });
}

// src/hdhub/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      const out = yield withTimeout(scrape4khdhub(ctx), 2e4, "4khdhub");
      return dedupe(yield withSharedSubs(out, ctx));
    } catch (e) {
      console.log("[Streamline][4khdhub] " + (e && e.message));
      return [];
    }
  });
}
function onSettings() {
  return __async(this, null, function* () {
    return [wyzieKeyField()];
  });
}
module.exports = { getStreams, onSettings };
