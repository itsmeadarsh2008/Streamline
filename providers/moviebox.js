/**
 * moviebox - Built from src/moviebox/ (run bun build.js to regenerate)
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
var MOVIEBOX_BASE = "https://h5-api.aoneroom.com";
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

// src/_shared/sources/moviebox.js
function enabled() {
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
function scrape(ctx) {
  return __async(this, null, function* () {
    if (!enabled())
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

// src/moviebox/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      return dedupe(yield withTimeout(scrape(ctx), 2e4, "moviebox"));
    } catch (e) {
      console.log("[Streamline][moviebox] " + (e && e.message));
      return [];
    }
  });
}
module.exports = { getStreams };
