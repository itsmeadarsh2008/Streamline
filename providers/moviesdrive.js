/**
 * moviesdrive - Built from src/moviesdrive/ (run bun build.js to regenerate)
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
  const s = String(raw).toLowerCase().replace(/4khdhub|uhdmovies|vegamovies|moviesmod|moviesdrive|bollyflix|hubcloud|vcloud|pixeldrain|gofile/g, " ");
  const m = s.match(/(\d{3,4})\s*p/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 4e3)
      return "8K";
    if (n >= 1e3)
      return "1080p";
    if (n >= 700)
      return "720p";
    if (n >= 400)
      return "480p";
    if (n > 0)
      return "360p";
  }
  if (/\b8k\b/.test(s))
    return "8K";
  if (/2160|4k|uhd/.test(s))
    return "4K";
  if (/org/.test(s))
    return "4K";
  if (/cam|ts|telesync|telecine|hdcam/.test(s))
    return "CAM";
  if (/hd/.test(s))
    return "720p";
  return "Auto";
}
function makeStream(source, title, url, quality, headers, subtitles, extra) {
  if (!url)
    return null;
  const u = String(url);
  if (u.indexOf("http") !== 0 && u.indexOf("magnet:?") !== 0)
    return null;
  const stream = {
    name: source,
    title: title || source,
    url: u,
    quality: quality || parseQuality(title),
    headers: headers || {},
    subtitles: subtitles || []
  };
  if (extra) {
    Object.keys(extra).forEach(function(k) {
      if (extra[k] !== void 0 && extra[k] !== null && extra[k] !== "")
        stream[k] = extra[k];
    });
  }
  return stream;
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

// src/_shared/meta.js
function qualityEmoji(quality) {
  const q = String(quality || "");
  if (/4K|2160/i.test(q))
    return "\u{1F525}";
  if (/1080/i.test(q))
    return "\u{1F48E}";
  if (/720/i.test(q))
    return "\u26A1";
  if (/480/i.test(q))
    return "\u{1F4F1}";
  if (/CAM|TS|TC/i.test(q))
    return "\u{1F3A5}";
  return "\u{1F3AC}";
}
function qualityRank(quality) {
  const q = String(quality || "").toLowerCase();
  if (/8k|4320/.test(q))
    return 5;
  if (/4k|2160/.test(q))
    return 4;
  if (/1080|fhd/.test(q))
    return 3;
  if (/720|hd/.test(q))
    return 2;
  if (/480|sd/.test(q))
    return 1;
  return 0;
}
function firstMatch(text, re) {
  const m = String(text || "").match(re);
  return m ? m[0] : null;
}
var SITE_TAGS = /4khdhub|uhdmovies|vegamovies|moviesmod|moviesdrive|bollyflix|rogmovies|topmovies|hubcloud|vcloud|hubdrive|pixeldrain|gofile|driveleech|driveseed|fastdlserver|linksmod|moviemod|hdhub4u|movies4u|dudefilms|mlsbd|multimovies|skymovies|rtally|toonstream/gi;
function parseMeta(raw) {
  const cleaned = String(raw || "").replace(SITE_TAGS, " ");
  const noUrl = cleaned.replace(/https?:\/\/\S+/g, " ");
  const text = cleaned;
  const meta = {
    quality: "Auto",
    rank: 0,
    size: "",
    sizeMB: 0,
    hdr: "",
    codec: "",
    dv: false,
    audio: "",
    atmos: false,
    lang: "",
    source: "",
    container: ""
  };
  const qm = text.match(/(\d{3,4})\s*p/i);
  if (qm) {
    const n = parseInt(qm[1], 10);
    meta.quality = n >= 2e3 ? n >= 4e3 ? "8K" : "4K" : n >= 1e3 ? "1080p" : n >= 700 ? "720p" : n >= 400 ? "480p" : "360p";
    if (n >= 8e3)
      meta.quality = "8K";
  } else if (/\b8k\b/i.test(text))
    meta.quality = "8K";
  else if (/2160|4k|uhd/i.test(text))
    meta.quality = "4K";
  else if (/cam|hdcam|telesync|telecine|\bts\b|\btc\b|scr|dvdscr/i.test(text))
    meta.quality = "CAM";
  else if (/\bhd\b/i.test(text))
    meta.quality = "720p";
  meta.rank = qualityRank(meta.quality);
  let sm = noUrl.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i) || text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  if (sm) {
    meta.size = parseFloat(sm[1]).toFixed(sm[2].toUpperCase() === "GB" && sm[1].indexOf(".") === -1 ? 0 : 2).replace(/\.00$/, "") + " " + sm[2].toUpperCase();
    meta.sizeMB = Math.round(parseFloat(sm[1]) * (sm[2].toUpperCase() === "GB" ? 1024 : 1));
  }
  if (/\bdolby[\s-]*vision\b|dovi/i.test(text) || /[.\-_]dv[.\-_]/i.test(text)) {
    meta.dv = true;
    meta.hdr = "DV";
  } else if (/hdr10\+/i.test(text))
    meta.hdr = "HDR10+";
  else if (/hdr10/i.test(text))
    meta.hdr = "HDR10";
  else if (/\bhlg\b/i.test(text))
    meta.hdr = "HLG";
  else if (/\bhdr\b/i.test(text))
    meta.hdr = "HDR";
  else if (/\bsdr\b/i.test(text))
    meta.hdr = "SDR";
  if (/\bav1\b/i.test(text))
    meta.codec = "AV1";
  else if (/\b(h\.?265|x265|hevc)\b/i.test(text))
    meta.codec = "H.265";
  else if (/\b(h\.?264|x264|avc)\b/i.test(text))
    meta.codec = "H.264";
  else if (/\bvp9\b/i.test(text))
    meta.codec = "VP9";
  else if (/\bxvid\b/i.test(text))
    meta.codec = "XviD";
  else if (/\bdivx\b/i.test(text))
    meta.codec = "DivX";
  if (/truehd[\s.]*7\.1|truehd.*atmos/i.test(text))
    meta.audio = "TrueHD 7.1";
  else if (/atmos/i.test(text))
    meta.atmos = true;
  if (!meta.audio) {
    if (/\bddp[\s.]*5\.1\b|eac3|dd\+[\s.]*5\.1/i.test(text))
      meta.audio = "DDP5.1";
    else if (/\bdd5\.1\b|ac3[\s.]*5\.1|dolby[\s.]*digital[\s.]*5\.1/i.test(text))
      meta.audio = "DD5.1";
    else if (/\bac3\b|dolby[\s.]*digital/i.test(text))
      meta.audio = "DD";
    else if (/dts[\s-]*hd[\s.]*ma|dts[\s.]*x/i.test(text))
      meta.audio = "DTS-HD MA";
    else if (/\bdts\b/i.test(text))
      meta.audio = "DTS";
    else if (/\b7\.1\b/i.test(text))
      meta.audio = "7.1";
    else if (/\b5\.1\b/i.test(text))
      meta.audio = "5.1";
    else if (/\baac\b/i.test(text))
      meta.audio = "AAC";
    else if (/\bopus\b/i.test(text))
      meta.audio = "Opus";
    else if (/\bmp3\b/i.test(text))
      meta.audio = "MP3";
  }
  if (/atmos/i.test(text))
    meta.atmos = true;
  const langs = [];
  function has() {
    for (let i = 0; i < arguments.length; i++) {
      if (new RegExp("\\b" + arguments[i] + "\\b", "i").test(text))
        return true;
    }
    return false;
  }
  if (/multi[\s._-]*audio/i.test(text))
    langs.push("Multi-Audio");
  else if (/dual[\s._-]*audio|dual/i.test(text) && /hindi|hin/i.test(text))
    langs.push("Dual-Audio");
  else if (/dual[\s._-]*audio/i.test(text))
    langs.push("Dual-Audio");
  if (has("hindi", "hin"))
    langs.push("Hindi");
  if (has("tamil"))
    langs.push("Tamil");
  if (has("telugu"))
    langs.push("Telugu");
  if (has("malayalam"))
    langs.push("Malayalam");
  if (has("kannada"))
    langs.push("Kannada");
  if (has("bengali"))
    langs.push("Bengali");
  if (has("punjabi"))
    langs.push("Punjabi");
  if (has("korean", "kor"))
    langs.push("Korean");
  if (has("japanese", "jpn"))
    langs.push("Japanese");
  if (has("chinese", "chn"))
    langs.push("Chinese");
  if (has("spanish"))
    langs.push("Spanish");
  if (has("french"))
    langs.push("French");
  if (has("german"))
    langs.push("German");
  if (has("italian"))
    langs.push("Italian");
  if (has("russian"))
    langs.push("Russian");
  if (has("arabic"))
    langs.push("Arabic");
  if (has("english", "eng") && !langs.length)
    langs.push("English");
  if (/esub/i.test(text))
    langs.push("ESub");
  meta.lang = langs.slice(0, 3).join(" + ");
  if (/remux/i.test(text))
    meta.source = "REMUX";
  else if (/bluray|blu[\s._-]*ray|brrip|bdrip/i.test(text))
    meta.source = "BluRay";
  else if (/web[\s._-]*dl/i.test(text))
    meta.source = "WEB-DL";
  else if (/webrip|web[\s._-]*rip/i.test(text))
    meta.source = "WEBRip";
  else if (/hdrip/i.test(text))
    meta.source = "HDRip";
  else if (/hdtv/i.test(text))
    meta.source = "HDTV";
  else if (/pdtv|sdtv|tvrip/i.test(text))
    meta.source = "TVRip";
  else if (/dvdrip|dvdscr/i.test(text))
    meta.source = "DVDRip";
  else if (/\bdvd\b/i.test(text))
    meta.source = "DVD";
  else if (/cam|hdcam|telesync|telecine|\bts\b|\btc\b|\bscr\b/i.test(text))
    meta.source = "CAM";
  if (/\.m3u8/i.test(text) || firstMatch(text, /hls/i))
    meta.container = "HLS";
  else if (/\.mpd/i.test(text) || /\bdash\b/i.test(text))
    meta.container = "DASH";
  else if (/\.mp4/i.test(text))
    meta.container = "MP4";
  else if (/\.mkv/i.test(text))
    meta.container = "MKV";
  return meta;
}
function headline(title, year, seasonEp) {
  const t = String(title || "Unknown").trim();
  if (seasonEp)
    return "\u{1F3AC} " + t + " - (" + seasonEp + ")";
  if (year)
    return "\u{1F3AC} " + t + " (" + year + ")";
  return "\u{1F3AC} " + t;
}
function seasonEpCode(season, episode) {
  if (season == null || episode == null)
    return "";
  return "S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0");
}
function richTitle(provider, line1, meta, container) {
  const lines = [line1];
  const l2 = qualityEmoji(meta.quality) + " " + meta.quality + (meta.size ? " \u2022 " + meta.size : "") + " | \u{1F4FC} " + (container || meta.container || "VIDEO");
  lines.push(l2);
  const l3parts = [];
  if (meta.hdr)
    l3parts.push("\u{1F308} " + meta.hdr);
  if (meta.codec)
    l3parts.push("\u{1F39E} " + meta.codec);
  if (meta.dv && meta.hdr !== "DV")
    l3parts.push("\u{1F441}\uFE0F DV");
  if (l3parts.length)
    lines.push(l3parts.join(" \u2022 "));
  const l4parts = [];
  if (meta.lang)
    l4parts.push("\u{1F30D} " + meta.lang);
  if (meta.audio || meta.atmos) {
    l4parts.push("\u{1F3A7} " + (meta.audio || "Audio") + (meta.atmos ? " +Atmos" : ""));
  }
  if (l4parts.length)
    lines.push(l4parts.join(" | "));
  if (meta.source)
    lines.push("\u{1F4BF} " + meta.source);
  return { text: lines.join("\n"), providerTag: provider + " | " + meta.quality };
}
function richName(provider, meta) {
  const bits = [meta.quality];
  if (meta.audio)
    bits.push(meta.audio + (meta.atmos ? "+Atmos" : ""));
  else if (meta.lang)
    bits.push(meta.lang);
  return provider + " | " + bits.join(" \u2022 ");
}
function enrichStream(stream, raw, line1) {
  if (!stream || stream._rich)
    return stream;
  const meta = parseMeta((raw || "") + " " + (stream.url || ""));
  const rt = richTitle(stream.name, line1 || stream.title, meta);
  const copy = Object.assign({}, stream);
  copy.name = richName(stream.name, meta);
  copy.title = rt.text;
  copy.quality = meta.quality === "Auto" ? stream.quality || "Auto" : meta.quality;
  if (meta.size)
    copy.size = meta.size;
  if (meta.lang && !copy.language)
    copy.language = meta.lang.split(" + ")[0];
  copy._rank = meta.rank;
  copy._sizeMB = meta.sizeMB;
  copy._rich = true;
  return copy;
}
function presentStreams(streams, ctx) {
  const line1 = ctx && (ctx.title || ctx.originalTitle) ? headline(
    ctx.originalTitle || ctx.title,
    ctx.isTv ? null : ctx.year,
    ctx.isTv ? seasonEpCode(ctx.season, ctx.episode) : ""
  ) : null;
  const enriched = (streams || []).map(function(s) {
    if (!s || s._rich)
      return s;
    return enrichStream(s, (s.title || "") + " " + (s.quality || ""), line1 || s.title);
  });
  enriched.sort(function(a, b) {
    const r = (b._rank || 0) - (a._rank || 0);
    if (r !== 0)
      return r;
    return (b._sizeMB || 0) - (a._sizeMB || 0);
  });
  return enriched.map(function(s) {
    if (!s)
      return s;
    const copy = Object.assign({}, s);
    delete copy._rank;
    delete copy._sizeMB;
    delete copy._rich;
    return copy;
  });
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
function extractMdriveLinks(html) {
  const $ = import_cheerio_without_node_native.default.load(html);
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
      let push = function(u, server) {
        const container = /\.m3u8/i.test(u) ? "HLS" : /\.mp4/i.test(u) ? "MP4" : /\.mkv/i.test(u) ? "MKV" : "VIDEO";
        const meta = parseMeta(header + " " + size + " " + u);
        if (!meta.container)
          meta.container = container;
        const rt = richTitle(name, "\u{1F3AC} " + header + (size ? " [" + size + "]" : ""), meta, container);
        const title = server ? rt.text + "\n\u{1F5A5}\uFE0F " + server : rt.text;
        const s = makeStream(
          server ? richName(name + " [" + server + "]", meta) : richName(name, meta),
          title,
          u,
          meta.quality === "Auto" ? parseQuality(header) : meta.quality,
          { "User-Agent": UA, Referer: link },
          [],
          { size: meta.size, language: meta.lang ? meta.lang.split(" + ")[0] : void 0 }
        );
        if (s) {
          s._rank = meta.rank;
          s._sizeMB = meta.sizeMB;
          s._rich = true;
          out.push(s);
        }
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
      function probeOk(u) {
        return __async(this, null, function* () {
          try {
            const res = yield fetch(u, {
              redirect: "follow",
              headers: { "User-Agent": UA, Referer: link, Range: "bytes=0-0" }
            });
            if (res.status === 206 || res.status === 200) {
              try {
                yield res.text();
              } catch (e) {
              }
              return true;
            }
          } catch (e) {
          }
          return false;
        });
      }
      function resolveFinal(u) {
        return __async(this, null, function* () {
          try {
            const r = yield fetch(u, {
              redirect: "follow",
              headers: { "User-Agent": UA, Referer: link, Range: "bytes=0-0" }
            });
            let finalUrl = r.url || u;
            if (finalUrl.indexOf("link=") !== -1)
              finalUrl = finalUrl.split("link=")[1];
            return finalUrl || u;
          } catch (e) {
            return u;
          }
        });
      }
      const btns = $2("h2 a.btn").toArray();
      const cands = [];
      for (const el of btns) {
        const href = $2(el).attr("href") || "";
        const text = $2(el).text() || "";
        if (!href)
          continue;
        if (/FSL Server|FSLv2|Mega Server|Download File/.test(text)) {
          cands.push({
            href,
            server: /FSLv2/.test(text) ? "FSLv2" : /Mega/.test(text) ? "Mega" : /Download File/.test(text) ? "Download" : "FSL"
          });
        } else if (href.indexOf("pixeldra") !== -1) {
          const pxl = extractPxlUrl(page2);
          if (pxl) {
            const b = getBaseUrl(pxl);
            cands.push({
              href: /download/i.test(pxl) ? pxl : b + "/api/file/" + pxl.split("/").pop() + "?download",
              server: "Pixeldrain",
              direct: true
            });
          }
        } else if (/Server : 10Gbps/.test(text)) {
          cands.push({ href, server: "10Gbps" });
        } else if (/Buzz Server/.test(text)) {
          try {
            const bHtml = yield fetchText(href, {}, 15e3);
            const $b = import_cheerio_without_node_native.default.load(bHtml);
            const dl = $b(".download-btn").attr("href");
            if (dl)
              cands.push({ href: getBaseUrl(href) + dl, server: "Buzz", direct: true });
          } catch (e) {
          }
        } else if (/Gofile/i.test(text)) {
          const g = yield resolveGofile(href);
          if (g && g.url)
            cands.push({ href: g.url, server: "Gofile", direct: true });
        }
      }
      const probed = yield Promise.all(cands.map(function(c) {
        return __async(this, null, function* () {
          try {
            const url2 = c.direct ? c.href : yield resolveFinal(c.href);
            return { server: c.server, url: url2, ok: yield probeOk(url2) };
          } catch (e) {
            return { server: c.server, url: "", ok: false };
          }
        });
      }));
      probed.forEach(function(p) {
        if (p.ok && p.url)
          push(p.url, p.server);
      });
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
      if (!g || !g.url)
        return [];
      const s = makeStream(source, source + " [Gofile] " + g.name, g.url, parseQuality(g.name), {}, []);
      return s ? [enrichStream(s, g.name + " " + g.url, null)] : [];
    }
    if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(u)) {
      const s = makeStream(source, source + " - " + parseQuality(u), u, parseQuality(u), { "User-Agent": UA }, []);
      return s ? [enrichStream(s, u, null)] : [];
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
function firstAnchorAfter(html, marker) {
  const src = String(html || "");
  const idx = marker ? src.indexOf(marker) : 0;
  if (idx === -1)
    return null;
  const m = src.substring(idx, idx + 8e3).match(/<a[^>]+href="([^"]+)"/i);
  return m ? m[1] : null;
}
function scrapeMoviesdrive(ctx) {
  return __async(this, null, function* () {
    if (!enabled("moviesdrive"))
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
      let $ = import_cheerio_without_node_native2.default.load(pageHtml);
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
          seasonHref = $(el).next().find("a").attr("href") || firstAnchorAfter(pageHtml, t.slice(0, 60));
          return false;
        }
      });
      if (!seasonHref)
        return [];
      const seasonHtml = yield fetchText(fixUrl(seasonHref, base), {}, 2e4);
      $ = import_cheerio_without_node_native2.default.load(seasonHtml);
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

// src/moviesdrive/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const ctx = yield buildCtx(tmdbId, mediaType, season, episode);
      const out = yield withTimeout(scrapeMoviesdrive(ctx), 2e4, "moviesdrive");
      return presentStreams(dedupe(yield withSharedSubs(out, ctx)), ctx);
    } catch (e) {
      console.log("[Streamline][moviesdrive] " + (e && e.message));
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
