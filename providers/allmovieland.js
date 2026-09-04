/**
 * allmovieland - Built from src/allmovieland/ (run bun build.js to regenerate)
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
var ALLMOVIELAND_API = "https://allmovieland.one";
var WYZIE_API = "https://sub.wyzie.io";
var STREMIO_SUBS = [
  "https://opensubtitles.stremio.homes",
  "https://subsense.nepiraw.com/n0tcjfba-"
];
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

// src/_shared/sources/allmovieland.js
function enabled() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.allmovieland !== false;
  } catch (e) {
    return true;
  }
}
function scrape(ctx) {
  return __async(this, null, function* () {
    if (!enabled())
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

// src/allmovieland/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      const out = yield withTimeout(scrape(ctx), 2e4, "allmovieland");
      return dedupe(yield withSharedSubs(out, ctx));
    } catch (e) {
      console.log("[Streamline][allmovieland] " + (e && e.message));
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
