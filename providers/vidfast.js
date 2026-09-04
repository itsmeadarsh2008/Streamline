/**
 * vidfast - Built from src/vidfast/ (run bun build.js to regenerate)
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
var MULTI_DECRYPT_API = "https://enc-dec.app/api";
var VIDFAST_API = "https://vidfast.vc";
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

// src/_shared/sources/vidfast.js
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
    if (!enabled("vidfast"))
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

// src/vidfast/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      return dedupe(yield withTimeout(scrapeVidfast(ctx), 2e4, "vidfast"));
    } catch (e) {
      console.log("[Streamline][vidfast] " + (e && e.message));
      return [];
    }
  });
}
module.exports = { getStreams };
