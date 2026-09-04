/**
 * vidzee - Built from src/vidzee/ (run bun build.js to regenerate)
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
var VIDZEE_API = "https://player.vidzee.wtf";
var VIDZEE_SECRET_B64 = "QTdrUDl4TTJRdjhMcjROejFIdTZZYzNCdzVKZjBEc1U=";
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

// src/_shared/sources/vidzee.js
var import_crypto_js = __toESM(require("crypto-js"));
var SERVERS = [0, 1, 2, 4, 5, 6, 7];
function enabled() {
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
function scrape(ctx) {
  return __async(this, null, function* () {
    if (!enabled())
      return [];
    if (!ctx.tmdbId)
      return [];
    const isTv = ctx.isTv;
    const jobs = SERVERS.map(function(sr) {
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

// src/vidzee/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      return dedupe(yield withTimeout(scrape(ctx), 2e4, "vidzee"));
    } catch (e) {
      console.log("[Streamline][vidzee] " + (e && e.message));
      return [];
    }
  });
}
module.exports = { getStreams };
