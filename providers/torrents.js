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
function parseMeta(raw) {
  const text = String(raw || "");
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
  if (/\b8k\b/i.test(text))
    meta.quality = "8K";
  else if (/2160|4k|uhd/i.test(text))
    meta.quality = "4K";
  else if (qm) {
    const n = parseInt(qm[1], 10);
    meta.quality = n >= 2e3 ? "4K" : n >= 1e3 ? "1080p" : n >= 700 ? "720p" : n >= 400 ? "480p" : "360p";
  } else if (/cam|hdcam|telesync|telecine|\bts\b|\btc\b|scr|dvdscr/i.test(text))
    meta.quality = "CAM";
  else if (/\bhd\b/i.test(text))
    meta.quality = "720p";
  meta.rank = qualityRank(meta.quality);
  const sm = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
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
function stremioTorrents(sourceName, api, ctx) {
  return __async(this, null, function* () {
    const imdbId = ctx.imdbId, season = ctx.season, episode = ctx.episode, isTv = ctx.isTv;
    const path = !isTv ? "/stream/movie/" + imdbId + ".json" : "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json";
    const json = JSON.parse(yield fetchText(api + path, {}, 2e4));
    const streams = json && json.streams || [];
    const line1 = ctx.title || ctx.originalTitle ? headline(
      ctx.originalTitle || ctx.title,
      isTv ? null : ctx.year,
      isTv ? seasonEpCode(season, episode) : ""
    ) : null;
    const out = [];
    streams.forEach(function(s) {
      if (!s || !s.infoHash)
        return;
      const label = s.title || s.description || s.name || "";
      const seedM = String(label).match(/[👤👥]\s*(\d+)/);
      const seeders = seedM ? parseInt(seedM[1], 10) : 0;
      if (seeders && seeders < 20)
        return;
      const meta = parseMeta(label + " " + (s.name || ""));
      const rt = richTitle(sourceName, line1 || "\u{1F3AC} " + label.split("\n")[0].slice(0, 80), meta, "MKV");
      const stream = makeStream(
        sourceName + " \u{1F465}" + seeders + " \u2B06\uFE0F" + meta.quality,
        rt.text,
        buildMagnet(s.infoHash, s.fileIdx, s.sources),
        meta.quality === "Auto" ? "Auto" : meta.quality,
        {},
        [],
        {
          size: meta.size || void 0,
          language: meta.lang ? meta.lang.split(" + ")[0] : void 0,
          seeders: seeders || void 0,
          infoHash: s.infoHash
        }
      );
      if (stream) {
        stream._rank = meta.rank;
        stream._sizeMB = meta.sizeMB;
        stream._rich = true;
        out.push(stream);
      }
    });
    return out;
  });
}
function torrentSources(imdbId, season, episode, isTv, ctx) {
  return __async(this, null, function* () {
    if (!imdbId)
      return [];
    const full = ctx || { imdbId, season, episode, isTv };
    const cfg = settings();
    if (cfg.enableTorrents === false)
      return [];
    const jobs = [];
    if (cfg.torrentio !== false) {
      jobs.push(
        function() {
          return __async(this, null, function* () {
            try {
              return yield stremioTorrents("Torrentio", TORRENTIO_API, full);
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
              return yield stremioTorrents("TorrentsDB", TORRENTSDB_API, full);
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
        torrentSources(ctx.imdbId, ctx.season, ctx.episode, ctx.isTv, ctx),
        2e4,
        "torrents"
      );
      return presentStreams(dedupe(out), ctx);
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
