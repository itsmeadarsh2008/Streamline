/**
 * torrents - Built from src/torrents/ (run bun build.js to regenerate)
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
var TORRENTIO_API = "https://torrentio.strem.fun/limit=4";
var TORRENTSDB_API = "https://torrentsdb.com/eyJsaW1pdCI6IjMiLCJkZWJyaWRvcHRpb25zIjpbIm5vZG93bmxvYWRsaW5rcyJdfQ==";
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

// src/_shared/torrents.js
function settings() {
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
    const cfg = settings();
    if (cfg.enableTorrents === false)
      return [];
    const jobs = [];
    if (cfg.torrentio !== false) {
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
    if (cfg.torrentsdb !== false) {
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

// src/torrents/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      const out = yield withTimeout(
        torrentSources(ctx.imdbId, ctx.season, ctx.episode, ctx.isTv),
        2e4,
        "torrents"
      );
      return dedupe(out);
    } catch (e) {
      console.log("[Streamline][torrents] " + (e && e.message));
      return [];
    }
  });
}
function onSettings() {
  return __async(this, null, function* () {
    return [
      { type: "header", label: "P2P backends (resolved by Nuvio debrid)" },
      { type: "toggle", key: "enableTorrents", label: "Enable torrent sources", defaultValue: true },
      { type: "toggle", key: "torrentio", label: "Torrentio", defaultValue: true },
      { type: "toggle", key: "torrentsdb", label: "TorrentsDB", defaultValue: true }
    ];
  });
}
module.exports = { getStreams, onSettings };
