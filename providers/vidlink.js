/**
 * vidlink - Built from src/vidlink/ (run bun build.js to regenerate)
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
var VIDLINK_API = "https://vidlink.pro";
var MULTI_DECRYPT_API = "https://enc-dec.app/api";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var UA_MOBILE = "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";

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

// src/_shared/sources/vidlink.js
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

// src/vidlink/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      return dedupe(yield withTimeout(scrape(ctx), 2e4, "vidlink"));
    } catch (e) {
      console.log("[Streamline][vidlink] " + (e && e.message));
      return [];
    }
  });
}
module.exports = { getStreams };
