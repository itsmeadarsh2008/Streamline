/**
 * cinejoy - Built from src/cinejoy/ (run bun build.js to regenerate)
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
var CINEJOY_API = "https://api.shegu.st";
var CINEJOY_BASE = "https://cinejoy.to";
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

// src/_shared/sources/cinejoy.js
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
function enabled() {
  try {
    const s = globalThis.SCRAPER_SETTINGS || {};
    return s.cinejoy !== false;
  } catch (e) {
    return true;
  }
}
function scrape(ctx) {
  return __async(this, null, function* () {
    if (!enabled())
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
          let binBody = "";
          for (let i = 0; i < bodyBytes.length; i++)
            binBody += String.fromCharCode(bodyBytes[i] & 255);
          const gRes = yield fetch(CINEJOY_API + "/g", {
            method: "POST",
            headers: Object.assign({}, headers, { "Content-Type": "application/octet-stream" }),
            body: binBody
          });
          const gText = yield gRes.text();
          const gBuf = [];
          for (let i = 0; i < gText.length; i++)
            gBuf.push(gText.charCodeAt(i) & 255);
          const payload = b64urlEncodeNoPad(gBuf);
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

// src/cinejoy/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      const out = yield withTimeout(scrape(ctx), 2e4, "cinejoy");
      return dedupe(yield withSharedSubs(out, ctx));
    } catch (e) {
      console.log("[Streamline][cinejoy] " + (e && e.message));
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
