/**
 * videasy - Built from src/videasy/ (run bun build.js to regenerate)
 */
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
var VIDEASY_API = "https://api.speedracelight.com";
var MULTI_DECRYPT_API = "https://enc-dec.app/api";
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

// src/_shared/sources/videasy.js
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
function enabled() {
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
function scrape(ctx) {
  return __async(this, null, function* () {
    if (!enabled())
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

// src/videasy/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      return dedupe(yield withTimeout(scrape(ctx), 2e4, "videasy"));
    } catch (e) {
      console.log("[Streamline][videasy] " + (e && e.message));
      return [];
    }
  });
}
module.exports = { getStreams };
