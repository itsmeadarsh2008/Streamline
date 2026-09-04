/**
 * streamline - Built from src/streamline/
 * Generated: 2026-09-04T11:29:12.723Z
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

// src/streamline/constants.js
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var SHOWBOX_API = "https://showbox.media";
var FEBBOX_API = "https://www.febbox.com";
var HEXA_API = "https://theemoviedb.hexa.su";
var VIDEASY_API = "https://api.speedracelight.com";
var VIDLINK_API = "https://vidlink.pro";
var MULTI_DECRYPT_API = "https://enc-dec.app/api";
var VIDZEE_API = "https://player.vidzee.wtf";
var VIDZEE_SECRET_B64 = "QTdrUDl4TTJRdjhMcjROejFIdTZZYzNCdzVKZjBEc1U=";
var VIDROCK_API = "https://vidrock.ru";
var VIDROCK_KEY_HEX = "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f";
var PRIMESRC_API = "https://primesrc.me";
var VIDFAST_API = "https://vidfast.vc";
var VIDCORE_API = "https://vidcore.io";
var VAPLAYER_API = "https://streamdata.vaplayer.ru";
var CINEJOY_API = "https://api.shegu.st";
var CINEJOY_BASE = "https://cinejoy.to";
var ALLMOVIELAND_API = "https://allmovieland.one";
var MOVIEBOX_BASE = "https://h5-api.aoneroom.com";
var WYZIE_API = "https://sub.wyzie.io";
var TORRENTIO_API = "https://torrentio.strem.fun/limit=4";
var TORRENTSDB_API = "https://torrentsdb.com/eyJsaW1pdCI6IjMiLCJkZWJyaWRvcHRpb25zIjpbIm5vZG93bmxvYWRsaW5rcyJdfQ==";
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
    const cfg2 = yield getDynamicUrls();
    return cfg2 && cfg2[key] || "";
  });
}
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var UA_MOBILE = "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";

// src/streamline/tmdb.js
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

// src/streamline/utils.js
function defaultHeaders(extra) {
  return Object.assign({ "User-Agent": UA, "Accept": "*/*" }, extra || {});
}
function fetchWithTimeout(url, options, timeoutMs) {
  return __async(this, null, function* () {
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
function postJson(url, body, headers, timeoutMs) {
  return __async(this, null, function* () {
    const res = yield fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: defaultHeaders(
          Object.assign({ "Content-Type": "application/json", Accept: "application/json" }, headers || {})
        ),
        body: typeof body === "string" ? body : JSON.stringify(body == null ? {} : body)
      },
      timeoutMs
    );
    if (!res.ok)
      throw new Error("HTTP " + res.status + " for " + url);
    const text = yield res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
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
function runLimited(tasks, concurrency) {
  return __async(this, null, function* () {
    const limit = Math.max(1, concurrency || 6);
    const results = [];
    for (let i = 0; i < tasks.length; i += limit) {
      const chunk = tasks.slice(i, i + limit);
      const settled = yield Promise.all(
        chunk.map(function(t) {
          try {
            return Promise.resolve(t()).catch(function() {
              return [];
            });
          } catch (e) {
            return Promise.resolve([]);
          }
        })
      );
      settled.forEach(function(r) {
        if (Array.isArray(r))
          results.push.apply(results, r);
      });
    }
    return results;
  });
}
function withTimeout(promise, ms, label) {
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

// src/streamline/subs.js
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

// src/streamline/torrents.js
function settings2() {
  try {
    return globalThis.SCRAPER_SETTINGS || {};
  } catch (e) {
    return {};
  }
}
function buildMagnet(infoHash, fileIdx, trackers) {
  let magnet = "magnet:?xt=urn:btih:" + infoHash + "&dn=" + infoHash;
  (trackers || []).forEach(function(t) {
    magnet += "&tr=" + encodeURIComponent(t);
  });
  if (fileIdx != null)
    magnet += "&index=" + fileIdx;
  return magnet;
}
function parseTitleMeta(title) {
  const t = String(title || "");
  const seedM = t.match(/[👤👥]\s*(\d+)/);
  const sizeM = t.match(/💾\s*([0-9.]+\s*[A-Za-z]+)/);
  return {
    seeders: seedM ? parseInt(seedM[1], 10) : 0,
    size: sizeM ? sizeM[1] : ""
  };
}
function stremioTorrents(sourceName, api, imdbId, season, episode, isTv) {
  return __async(this, null, function* () {
    const path = !isTv ? "/stream/movie/" + imdbId + ".json" : "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json";
    const json = JSON.parse(yield fetchText(api + path, {}, 2e4));
    const streams = json && json.streams || [];
    const out = [];
    streams.forEach(function(s) {
      if (!s || !s.infoHash)
        return;
      const label = s.title || s.description || s.name || "";
      const meta = parseTitleMeta(label);
      if (meta.seeders && meta.seeders < 20)
        return;
      const magnet = buildMagnet(s.infoHash, s.fileIdx, s.sources);
      const quality = parseQuality(s.name || label);
      const stream = makeStream(
        sourceName,
        sourceName + " | " + quality + (meta.size ? " | " + meta.size : "") + " | S" + meta.seeders,
        magnet,
        quality,
        {}
      );
      if (stream)
        out.push(stream);
    });
    return out;
  });
}
function torrentSources(imdbId, season, episode, isTv) {
  return __async(this, null, function* () {
    if (!imdbId)
      return [];
    const cfg2 = settings2();
    if (cfg2.enableTorrents === false)
      return [];
    const jobs = [];
    if (cfg2.torrentio !== false) {
      jobs.push(
        function() {
          return __async(this, null, function* () {
            try {
              return yield stremioTorrents("Torrentio", TORRENTIO_API, imdbId, season, episode, isTv);
            } catch (e) {
              console.log("[Streamline][torrentio] " + e.message);
              return [];
            }
          });
        }()
      );
    }
    if (cfg2.torrentsdb !== false) {
      jobs.push(
        function() {
          return __async(this, null, function* () {
            try {
              return yield stremioTorrents("TorrentsDB", TORRENTSDB_API, imdbId, season, episode, isTv);
            } catch (e) {
              console.log("[Streamline][torrentsdb] " + e.message);
              return [];
            }
          });
        }()
      );
    }
    const settled = yield Promise.all(jobs);
    const out = [];
    settled.forEach(function(r) {
      out.push.apply(out, r);
    });
    return out;
  });
}

// src/streamline/sources/vidlink.js
function enabled() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.vidlink !== false;
  } catch (e) {
    return true;
  }
}
var HEADERS = {
  "User-Agent": UA_MOBILE,
  Connection: "keep-alive",
  Referer: VIDLINK_API + "/",
  Origin: VIDLINK_API
};
function scrape(ctx) {
  return __async(this, null, function* () {
    if (!enabled())
      return [];
    const tmdbId = ctx.tmdbId;
    if (!tmdbId)
      return [];
    const isTv = ctx.isTv;
    const encText = yield fetchText(
      MULTI_DECRYPT_API + "/enc-vidlink?text=" + encodeURIComponent(String(tmdbId)),
      {},
      15e3
    );
    let enc = "";
    try {
      enc = JSON.parse(encText).result || "";
    } catch (e) {
      return [];
    }
    if (!enc)
      return [];
    const epUrl = !isTv ? VIDLINK_API + "/api/b/movie/" + enc : VIDLINK_API + "/api/b/tv/" + enc + "/" + ctx.season + "/" + ctx.episode;
    const json = JSON.parse(yield fetchText(epUrl, HEADERS, 2e4));
    const stream = json && json.stream || json;
    if (!stream)
      return [];
    const qualities = stream.qualities || {};
    const out = [];
    Object.keys(qualities).forEach(function(k) {
      const v = qualities[k] || {};
      const url = v.url;
      if (!url)
        return;
      const isM3u8 = v.type === "m3u8" || String(url).indexOf(".m3u8") !== -1;
      const qmap = { 1080: "1080p", 720: "720p", 480: "480p", 360: "360p" };
      const quality = qmap[k] || parseQuality(k);
      const streamHeaders = v.headers || {
        Referer: "https://filmboom.top/",
        Origin: "https://filmboom.top"
      };
      const s = makeStream(
        "Vidlink",
        "Vidlink - " + quality + (isM3u8 ? " [HLS]" : ""),
        url,
        quality,
        streamHeaders,
        []
      );
      if (s)
        out.push(s);
    });
    const captions = stream.captions || [];
    const subs = captions.filter(function(c) {
      return c && c.url;
    }).map(function(c) {
      return {
        url: c.url,
        language: c.language || "en",
        name: (c.language || "Subtitle") + " [Vidlink]"
      };
    });
    if (subs.length) {
      return out.map(function(s) {
        const copy = Object.assign({}, s);
        copy.subtitles = subs.slice(0, 8);
        return copy;
      });
    }
    return out;
  });
}

// src/streamline/sources/videasy.js
var SERVERS = [
  "myflixerzupcloud",
  "downloader2",
  "m4uhd",
  "hdmovie",
  "cdn",
  "superflix",
  "lamovie",
  "jett",
  "tejo",
  "neon2",
  "ym"
];
function enabled2() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.videasy !== false;
  } catch (e) {
    return true;
  }
}
function dblEncode(s) {
  return encodeURIComponent(encodeURIComponent(s)).replace(/%20/g, "%2520");
}
function scrape2(ctx) {
  return __async(this, null, function* () {
    if (!enabled2())
      return [];
    if (!ctx.tmdbId || !ctx.title)
      return [];
    const isTv = ctx.isTv;
    const seedJson = JSON.parse(
      yield fetchText(
        VIDEASY_API + "/seed?mediaId=" + encodeURIComponent(String(ctx.tmdbId)),
        {},
        15e3
      )
    );
    const seed = seedJson && seedJson.seed || seedJson;
    if (!seed || typeof seed !== "string")
      return [];
    const headers = {
      Accept: "*/*",
      "User-Agent": UA,
      Origin: "https://player.videasy.to",
      Referer: "https://player.videasy.to/"
    };
    const mediaType = isTv ? "tv" : "movie";
    const base = "?title=" + dblEncode(ctx.title) + "&mediaType=" + mediaType + "&year=" + (ctx.year || "") + "&tmdbId=" + ctx.tmdbId + "&imdbId=" + (ctx.imdbId || "") + "&enc=2&seed=" + encodeURIComponent(seed) + (isTv ? "&episodeId=" + ctx.episode + "&seasonId=" + ctx.season : "");
    const jobs = SERVERS.map(function(server) {
      return function() {
        return __async(this, null, function* () {
          try {
            const encData = yield fetchText(
              VIDEASY_API + "/" + server + "/sources-with-title" + base,
              headers,
              15e3
            );
            const dec = yield postJson(
              MULTI_DECRYPT_API + "/dec-videasy",
              { text: encData, id: ctx.tmdbId, seed },
              {},
              15e3
            );
            const result = dec && dec.result || {};
            const sources = result.sources || [];
            const subs = (result.subtitles || []).filter(function(t) {
              return t && t.url;
            }).map(function(t) {
              return {
                url: t.url,
                language: t.language || "en",
                name: (t.language || "Subtitle") + " [Videasy]"
              };
            });
            return sources.map(function(src) {
              if (!src || !src.url)
                return null;
              const u = String(src.url);
              const quality = /1080/.test(src.quality || u) ? "1080p" : /720/.test(src.quality || u) ? "720p" : /2160|4k/i.test(src.quality || u) ? "4K" : "Auto";
              return makeStream(
                "Videasy",
                "Videasy [" + server + "] - " + quality,
                u,
                quality,
                headers,
                subs.slice(0, 8)
              );
            }).filter(Boolean);
          } catch (e) {
            return [];
          }
        });
      }();
    });
    const settled = yield Promise.all(jobs);
    const out = [];
    settled.forEach(function(r) {
      out.push.apply(out, r);
    });
    return out;
  });
}

// src/streamline/sources/hexa.js
function enabled3() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.hexa !== false;
  } catch (e) {
    return true;
  }
}
function randomKeyHex() {
  let out = "";
  const hex = "0123456789abcdef";
  for (let i = 0; i < 64; i++)
    out += hex[Math.floor(Math.random() * 16)];
  return out;
}
function scrape3(ctx) {
  return __async(this, null, function* () {
    if (!enabled3())
      return [];
    if (!ctx.tmdbId)
      return [];
    const isTv = ctx.isTv;
    const target = !isTv ? HEXA_API + "/api/tmdb/movie/" + ctx.tmdbId + "/images" : HEXA_API + "/api/tmdb/tv/" + ctx.tmdbId + "/season/" + ctx.season + "/episode/" + ctx.episode + "/images";
    const key = randomKeyHex();
    const tokenJson = JSON.parse(
      yield fetchText(MULTI_DECRYPT_API + "/enc-hexa", {}, 15e3)
    );
    const token = tokenJson && tokenJson.result && tokenJson.result.token || tokenJson.token || "";
    if (!token)
      return [];
    const encData = yield fetchText(
      target,
      {
        "User-Agent": UA,
        Accept: "text/plain",
        "X-Api-Key": key,
        "X-Fingerprint-Lite": "e9136c41504646444",
        Referer: "https://hexa.su/",
        "X-Cap-Token": token
      },
      2e4
    );
    const dec = yield postJson(
      MULTI_DECRYPT_API + "/dec-hexa",
      { text: encData, key },
      {},
      15e3
    );
    const sources = dec && dec.result && dec.result.sources || [];
    return sources.map(function(src) {
      if (!src || !src.url)
        return null;
      const server = src.server || "Hexa";
      return makeStream(
        "Hexa",
        "Hexa " + String(server).charAt(0).toUpperCase() + String(server).slice(1),
        src.url,
        "Auto",
        { Referer: "https://hexa.su/", "User-Agent": UA },
        []
      );
    }).filter(Boolean);
  });
}

// src/streamline/sources/vidzee.js
var import_crypto_js = __toESM(require("crypto-js"));
var SERVERS2 = [0, 1, 2, 4, 5, 6, 7];
function enabled4() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.vidzee !== false;
  } catch (e) {
    return true;
  }
}
var _key = null;
function aesKey() {
  if (!_key) {
    const secret = b64DecodeUtf8(VIDZEE_SECRET_B64);
    const padded = (secret + new Array(33).join("\0")).substring(0, 32);
    _key = import_crypto_js.default.enc.Utf8.parse(padded);
  }
  return _key;
}
function decryptVidzeeUrl(encryptedUrl) {
  try {
    const outer = b64DecodeUtf8(encryptedUrl);
    const idx = outer.indexOf(":");
    if (idx === -1)
      return null;
    const ivB64 = outer.substring(0, idx);
    const ctB64 = outer.substring(idx + 1);
    const decrypted = import_crypto_js.default.AES.decrypt(
      { ciphertext: import_crypto_js.default.enc.Base64.parse(ctB64) },
      aesKey(),
      { iv: import_crypto_js.default.enc.Base64.parse(ivB64), mode: import_crypto_js.default.mode.CBC, padding: import_crypto_js.default.pad.Pkcs7 }
    );
    const text = decrypted.toString(import_crypto_js.default.enc.Utf8);
    return text || null;
  } catch (e) {
    return null;
  }
}
function scrape4(ctx) {
  return __async(this, null, function* () {
    if (!enabled4())
      return [];
    if (!ctx.tmdbId)
      return [];
    const isTv = ctx.isTv;
    const jobs = SERVERS2.map(function(sr) {
      return function() {
        return __async(this, null, function* () {
          try {
            const url = !isTv ? VIDZEE_API + "/api/server?id=" + ctx.tmdbId + "&sr=" + sr : VIDZEE_API + "/api/server?id=" + ctx.tmdbId + "&sr=" + sr + "&ss=" + ctx.season + "&ep=" + ctx.episode;
            const json = JSON.parse(yield fetchText(url, { "User-Agent": UA }, 15e3));
            const globalHeaders = json && json.headers || {};
            const links = json && json.url || [];
            const tracks = json && json.tracks || [];
            const subs = tracks.filter(function(t) {
              return t && t.url;
            }).map(function(t) {
              return {
                url: t.url,
                language: t.lang || "en",
                name: (t.lang || "Subtitle") + " [Vidzee]"
              };
            });
            const out2 = [];
            links.forEach(function(entry) {
              if (!entry || !entry.link)
                return;
              const finalUrl = decryptVidzeeUrl(entry.link);
              if (!finalUrl || finalUrl.indexOf("https:") === -1)
                return;
              const lang = entry.lang ? " (" + entry.lang + (entry.flag ? " - " + entry.flag : "") + ")" : "";
              const isHls = entry.type === "hls" || finalUrl.indexOf(".m3u8") !== -1;
              const s = makeStream(
                "Vidzee",
                "Vidzee " + (entry.name || "") + lang + (isHls ? " [HLS]" : ""),
                finalUrl,
                "1080p",
                Object.assign({ Referer: VIDZEE_API + "/" }, globalHeaders),
                subs.slice(0, 8)
              );
              if (s)
                out2.push(s);
            });
            return out2;
          } catch (e) {
            return [];
          }
        });
      }();
    });
    const settled = yield Promise.all(jobs);
    const out = [];
    settled.forEach(function(r) {
      out.push.apply(out, r);
    });
    return out;
  });
}

// src/streamline/sources/vidrock.js
function enabled5() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.vidrock !== false;
  } catch (e) {
    return true;
  }
}
function hexToBytes(hex) {
  const out = [];
  for (let i = 0; i < hex.length; i += 2)
    out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}
function subtle() {
  try {
    if (globalThis.crypto && globalThis.crypto.subtle)
      return globalThis.crypto.subtle;
    if (typeof require !== "undefined") {
      try {
        const nc = require("node:crypto");
        if (nc && nc.webcrypto && nc.webcrypto.subtle)
          return nc.webcrypto.subtle;
      } catch (e) {
      }
    }
  } catch (e) {
  }
  return null;
}
function decryptVidrockUrl(payload) {
  return __async(this, null, function* () {
    try {
      const sub = subtle();
      if (!sub)
        return null;
      let std = String(payload).replace(/-/g, "+").replace(/_/g, "/");
      while (std.length % 4 !== 0)
        std += "=";
      const data = b64DecodeToBytes(std);
      if (data.length <= 12)
        return null;
      const nonce = new Uint8Array(data.slice(0, 12));
      const ct = new Uint8Array(data.slice(12));
      const keyBytes = new Uint8Array(hexToBytes(VIDROCK_KEY_HEX));
      const key = yield sub.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
      const plain = yield sub.decrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, ct);
      return bytesToUtf8(Array.from(new Uint8Array(plain)));
    } catch (e) {
      return null;
    }
  });
}
function scrape5(ctx) {
  return __async(this, null, function* () {
    if (!enabled5())
      return [];
    if (!ctx.tmdbId)
      return [];
    const isTv = ctx.isTv;
    const type = !isTv ? "movie" : "tv";
    const query = !isTv ? String(ctx.tmdbId) : ctx.tmdbId + "_" + ctx.season + "_" + ctx.episode;
    let json;
    try {
      json = JSON.parse(
        yield fetchText(VIDROCK_API + "/api/" + type + "/" + query + "/", {
          Origin: VIDROCK_API,
          Referer: VIDROCK_API + "/",
          "User-Agent": UA
        }, 2e4)
      );
    } catch (e) {
      console.log("[Streamline][vidrock] " + e.message);
      return [];
    }
    const out = [];
    const entries = Object.keys(json || {});
    for (const server of entries) {
      const enc = json[server] && (json[server].url || json[server]);
      if (!enc || typeof enc !== "string" || enc === "error" || enc === "null")
        continue;
      const url = yield decryptVidrockUrl(enc);
      if (!url || url.indexOf("http") !== 0)
        continue;
      const s = makeStream(
        "Vidrock",
        "Vidrock [" + server + "]",
        url,
        "Auto",
        { Origin: VIDROCK_API, Referer: VIDROCK_API + "/", "User-Agent": UA },
        []
      );
      if (s)
        out.push(s);
    }
    return out;
  });
}

// src/streamline/sources/vidfast.js
function enabled6(key) {
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
function scrapeGeneric(opts, ctx) {
  return __async(this, null, function* () {
    const base = opts.base;
    const tag = opts.tag;
    const encName = opts.enc;
    const decName = opts.dec;
    const pageUrl = !ctx.isTv ? base + "/movie/" + ctx.tmdbId + "/" : base + "/tv/" + ctx.tmdbId + "/" + ctx.season + "/" + ctx.episode + "/";
    const headers = {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      Referer: base + "/"
    };
    const page = yield fetchText(pageUrl, headers, 2e4);
    const tokenText = extractToken(page);
    if (!tokenText)
      return [];
    const initJson = JSON.parse(
      yield fetchText(
        MULTI_DECRYPT_API + "/" + encName + "?text=" + encodeURIComponent(tokenText),
        {},
        15e3
      )
    );
    const init = initJson && initJson.result || {};
    const serversUrl = init.servers;
    const streamBase = init.stream;
    const csrf = init.token;
    if (!serversUrl || !streamBase)
      return [];
    if (csrf)
      headers["X-CSRF-Token"] = csrf;
    const serversEnc = yield function() {
      return __async(this, null, function* () {
        const res = yield fetch(serversUrl, { method: "POST", headers });
        return yield res.text();
      });
    }();
    const serversJson = yield postJson(
      MULTI_DECRYPT_API + "/" + decName,
      { text: serversEnc },
      {},
      15e3
    );
    const servers = serversJson && serversJson.result || [];
    if (!Array.isArray(servers) || !servers.length)
      return [];
    const out = [];
    for (const server of servers) {
      try {
        const streamRes = yield fetch(streamBase + "/" + server.data, {
          method: "POST",
          headers
        });
        const streamEnc = yield streamRes.text();
        const streamJson = yield postJson(
          MULTI_DECRYPT_API + "/" + decName,
          { text: streamEnc },
          {},
          15e3
        );
        const data = streamJson && streamJson.result || {};
        const fileUrl = data.url;
        if (!fileUrl)
          continue;
        const subs = (data.tracks || []).filter(function(t) {
          return t && t.file;
        }).map(function(t) {
          return {
            url: t.file,
            language: t.label || "en",
            name: (t.label || "Subtitle") + " [" + tag + "]"
          };
        });
        const quality = data.is4kAvailable || /4k/i.test(server.description || server.name || "") ? "4K" : parseQuality(server.description || fileUrl);
        const s = makeStream(
          tag,
          tag + " [" + (server.name || "server") + "] - " + quality,
          fileUrl,
          quality,
          headers,
          subs.slice(0, 8)
        );
        if (s)
          out.push(s);
      } catch (e) {
        continue;
      }
    }
    return out;
  });
}
function scrapeVidfast(ctx) {
  return __async(this, null, function* () {
    if (!enabled6("vidfast"))
      return [];
    if (!ctx.tmdbId)
      return [];
    try {
      return yield scrapeGeneric(
        { base: VIDFAST_API, tag: "Vidfast", enc: "enc-vidfast", dec: "dec-vidfast" },
        ctx
      );
    } catch (e) {
      console.log("[Streamline][vidfast] " + e.message);
      return [];
    }
  });
}
function scrapeVidcore(ctx) {
  return __async(this, null, function* () {
    if (!enabled6("vidcore"))
      return [];
    if (!ctx.tmdbId)
      return [];
    try {
      const extra = { Referer: VIDCORE_API + "/", "X-Requested-With": "XMLHttpRequest", "User-Agent": UA };
      const pageUrl = !ctx.isTv ? VIDCORE_API + "/movie/" + ctx.tmdbId : VIDCORE_API + "/tv/" + ctx.tmdbId + "/" + ctx.season + "/" + ctx.episode;
      const page = yield fetchText(pageUrl, extra, 2e4);
      const tokenText = extractToken(page);
      if (!tokenText)
        return [];
      const initJson = JSON.parse(
        yield fetchText(
          MULTI_DECRYPT_API + "/enc-vidcore?text=" + encodeURIComponent(tokenText),
          {},
          15e3
        )
      );
      const init = initJson && initJson.result || {};
      if (!init.servers || !init.stream)
        return [];
      const headers = Object.assign({}, extra);
      if (init.token)
        headers["X-CSRF-Token"] = init.token;
      const serversEnc = yield function() {
        return __async(this, null, function* () {
          const res = yield fetch(init.servers, { method: "POST", headers });
          return yield res.text();
        });
      }();
      const serversJson = yield postJson(MULTI_DECRYPT_API + "/dec-vidcore", { text: serversEnc }, {}, 15e3);
      const servers = serversJson && serversJson.result || [];
      const out = [];
      for (const server of servers) {
        try {
          const streamRes = yield fetch(init.stream + "/" + server.data, { method: "POST", headers });
          const streamEnc = yield streamRes.text();
          const streamJson = yield postJson(MULTI_DECRYPT_API + "/dec-vidcore", { text: streamEnc }, {}, 15e3);
          const data = streamJson && streamJson.result || {};
          if (!data.url)
            continue;
          const subs = (data.tracks || []).filter(function(t) {
            return t && t.file;
          }).map(function(t) {
            return {
              url: t.file,
              language: t.label || "en",
              name: (t.label || "Subtitle") + " [Vidcore]"
            };
          });
          const s = makeStream(
            "Vidcore",
            "Vidcore - " + (server.name || "server"),
            data.url,
            "Auto",
            { Referer: VIDCORE_API + "/" },
            subs.slice(0, 8)
          );
          if (s)
            out.push(s);
        } catch (e) {
          continue;
        }
      }
      return out;
    } catch (e) {
      console.log("[Streamline][vidcore] " + e.message);
      return [];
    }
  });
}

// src/streamline/sources/misc.js
function enabled7(key) {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s[key] !== false;
  } catch (e) {
    return true;
  }
}
function scrapeVaplayer(ctx) {
  return __async(this, null, function* () {
    if (!enabled7("vaplayer"))
      return [];
    if (!ctx.imdbId)
      return [];
    const url = !ctx.isTv ? VAPLAYER_API + "/api.php?imdb=" + ctx.imdbId + "&type=movie" : VAPLAYER_API + "/api.php?imdb=" + ctx.imdbId + "&type=tv&season=" + ctx.season + "&episode=" + ctx.episode;
    try {
      const json = JSON.parse(
        yield fetchText(url, { Referer: "https://nextgencloudfabric.com/" }, 2e4)
      );
      const data = json && json.data || {};
      const urls = data.stream_urls || [];
      const subs = (json && json.default_subs || []).filter(function(s) {
        return s && s.url;
      }).map(function(s) {
        return {
          url: s.url,
          language: s.lang || s.code || "en",
          name: (s.lang || s.code || "Subtitle") + " [VaPlayer]"
        };
      });
      return urls.map(function(u) {
        return makeStream(
          "VaPlayer",
          "VaPlayer [HLS]",
          u,
          "Auto",
          { Referer: "https://nextgencloudfabric.com/" },
          subs.slice(0, 8)
        );
      }).filter(Boolean);
    } catch (e) {
      console.log("[Streamline][vaplayer] " + e.message);
      return [];
    }
  });
}
function scrapePrimesrc(ctx) {
  return __async(this, null, function* () {
    if (!enabled7("primesrc"))
      return [];
    if (!ctx.imdbId)
      return [];
    const headers = { Referer: PRIMESRC_API + "/", "User-Agent": UA };
    const url = !ctx.isTv ? PRIMESRC_API + "/api/v1/s?imdb=" + ctx.imdbId + "&type=movie" : PRIMESRC_API + "/api/v1/s?imdb=" + ctx.imdbId + "&season=" + ctx.season + "&episode=" + ctx.episode + "&type=tv";
    try {
      const list = JSON.parse(yield fetchText(url, headers, 2e4));
      const servers = list && list.servers || [];
      const out = [];
      for (const srv of servers) {
        try {
          if (!srv || !srv.key)
            continue;
          const raw = JSON.parse(
            yield fetchText(PRIMESRC_API + "/api/v1/l?key=" + srv.key, headers, 15e3)
          );
          const link = raw && raw.link;
          if (!link)
            continue;
          const quality = parseQuality(srv.quality || srv.name || link);
          const s = makeStream(
            "PrimeSrc",
            "PrimeSrc [" + (srv.name || "server") + "] - " + quality,
            link,
            quality,
            headers,
            []
          );
          if (s)
            out.push(s);
        } catch (e) {
          continue;
        }
      }
      return out;
    } catch (e) {
      console.log("[Streamline][primesrc] " + e.message);
      return [];
    }
  });
}

// src/streamline/sources/showbox.js
var SHOWBOX_HEADERS = {
  Accept: "application/json, text/html, */*",
  "Accept-Language": "en",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
};
var VIDEO_HEADERS = {
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
  const m = html.match(/class="film-name[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"/) || html.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*film-name[^"]*"/);
  return m ? SHOWBOX_API + m[1] : null;
}
function parseHeadingId(html) {
  const m = html.match(/class="heading-name[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/);
  if (!m)
    return null;
  const parts = m[1].split("/");
  const last = parts[parts.length - 1];
  const n = parseInt(last, 10);
  return isNaN(n) ? null : n;
}
function normalizeToken(token) {
  if (token.indexOf("eyJ") === 0)
    return "ui=" + token;
  if (token.indexOf("ui=") === 0)
    return token;
  return "ui=" + token;
}
function parseQualityDivs(html) {
  const out = [];
  const divs = html.match(/<div[^>]*class="[^"]*file_quality[^"]*"[^>]*>/g) || [];
  divs.forEach(function(tag) {
    const u = tag.match(/data-url="([^"]+)"/);
    const q = tag.match(/data-quality="([^"]+)"/);
    if (u && q)
      out.push({ url: u[1].replace(/\\\//g, "/"), quality: q[1] });
  });
  return out;
}
function searchSuperstream(imdbId) {
  return __async(this, null, function* () {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const searchHtml = yield fetchText(
          SHOWBOX_API + "/search?keyword=" + encodeURIComponent(imdbId),
          SHOWBOX_HEADERS,
          15e3
        );
        const detailUrl = parseSearchHref(searchHtml);
        if (!detailUrl)
          continue;
        const detailHtml = yield fetchText(detailUrl, SHOWBOX_HEADERS, 15e3);
        const id = parseHeadingId(detailHtml);
        if (id != null)
          return id;
      } catch (e) {
        continue;
      }
    }
    return null;
  });
}
function scrape6(ctx) {
  return __async(this, null, function* () {
    const settings4 = cfg();
    if (settings4.showbox === false)
      return [];
    const token = settings4.showboxToken;
    if (!token || !ctx.imdbId)
      return [];
    const isTv = ctx.isTv;
    try {
      const mediaId = yield searchSuperstream(ctx.imdbId);
      if (mediaId == null)
        return [];
      const type = !isTv ? 1 : 2;
      const shareJson = JSON.parse(
        yield fetchText(SHOWBOX_API + "/index/share_link?id=" + mediaId + "&type=" + type, SHOWBOX_HEADERS, 15e3)
      );
      const link = shareJson && shareJson.data && shareJson.data.link || "";
      const shareKey = link.split("/").pop();
      if (!shareKey)
        return [];
      const listJson = JSON.parse(
        yield fetchText(FEBBOX_API + "/file/file_share_list?share_key=" + shareKey, SHOWBOX_HEADERS, 15e3)
      );
      const root = listJson && listJson.data && listJson.data.file_list || [];
      let fid = null;
      if (!isTv) {
        const file = root.find(function(f) {
          return !f.is_dir;
        });
        fid = file && file.fid;
      } else {
        const sPad = String(ctx.season).padStart(2, "0");
        let folder = root.find(function(f) {
          return f.is_dir && /season/i.test(f.file_name || "");
        }) || root.find(function(f) {
          return f.is_dir;
        });
        if (!folder)
          return [];
        const subJson = JSON.parse(
          yield fetchText(
            FEBBOX_API + "/file/file_share_list?share_key=" + shareKey + "&parent_id=" + folder.fid + "&page=1",
            SHOWBOX_HEADERS,
            15e3
          )
        );
        const files = subJson && subJson.data && subJson.data.file_list || [];
        const ePad = String(ctx.episode).padStart(2, "0");
        const ep = files.find(function(f) {
          const n = String(f.file_name || "").toLowerCase();
          return !f.is_dir && (n.indexOf("e" + ePad) !== -1 || n.indexOf("ep" + ePad) !== -1 || n.indexOf("episode " + ctx.episode) !== -1);
        }) || files.find(function(f) {
          return !f.is_dir;
        });
        fid = ep && ep.fid;
      }
      if (!fid)
        return [];
      const qJson = JSON.parse(
        yield fetchText(
          FEBBOX_API + "/console/video_quality_list?fid=" + fid + "&share_key=" + shareKey,
          Object.assign({}, SHOWBOX_HEADERS, { Cookie: normalizeToken(token) }),
          15e3
        )
      );
      const qualities = parseQualityDivs(qJson && qJson.html || "");
      return qualities.map(function(q) {
        const isM3u8 = q.url.indexOf(".m3u8") !== -1;
        return makeStream(
          "Showbox",
          "ShowBox " + q.quality + (isM3u8 ? " [HLS]" : ""),
          q.url,
          q.quality === "ORG" ? "4K" : parseQuality(q.quality),
          VIDEO_HEADERS,
          []
        );
      }).filter(Boolean);
    } catch (e) {
      console.log("[Streamline][showbox] " + e.message);
      return [];
    }
  });
}

// src/streamline/sources/moviebox.js
function enabled8() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.moviebox !== false;
  } catch (e) {
    return true;
  }
}
function unwrap(obj) {
  if (!obj || typeof obj !== "object")
    return {};
  if (obj.data && obj.data.data)
    return obj.data.data;
  if (obj.data)
    return obj.data;
  return obj;
}
function cleanTitle(t) {
  return String(t || "").replace(/\sS\d+.*$/i, "").trim().toLowerCase();
}
function scrape7(ctx) {
  return __async(this, null, function* () {
    if (!enabled8())
      return [];
    if (!ctx.title)
      return [];
    const isTv = ctx.isTv;
    try {
      const pkgRes = yield fetch(MOVIEBOX_BASE + "/wefeed-h5api-bff/app/get-latest-app-pkgs?app_name=moviebox", {
        headers: { "User-Agent": UA }
      });
      let token = "";
      try {
        const xUser = pkgRes.headers && (pkgRes.headers.get("x-user") || pkgRes.headers.get("X-User")) || "";
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
      const searchObj = yield postJson(
        MOVIEBOX_BASE + "/wefeed-h5api-bff/subject/search",
        { keyword: ctx.title, page: 1, perPage: 24, subjectType: !isTv ? 1 : 2 },
        baseHeaders,
        2e4
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
      if (!subjectId)
        return [];
      const detailObj = JSON.parse(
        yield fetchText(
          "https://h5.aoneroom.com/wefeed-h5-bff/web/post/list/subject?id=" + subjectId,
          {},
          15e3
        )
      );
      const detailItems = (detailObj.data || {}).items || [];
      const detailPath = detailItems.length && detailItems[0].subject ? detailItems[0].subject.detailPath || "" : "";
      const params = "subjectId=" + subjectId + (isTv ? "&se=" + ctx.season + "&ep=" + ctx.episode : "") + (detailPath ? "&detailPath=" + encodeURIComponent(detailPath) : "");
      const reqHeaders = Object.assign({}, baseHeaders, {
        Referer: "https://fmoviesunblocked.net/spa/videoPlayPage/movies/" + detailPath + "?id=" + subjectId + "&type=/movie/detail",
        Origin: "https://fmoviesunblocked.net"
      });
      const playHeaders = { Referer: reqHeaders.Referer, Origin: reqHeaders.Origin, "User-Agent": UA };
      const out = [];
      const seen = {};
      function collect(url) {
        return __async(this, null, function* () {
          try {
            const obj = JSON.parse(yield fetchText(MOVIEBOX_BASE + url + params, reqHeaders, 2e4));
            const data = unwrap(obj);
            (data.downloads || data.streams || []).forEach(function(d) {
              if (!d || !d.url || d.vipLocked)
                return;
              const res = d.resolution || d.resolutions || "Auto";
              if (seen[res])
                return;
              seen[res] = true;
              const s = makeStream(
                "MovieBox",
                "MovieBox [" + lang + "] - " + res,
                d.url,
                res,
                playHeaders,
                []
              );
              if (s)
                out.push(s);
            });
            (data.captions || []).forEach(function(c) {
              if (!c || !c.url)
                return;
              const sub = {
                url: c.url,
                language: c.lan || c.lanName || "en",
                name: (c.lanName || c.lan || "Subtitle") + " [MovieBox]"
              };
              out.forEach(function(s) {
                s.subtitles = (s.subtitles || []).concat([sub]).slice(0, 8);
              });
            });
          } catch (e) {
            return;
          }
        });
      }
      yield collect("/wefeed-h5api-bff/subject/download?");
      yield collect("/wefeed-h5api-bff/subject/play?");
      return out;
    } catch (e) {
      console.log("[Streamline][moviebox] " + e.message);
      return [];
    }
  });
}

// src/streamline/sources/allmovieland.js
function enabled9() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.allmovieland !== false;
  } catch (e) {
    return true;
  }
}
function scrape8(ctx) {
  return __async(this, null, function* () {
    if (!enabled9())
      return [];
    if (!ctx.imdbId)
      return [];
    const referer = ALLMOVIELAND_API + "/";
    try {
      const playerJs = yield fetchText(ALLMOVIELAND_API + ".link/player.js?v=60%20128", { "User-Agent": UA }, 15e3);
      const hostM = playerJs.match(/const AwsIndStreamDomain.*'(.*)';/);
      const host = hostM ? hostM[1] : null;
      if (!host)
        return [];
      const playHtml = yield fetchText(host + "/play/" + ctx.imdbId, { Referer: referer, "User-Agent": UA }, 2e4);
      const scriptM = playHtml.match(/<script[^>]*>([\s\S]*?playlist[\s\S]*?)<\/script>/);
      const scriptBody = scriptM ? scriptM[1] : playHtml;
      let blob = scriptBody.substring(scriptBody.indexOf("{"));
      blob = blob.substring(0, blob.indexOf(";"));
      const cut = blob.lastIndexOf(")");
      if (cut !== -1)
        blob = blob.substring(0, cut);
      let playlist;
      try {
        playlist = JSON.parse(blob);
      } catch (e) {
        return [];
      }
      if (!playlist || !playlist.file)
        return [];
      const fileUrl = String(playlist.file).indexOf("http") === 0 ? playlist.file : host + playlist.file;
      const serversText = (yield function() {
        return __async(this, null, function* () {
          const res = yield fetch(fileUrl, {
            headers: {
              "X-CSRF-TOKEN": playlist.key || "",
              Referer: referer,
              "User-Agent": UA
            }
          });
          return yield res.text();
        });
      }()).replace(/,\s*\[]/g, "");
      let servers;
      try {
        servers = JSON.parse(serversText);
      } catch (e) {
        return [];
      }
      let pairs = [];
      if (!ctx.isTv) {
        pairs = (servers || []).map(function(s) {
          return { file: s.file, lang: s.title || "Server" };
        });
      } else {
        const season = (servers || []).find(function(s) {
          return String(s.id) === String(ctx.season);
        });
        const folder = season && season.folder;
        const ep = folder && Object.keys(folder).map(function(k) {
          return folder[k];
        }).find(function(e) {
          return e && String(e.episode) === String(ctx.episode);
        });
        const epFolder = ep && ep.folder;
        if (epFolder) {
          pairs = Object.keys(epFolder).map(function(k) {
            return { file: epFolder[k].file, lang: epFolder[k].title || "Server" };
          });
        }
      }
      const out = [];
      for (const p of pairs) {
        try {
          if (!p.file)
            continue;
          const res = yield fetch(host + "/playlist/" + p.file + ".txt", {
            headers: { "X-CSRF-TOKEN": playlist.key || "", Referer: referer, "User-Agent": UA }
          });
          const path = (yield res.text()).trim();
          if (!path)
            continue;
          const s = makeStream(
            "Allmovieland",
            "Allmovieland [" + p.lang + "] [HLS]",
            path,
            "1080p",
            { Referer: referer, "User-Agent": UA },
            []
          );
          if (s)
            out.push(s);
        } catch (e) {
          continue;
        }
      }
      return out;
    } catch (e) {
      console.log("[Streamline][allmovieland] " + e.message);
      return [];
    }
  });
}

// src/streamline/sources/cinejoy.js
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64urlDecodeToBytes(s) {
  let std = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (std.length % 4 !== 0)
    std += "=";
  const out = [];
  for (let i = 0; i < std.length; i += 4) {
    const n = B64.indexOf(std[i]) << 18 | B64.indexOf(std[i + 1]) << 12 | (B64.indexOf(std[i + 2]) & 63) << 6 | B64.indexOf(std[i + 3]) & 63;
    out.push(n >> 16 & 255, n >> 8 & 255, n & 255);
  }
  while (out.length && out[out.length - 1] === 0 && std.slice(-2) !== "==")
    break;
  return out;
}
function b64urlEncodeNoPad(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = a << 16 | b << 8 | c;
    out += B64[n >> 18 & 63] + B64[n >> 12 & 63];
    out += i + 1 < bytes.length ? B64[n >> 6 & 63] : "";
    out += i + 2 < bytes.length ? B64[n & 63] : "";
  }
  return out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function enabled10() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.cinejoy !== false;
  } catch (e) {
    return true;
  }
}
function scrape9(ctx) {
  return __async(this, null, function* () {
    if (!enabled10())
      return [];
    if (!ctx.title)
      return [];
    const isTv = ctx.isTv;
    const type = isTv ? "series" : "movie";
    const headers = {
      Accept: "*/*",
      Origin: CINEJOY_BASE,
      Referer: CINEJOY_BASE + "/",
      "User-Agent": UA
    };
    try {
      const serversJson = JSON.parse(yield fetchText(CINEJOY_API + "/servers", headers, 15e3));
      const servers = serversJson && serversJson.servers || [];
      if (!servers.length)
        return [];
      const out = [];
      for (const srv of servers.slice(0, 6)) {
        try {
          const name = srv && srv.name || srv;
          let target = CINEJOY_API + "/?title=" + encodeURIComponent(ctx.title) + "&type=" + type + "&year=" + (ctx.year || "") + "&imdb=" + (ctx.imdbId || "") + "&tmdb=" + (ctx.tmdbId || "") + "&server=" + encodeURIComponent(name);
          if (isTv)
            target += "&season=" + ctx.season + "&episode=" + ctx.episode;
          const encJson = JSON.parse(
            yield fetchText(MULTI_DECRYPT_API + "/enc-cinejoy?url=" + encodeURIComponent(target), {}, 15e3)
          );
          const result = encJson && encJson.result || encJson;
          if (!result || !result.data)
            continue;
          const bodyBytes = b64urlDecodeToBytes(result.data);
          const gRes = yield fetch(CINEJOY_API + "/g", {
            method: "POST",
            headers: Object.assign({}, headers, { "Content-Type": "application/octet-stream" }),
            body: new Uint8Array(bodyBytes)
          });
          const gBuf = new Uint8Array(yield gRes.arrayBuffer());
          const payload = b64urlEncodeNoPad(Array.from(gBuf));
          const decJson = yield postJson(
            MULTI_DECRYPT_API + "/dec-cinejoy",
            { text: payload, state: result.state },
            {},
            15e3
          );
          const streams = ((decJson && decJson.result || {}).data || {}).stream;
          if (!streams)
            continue;
          const list = Array.isArray(streams) ? streams : [streams];
          list.forEach(function(st) {
            if (!st)
              return;
            if (st.playlist) {
              const s = makeStream("Cinejoy", "Cinejoy - " + (st.id || name) + " [HLS]", st.playlist, "1080p", { Referer: CINEJOY_BASE + "/" }, []);
              if (s)
                out.push(s);
            }
            const quals = st.qualities || st.files || {};
            Object.keys(quals).forEach(function(k) {
              const u = quals[k];
              if (!u || String(u).indexOf("https") !== 0)
                return;
              const s = makeStream("Cinejoy", "Cinejoy - " + (st.id || name) + " " + k, u, parseQuality(k), { Referer: CINEJOY_BASE + "/" }, []);
              if (s)
                out.push(s);
            });
            (st.captions || []).forEach(function() {
            });
          });
        } catch (e) {
          continue;
        }
      }
      return out;
    } catch (e) {
      console.log("[Streamline][cinejoy] " + e.message);
      return [];
    }
  });
}

// src/streamline/sources/anime.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var ANIZONE_API = "https://anizone.to";
function enabled11() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.anizone !== false;
  } catch (e) {
    return true;
  }
}
function scrapeAnizone(ctx) {
  return __async(this, null, function* () {
    if (!enabled11())
      return [];
    const title = ctx.originalTitle || ctx.title;
    if (!title)
      return [];
    try {
      const searchHtml = yield fetchText(
        ANIZONE_API + "/anime?search=" + encodeURIComponent(title),
        { "User-Agent": UA },
        2e4
      );
      let $ = import_cheerio_without_node_native.default.load(searchHtml);
      const link = $("div.truncate > a").attr("href");
      if (!link)
        return [];
      const ep = ctx.isTv ? ctx.episode || 1 : 1;
      const pageHtml = yield fetchText(
        (link.indexOf("http") === 0 ? link : ANIZONE_API + link) + "/" + ep,
        { "User-Agent": UA },
        2e4
      );
      $ = import_cheerio_without_node_native.default.load(pageHtml);
      const subs = [];
      $("track").each(function(_, el) {
        const src2 = $(el).attr("src");
        if (src2) {
          subs.push({
            url: src2,
            language: $(el).attr("srclang") || "en",
            name: ($(el).attr("label") || "Subtitle") + " [Anizone]"
          });
        }
      });
      const src = $("media-player").attr("src");
      if (!src)
        return [];
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
  });
}

// src/streamline/sources/indian.js
var import_cheerio_without_node_native3 = __toESM(require("cheerio-without-node-native"));

// src/streamline/sources/hubcloud.js
var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));
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
function bypassHrefli(url) {
  return __async(this, null, function* () {
    try {
      let parseForm = function(html2) {
        const $ = import_cheerio_without_node_native2.default.load(html2);
        const form = $("form#landing");
        const action = form.attr("action") || url;
        const data = {};
        form.find("input").each(function(_, el) {
          data[$(el).attr("name")] = $(el).attr("value") || "";
        });
        return { action, data };
      }, encodeForm = function(data) {
        return Object.keys(data).map(function(k) {
          return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
        }).join("&");
      };
      const host = getBaseUrl(url);
      let html = yield fetchText(url, {}, 15e3);
      for (let i = 0; i < 2; i++) {
        const f = parseForm(html);
        const res = yield fetch(f.action.indexOf("http") === 0 ? f.action : host + f.action, {
          method: "POST",
          headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Referer: url },
          body: encodeForm(f.data)
        });
        html = yield res.text();
      }
      const goM = html.match(/\?go=([^"']+)/);
      if (!goM)
        return null;
      const skToken = goM[1];
      const wpMatch = html.match(/name="_wp_http2"[^>]*value="([^"]*)"/) || html.match(/_wp_http2["']?\s*[:=]\s*["']([^"']+)/);
      const cookieVal = wpMatch ? wpMatch[1] : "";
      const goRes = yield fetch(host + "?go=" + skToken, {
        headers: { "User-Agent": UA, Cookie: skToken + "=" + cookieVal, Referer: url }
      });
      const goHtml = yield goRes.text();
      const metaM = goHtml.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"']+)/i);
      const driveUrl = metaM ? metaM[1] : null;
      if (!driveUrl)
        return null;
      const driveText = yield fetchText(driveUrl, {}, 15e3);
      const pathM = driveText.match(/replace\("([^"]+)"/);
      const path = pathM ? pathM[1] : null;
      if (!path || path === "/404")
        return null;
      return fixUrl(path, getBaseUrl(driveUrl));
    } catch (e) {
      return null;
    }
  });
}
function extractMdriveLinks(html) {
  const $ = import_cheerio_without_node_native2.default.load(html);
  const out = [];
  $("a").each(function(_, el) {
    const href = $(el).attr("href") || "";
    if (/hubcloud|gdflix|gdlink/i.test(href))
      out.push(href);
  });
  return out;
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
      let $ = import_cheerio_without_node_native2.default.load(doc);
      let link = "";
      if (url.indexOf("/video/") !== -1) {
        link = ($("div.vd > center > a").attr("href") || "").trim();
      } else {
        const scriptTag = $("script:contains('url')").toString();
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
      const $2 = import_cheerio_without_node_native2.default.load(page2);
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
              const $b = import_cheerio_without_node_native2.default.load(bHtml);
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

// src/streamline/sources/indian.js
function enabled12(key) {
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
    if (!enabled12("hdhub"))
      return [];
    const base = yield dynUrl("4khdhub");
    if (!base || !ctx.title)
      return [];
    try {
      const searchHtml = yield fetchText(base + "/?s=" + encodeURIComponent(ctx.title), {}, 2e4);
      let $ = import_cheerio_without_node_native3.default.load(searchHtml);
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
      $ = import_cheerio_without_node_native3.default.load(pageHtml);
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
function scrapeUhdmovies(ctx) {
  return __async(this, null, function* () {
    if (!enabled12("uhdmovies"))
      return [];
    const base = yield dynUrl("uhdmovies");
    if (!base || !ctx.title)
      return [];
    try {
      const searchHtml = yield fetchText(
        base + "/search/" + encodeURIComponent(ctx.title + (ctx.year ? " " + ctx.year : "")),
        {},
        2e4
      );
      let $ = import_cheerio_without_node_native3.default.load(searchHtml);
      const href = $("article div.entry-image a").attr("href");
      if (!href)
        return [];
      const pageHtml = yield fetchText(fixUrl(href, base), {}, 2e4);
      $ = import_cheerio_without_node_native3.default.load(pageHtml);
      const links = [];
      if (!ctx.isTv) {
        $("div.entry-content p").each(function(_, el) {
          const t = $(el).text() || "";
          if (ctx.year && t.indexOf(String(ctx.year)) === -1)
            return;
          const n = $(el).next();
          n.find("a").each(function(_2, a) {
            if (/download/i.test($(a).text()))
              links.push($(a).attr("href"));
          });
        });
      } else {
        const slug = episodeSlug(ctx.season, ctx.episode);
        $("div.entry-content p").each(function(_, el) {
          const t = $(el).text() || "";
          if (!new RegExp("S0?" + ctx.season + "|Season 0?" + ctx.season, "i").test(t))
            return;
          const n = $(el).next();
          n.find("a").each(function(_2, a) {
            if (new RegExp("Episode " + ctx.episode, "i").test($(a).text()))
              links.push($(a).attr("href"));
          });
        });
      }
      const finals = [];
      for (const l of links.slice(0, 8)) {
        if (!l)
          continue;
        if (/driveleech|driveseed/i.test(l)) {
          try {
            const t = yield fetchText(l, {}, 15e3);
            const m = t.match(/window\.location\.replace\(["'](.*?)["']\)/);
            finals.push(m ? getBaseUrl(l) + m[1] : l);
          } catch (e) {
            continue;
          }
        } else {
          const b = yield bypassHrefli(l);
          if (b)
            finals.push(b);
        }
      }
      return yield resolveMany("UHDMovies", finals);
    } catch (e) {
      console.log("[Streamline][uhdmovies] " + e.message);
      return [];
    }
  });
}
function scrapeMoviesmod(ctx) {
  return __async(this, null, function* () {
    if (!enabled12("moviesmod"))
      return [];
    const base = yield dynUrl("moviesmod");
    if (!base || !ctx.imdbId)
      return [];
    try {
      const q = ctx.isTv ? ctx.imdbId + " " + ctx.season : ctx.imdbId;
      const searchHtml = yield fetchText(base + "/search/" + encodeURIComponent(q), {}, 2e4);
      let $ = import_cheerio_without_node_native3.default.load(searchHtml);
      const href = $("#content_box article > a").attr("href");
      if (!href)
        return [];
      const pageHtml = yield fetchText(fixUrl(href, base), {}, 2e4);
      $ = import_cheerio_without_node_native3.default.load(pageHtml);
      const sTag = !ctx.isTv ? "" : "(S0?" + ctx.season + "|Season " + ctx.season + ")";
      const heads = [];
      $("div.thecontent h4, div.thecontent h3").each(function(_, el) {
        const t = $(el).text() || "";
        if (sTag && !new RegExp(sTag, "i").test(t))
          return;
        if (!/(480p|720p|1080p|2160p)/i.test(t))
          return;
        if (/MoviesMod/i.test(t))
          return;
        heads.push(el);
      });
      const finals = [];
      for (const h of heads.slice(0, 6)) {
        const sib = $(h).next();
        const aTag = !ctx.isTv ? "Download" : "Episode";
        let link = null;
        sib.find("a").each(function(_, a) {
          if (new RegExp(aTag, "i").test($(a).text())) {
            const raw = $(a).attr("href") || "";
            link = raw.indexOf("=") !== -1 ? raw.split("=").pop() : raw;
            return false;
          }
        });
        if (!link)
          continue;
        try {
          let target = link;
          if (ctx.isTv) {
            const sub = yield fetchText(link, {}, 15e3);
            const $s = import_cheerio_without_node_native3.default.load(sub);
            let found = null;
            $s("p a.maxbutton, h3 a").each(function(_, a) {
              if (new RegExp("Episode " + ctx.episode, "i").test($s(a).text())) {
                found = $s(a).attr("href");
                return false;
              }
            });
            if (!found)
              continue;
            target = found;
          }
          const b = yield bypassHrefli(target);
          if (b)
            finals.push(b);
        } catch (e) {
          continue;
        }
      }
      return yield resolveMany("Moviesmod", finals);
    } catch (e) {
      console.log("[Streamline][moviesmod] " + e.message);
      return [];
    }
  });
}
function scrapeMoviesdrive(ctx) {
  return __async(this, null, function* () {
    if (!enabled12("moviesdrive"))
      return [];
    const base = yield dynUrl("moviesdrive");
    if (!base || !ctx.imdbId)
      return [];
    try {
      const searchJson = JSON.parse(
        yield fetchText(base + "/search.php?q=" + encodeURIComponent(ctx.imdbId), {}, 2e4)
      );
      const hits = searchJson && searchJson.hits || [];
      let permalink = null;
      for (const h of hits) {
        const doc = h.document || h;
        if ((doc.imdb_id || doc.imdbId) === ctx.imdbId) {
          permalink = doc.permalink;
          break;
        }
      }
      if (!permalink)
        return [];
      const pageHtml = yield fetchText(fixUrl(permalink, base), {}, 2e4);
      let $ = import_cheerio_without_node_native3.default.load(pageHtml);
      const hubLinks = [];
      if (!ctx.isTv) {
        $("h5 > a").each(function(_, el) {
          hubLinks.push($(el).attr("href"));
        });
        const out2 = [];
        for (const h of hubLinks.slice(0, 4)) {
          try {
            const sub = yield fetchText(fixUrl(h, base), {}, 15e3);
            out2.push.apply(out2, extractMdriveLinks(sub));
          } catch (e) {
            continue;
          }
        }
        return yield resolveMany("MoviesDrive", out2);
      }
      const slug = episodeSlug(ctx.season, ctx.episode);
      let seasonHref = null;
      $("h5").each(function(_, el) {
        const t = $(el).text() || "";
        if (new RegExp("Season " + ctx.season + "|S" + slug.s, "i").test(t)) {
          seasonHref = $(el).next().find("a").attr("href") || $(el).parent().find("a").attr("href");
          return false;
        }
      });
      if (!seasonHref)
        return [];
      const seasonHtml = yield fetchText(fixUrl(seasonHref, base), {}, 2e4);
      $ = import_cheerio_without_node_native3.default.load(seasonHtml);
      const out = [];
      $("h5").each(function(_, el) {
        const t = $(el).text() || "";
        if (new RegExp("Ep" + slug.e + "|Ep" + ctx.episode, "i").test(t)) {
          $(el).next().find("a").each(function(_2, a) {
            out.push($(a).attr("href"));
          });
          $(el).next().next().find("a").each(function(_2, a) {
            out.push($(a).attr("href"));
          });
        }
      });
      const hubOnly = [];
      for (const h of out) {
        if (!h)
          continue;
        if (/hubcloud|gdflix|gdlink/i.test(h))
          hubOnly.push(h);
        else {
          try {
            const sub = yield fetchText(fixUrl(h, base), {}, 15e3);
            hubOnly.push.apply(hubOnly, extractMdriveLinks(sub));
          } catch (e) {
            continue;
          }
        }
      }
      return yield resolveMany("MoviesDrive", hubOnly);
    } catch (e) {
      console.log("[Streamline][moviesdrive] " + e.message);
      return [];
    }
  });
}
function scrapeVegaLike(apiKey, source, ctx) {
  return __async(this, null, function* () {
    const base = yield dynUrl(apiKey);
    if (!base || !ctx.imdbId)
      return [];
    try {
      const searchJson = JSON.parse(
        yield fetchText(base + "/search.php?q=" + encodeURIComponent(ctx.imdbId) + "&page=1", {}, 2e4)
      );
      const hits = searchJson && searchJson.hits || [];
      let permalink = null;
      for (const h of hits) {
        const doc = h.document || h;
        if ((doc.imdb_id || doc.imdbId) === ctx.imdbId) {
          permalink = doc.permalink;
          break;
        }
      }
      if (!permalink)
        return [];
      const pageUrl = fixUrl(permalink, base);
      const pageHtml = yield fetchText(pageUrl, {}, 2e4);
      let $ = import_cheerio_without_node_native3.default.load(pageHtml);
      const imdbHref = $('a[href*="imdb"]').attr("href") || "";
      if (imdbHref && imdbHref.indexOf(ctx.imdbId) === -1)
        return [];
      const links = [];
      if (!ctx.isTv) {
        const btns = $("button.dwd-button").toArray();
        for (const b of btns.slice(0, 6)) {
          const href = $(b).parent().attr("href") || $(b).closest("a").attr("href");
          if (!href)
            continue;
          try {
            const sub = yield fetchText(fixUrl(href, base), {}, 15e3);
            const $s = import_cheerio_without_node_native3.default.load(sub);
            $s("p > a").each(function(_, a) {
              links.push($s(a).attr("href"));
            });
          } catch (e) {
            continue;
          }
        }
      } else {
        $("h4, h3").each(function(_, el) {
          const t = $(el).text() || "";
          if (!new RegExp("Season " + ctx.season, "i").test(t))
            return;
          $(el).next().find("a").each(function(_2, a) {
            if (/V-Cloud|Single|Episode|G-Direct/i.test($(a).text()))
              links.push($(a).attr("href"));
          });
        });
        const epLinks = [];
        for (const l of links.slice(0, 4)) {
          try {
            const sub = yield fetchText(fixUrl(l, base), {}, 15e3);
            const $s = import_cheerio_without_node_native3.default.load(sub);
            $s("h4").each(function(_, el) {
              if (!new RegExp("Episode.*?" + ctx.episode, "i").test($s(el).text()))
                return;
              const v = $s(el).next().find("a").filter(function(_2, a) {
                return /V-Cloud/i.test($s(a).text());
              }).attr("href");
              if (v)
                epLinks.push(v);
            });
          } catch (e) {
            continue;
          }
        }
        return yield resolveMany(source, epLinks);
      }
      return yield resolveMany(source, links);
    } catch (e) {
      console.log("[Streamline][" + source + "] " + e.message);
      return [];
    }
  });
}
function scrapeVegamovies(ctx) {
  return __async(this, null, function* () {
    if (!enabled12("vegamovies"))
      return [];
    if (ctx.isBollywood)
      return [];
    return yield scrapeVegaLike("vegamovies", "VegaMovies", ctx);
  });
}
function scrapeRogmovies(ctx) {
  return __async(this, null, function* () {
    if (!enabled12("rogmovies"))
      return [];
    if (!ctx.isBollywood)
      return [];
    return yield scrapeVegaLike("rogmovies", "RogMovies", ctx);
  });
}
function scrapeBollyflix(ctx) {
  return __async(this, null, function* () {
    if (!enabled12("bollyflix"))
      return [];
    const base = yield dynUrl("bollyflix");
    if (!base || !ctx.imdbId)
      return [];
    try {
      const searchHtml = yield fetchText(base + "/search/" + encodeURIComponent(ctx.imdbId), {}, 2e4);
      let $ = import_cheerio_without_node_native3.default.load(searchHtml);
      const articles = $("div > article > a").toArray().slice(0, 4);
      const out = [];
      for (const art of articles) {
        try {
          const pageHtml = yield fetchText(fixUrl($(art).attr("href"), base), {}, 2e4);
          const $p = import_cheerio_without_node_native3.default.load(pageHtml);
          const hTag = !ctx.isTv ? "h5" : "h4";
          const sTag = !ctx.isTv ? "" : "Season " + ctx.season;
          $p("div.thecontent.clearfix > " + hTag).each(function(_, el) {
            const t = $p(el).text() || "";
            if (sTag && !new RegExp(sTag, "i").test(t))
              return;
            if (!/(480p|720p|1080p|2160p)/i.test(t))
              return;
            if (/download/i.test(t))
              return;
            $p(el).next().find("a").each(function(_2, a) {
              const h = $p(a).attr("href");
              if (h)
                out.push(h);
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
            const side = yield fetchText("https://web.sidexfee.com/?id=" + token, {}, 15e3);
            const m = side.match(/link\\?":\\?"([^"]+)/) || side.match(/link":"([^"]+)/);
            if (m)
              h = b64DecodeUtf8(m[1]);
          }
          if (!ctx.isTv) {
            finals.push(h);
          } else {
            const epText = "Episode " + String(ctx.episode).padStart(2, "0");
            const sub = yield fetchText(h, {}, 15e3);
            const $s = import_cheerio_without_node_native3.default.load(sub);
            let found = null;
            $s("article h3 a").each(function(_, a) {
              if ($s(a).text().indexOf(epText) !== -1) {
                found = $s(a).attr("href");
                return false;
              }
            });
            if (found)
              finals.push(found);
          }
        } catch (e) {
          continue;
        }
      }
      return yield resolveMany("Bollyflix", finals);
    } catch (e) {
      console.log("[Streamline][bollyflix] " + e.message);
      return [];
    }
  });
}

// src/streamline/index.js
function settings3() {
  try {
    return globalThis.SCRAPER_SETTINGS || {};
  } catch (e) {
    return {};
  }
}
function dedupe(streams) {
  const seen = {};
  const out = [];
  streams.forEach(function(s) {
    if (!s || !s.url)
      return;
    const key = s.url;
    if (seen[key])
      return;
    seen[key] = true;
    out.push(s);
  });
  return out;
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const isTv = mediaType === "tv";
    const seasonNum = season != null ? season : 1;
    const episodeNum = episode != null ? episode : 1;
    console.log(
      "[Streamline] getStreams tmdb=" + tmdbId + " type=" + mediaType + (isTv ? " s=" + seasonNum + " e=" + episodeNum : "")
    );
    const meta = yield fetchTmdbMeta(String(tmdbId), mediaType);
    const countries = meta.countries || [];
    const isBollywood = countries.some(function(c) {
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
      isTv,
      isBollywood
    };
    const cfg2 = settings3();
    const concurrency = Math.max(2, Math.min(10, cfg2.concurrency || 6));
    const tasks = [
      function() {
        return withTimeout(scrape(ctx), 25e3, "vidlink");
      },
      function() {
        return withTimeout(scrape2(ctx), 3e4, "videasy");
      },
      function() {
        return withTimeout(scrape3(ctx), 25e3, "hexa");
      },
      function() {
        return withTimeout(scrape4(ctx), 25e3, "vidzee");
      },
      function() {
        return withTimeout(scrape5(ctx), 25e3, "vidrock");
      },
      function() {
        return withTimeout(scrapeVidfast(ctx), 3e4, "vidfast");
      },
      function() {
        return withTimeout(scrapeVidcore(ctx), 3e4, "vidcore");
      },
      function() {
        return withTimeout(scrapeVaplayer(ctx), 2e4, "vaplayer");
      },
      function() {
        return withTimeout(scrapePrimesrc(ctx), 2e4, "primesrc");
      },
      function() {
        return withTimeout(scrape6(ctx), 3e4, "showbox");
      },
      function() {
        return withTimeout(scrape7(ctx), 3e4, "moviebox");
      },
      function() {
        return withTimeout(scrape8(ctx), 25e3, "allmovieland");
      },
      function() {
        return withTimeout(scrape9(ctx), 3e4, "cinejoy");
      },
      function() {
        return withTimeout(scrape4khdhub(ctx), 3e4, "4khdhub");
      },
      function() {
        return withTimeout(scrapeUhdmovies(ctx), 3e4, "uhdmovies");
      },
      function() {
        return withTimeout(scrapeMoviesmod(ctx), 3e4, "moviesmod");
      },
      function() {
        return withTimeout(scrapeMoviesdrive(ctx), 3e4, "moviesdrive");
      },
      function() {
        return withTimeout(scrapeVegamovies(ctx), 3e4, "vegamovies");
      },
      function() {
        return withTimeout(scrapeRogmovies(ctx), 3e4, "rogmovies");
      },
      function() {
        return withTimeout(scrapeBollyflix(ctx), 3e4, "bollyflix");
      },
      function() {
        return withTimeout(scrapeAnizone(ctx), 25e3, "anizone");
      },
      function() {
        return withTimeout(torrentSources(ctx.imdbId, seasonNum, episodeNum, isTv), 25e3, "torrents");
      }
    ];
    let streams = dedupe(yield runLimited(tasks, concurrency));
    try {
      const subs = (yield stremioSubtitles(ctx.imdbId, seasonNum, episodeNum, isTv)).concat(
        yield wyzieSubtitles(ctx.imdbId, seasonNum, episodeNum, isTv)
      );
      streams = attachSubtitles(streams, subs);
    } catch (e) {
      console.log("[Streamline][subs] " + e.message);
    }
    console.log("[Streamline] returning " + streams.length + " streams for " + (meta.title || tmdbId));
    return streams;
  });
}
function onSettings() {
  return __async(this, null, function* () {
    function toggle(key, label, defaultValue) {
      return { type: "toggle", key, label, defaultValue: defaultValue !== false };
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
      { type: "header", label: "Torrents (P2P \u2014 resolved by Nuvio debrid)" },
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
          { label: "6 (default)", value: 6 },
          { label: "8", value: 8 },
          { label: "10 (fast networks)", value: 10 }
        ],
        defaultValue: 6
      }
    ];
  });
}
module.exports = { getStreams, onSettings };
