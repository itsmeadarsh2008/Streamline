/**
 * Rich stream metadata. Produces All-in-One-style 5-line titles carrying
 * the full release data — quality, size, HDR, codec, Dolby Vision, audio
 * (incl. Atmos), language and source — parsed from release filenames and
 * host headers. Taxonomy mirrors CineStream `SPEC_OPTIONS`.
 *
 * Line layout (segments shown only when detected, never invented):
 *   🎬 Title (Year) | 🎬 Title - (S01E01)
 *   🔥 4K • 64.89 GB | 📼 MKV
 *   🌈 DV • 🎞 H.265 • 👁️ DV
 *   🌍 Dual-Audio | 🎧 DDP5.1 +Atmos
 *   💿 BluRay
 */

export function qualityEmoji(quality) {
    const q = String(quality || "");
    if (/4K|2160/i.test(q)) return "🔥";
    if (/1080/i.test(q)) return "💎";
    if (/720/i.test(q)) return "⚡";
    if (/480/i.test(q)) return "📱";
    if (/CAM|TS|TC/i.test(q)) return "🎥";
    return "🎬";
}

export function qualityRank(quality) {
    const q = String(quality || "").toLowerCase();
    if (/8k|4320/.test(q)) return 5;
    if (/4k|2160/.test(q)) return 4;
    if (/1080|fhd/.test(q)) return 3;
    if (/720|hd/.test(q)) return 2;
    if (/480|sd/.test(q)) return 1;
    return 0;
}

function firstMatch(text, re) {
    const m = String(text || "").match(re);
    return m ? m[0] : null;
}

/** Parse every displayable facet out of a release blob (filename/header). */
export function parseMeta(raw) {
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

    // ── quality ──
    const qm = text.match(/(\d{3,4})\s*p/i);
    if (/\b8k\b/i.test(text)) meta.quality = "8K";
    else if (/2160|4k|uhd/i.test(text)) meta.quality = "4K";
    else if (qm) {
        const n = parseInt(qm[1], 10);
        meta.quality = n >= 2000 ? "4K" : n >= 1000 ? "1080p" : n >= 700 ? "720p" : n >= 400 ? "480p" : "360p";
    } else if (/cam|hdcam|telesync|telecine|\bts\b|\btc\b|scr|dvdscr/i.test(text)) meta.quality = "CAM";
    else if (/\bhd\b/i.test(text)) meta.quality = "720p";
    meta.rank = qualityRank(meta.quality);

    // ── size ──
    const sm = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
    if (sm) {
        meta.size = parseFloat(sm[1]).toFixed(sm[2].toUpperCase() === "GB" && sm[1].indexOf(".") === -1 ? 0 : 2).replace(/\.00$/, "") + " " + sm[2].toUpperCase();
        meta.sizeMB = Math.round(parseFloat(sm[1]) * (sm[2].toUpperCase() === "GB" ? 1024 : 1));
    }

    // ── HDR / Dolby Vision ──
    if (/\bdolby[\s-]*vision\b|dovi/i.test(text) || /[.\-_]dv[.\-_]/i.test(text)) { meta.dv = true; meta.hdr = "DV"; }
    else if (/hdr10\+/i.test(text)) meta.hdr = "HDR10+";
    else if (/hdr10/i.test(text)) meta.hdr = "HDR10";
    else if (/\bhlg\b/i.test(text)) meta.hdr = "HLG";
    else if (/\bhdr\b/i.test(text)) meta.hdr = "HDR";
    else if (/\bsdr\b/i.test(text)) meta.hdr = "SDR";

    // ── codec ──
    if (/\bav1\b/i.test(text)) meta.codec = "AV1";
    else if (/\b(h\.?265|x265|hevc)\b/i.test(text)) meta.codec = "H.265";
    else if (/\b(h\.?264|x264|avc)\b/i.test(text)) meta.codec = "H.264";
    else if (/\bvp9\b/i.test(text)) meta.codec = "VP9";
    else if (/\bxvid\b/i.test(text)) meta.codec = "XviD";
    else if (/\bdivx\b/i.test(text)) meta.codec = "DivX";

    // ── audio ──
    if (/truehd[\s.]*7\.1|truehd.*atmos/i.test(text)) meta.audio = "TrueHD 7.1";
    else if (/atmos/i.test(text)) meta.atmos = true;
    if (!meta.audio) {
        if (/\bddp[\s.]*5\.1\b|eac3|dd\+[\s.]*5\.1/i.test(text)) meta.audio = "DDP5.1";
        else if (/\bdd5\.1\b|ac3[\s.]*5\.1|dolby[\s.]*digital[\s.]*5\.1/i.test(text)) meta.audio = "DD5.1";
        else if (/\bac3\b|dolby[\s.]*digital/i.test(text)) meta.audio = "DD";
        else if (/dts[\s-]*hd[\s.]*ma|dts[\s.]*x/i.test(text)) meta.audio = "DTS-HD MA";
        else if (/\bdts\b/i.test(text)) meta.audio = "DTS";
        else if (/\b7\.1\b/i.test(text)) meta.audio = "7.1";
        else if (/\b5\.1\b/i.test(text)) meta.audio = "5.1";
        else if (/\baac\b/i.test(text)) meta.audio = "AAC";
        else if (/\bopus\b/i.test(text)) meta.audio = "Opus";
        else if (/\bmp3\b/i.test(text)) meta.audio = "MP3";
    }
    if (/atmos/i.test(text)) meta.atmos = true;

    // ── language ──
    const langs = [];
    function has() {
        for (let i = 0; i < arguments.length; i++) {
            if (new RegExp("\\b" + arguments[i] + "\\b", "i").test(text)) return true;
        }
        return false;
    }
    if (/multi[\s._-]*audio/i.test(text)) langs.push("Multi-Audio");
    else if (/dual[\s._-]*audio|dual/i.test(text) && /hindi|hin/i.test(text)) langs.push("Dual-Audio");
    else if (/dual[\s._-]*audio/i.test(text)) langs.push("Dual-Audio");
    if (has("hindi", "hin")) langs.push("Hindi");
    if (has("tamil")) langs.push("Tamil");
    if (has("telugu")) langs.push("Telugu");
    if (has("malayalam")) langs.push("Malayalam");
    if (has("kannada")) langs.push("Kannada");
    if (has("bengali")) langs.push("Bengali");
    if (has("punjabi")) langs.push("Punjabi");
    if (has("korean", "kor")) langs.push("Korean");
    if (has("japanese", "jpn")) langs.push("Japanese");
    if (has("chinese", "chn")) langs.push("Chinese");
    if (has("spanish")) langs.push("Spanish");
    if (has("french")) langs.push("French");
    if (has("german")) langs.push("German");
    if (has("italian")) langs.push("Italian");
    if (has("russian")) langs.push("Russian");
    if (has("arabic")) langs.push("Arabic");
    if (has("english", "eng") && !langs.length) langs.push("English");
    if (/esub/i.test(text)) langs.push("ESub");
    meta.lang = langs.slice(0, 3).join(" + ");

    // ── source ──
    if (/remux/i.test(text)) meta.source = "REMUX";
    else if (/bluray|blu[\s._-]*ray|brrip|bdrip/i.test(text)) meta.source = "BluRay";
    else if (/web[\s._-]*dl/i.test(text)) meta.source = "WEB-DL";
    else if (/webrip|web[\s._-]*rip/i.test(text)) meta.source = "WEBRip";
    else if (/hdrip/i.test(text)) meta.source = "HDRip";
    else if (/hdtv/i.test(text)) meta.source = "HDTV";
    else if (/pdtv|sdtv|tvrip/i.test(text)) meta.source = "TVRip";
    else if (/dvdrip|dvdscr/i.test(text)) meta.source = "DVDRip";
    else if (/\bdvd\b/i.test(text)) meta.source = "DVD";
    else if (/cam|hdcam|telesync|telecine|\bts\b|\btc\b|\bscr\b/i.test(text)) meta.source = "CAM";

    // ── container ──
    if (/\.m3u8/i.test(text) || firstMatch(text, /hls/i)) meta.container = "HLS";
    else if (/\.mpd/i.test(text) || /\bdash\b/i.test(text)) meta.container = "DASH";
    else if (/\.mp4/i.test(text)) meta.container = "MP4";
    else if (/\.mkv/i.test(text)) meta.container = "MKV";

    return meta;
}

/** Headline: 🎬 Title (Year) or 🎬 Title - (S01E01). */
export function headline(title, year, seasonEp) {
    const t = String(title || "Unknown").trim();
    if (seasonEp) return "🎬 " + t + " - (" + seasonEp + ")";
    if (year) return "🎬 " + t + " (" + year + ")";
    return "🎬 " + t;
}

export function seasonEpCode(season, episode) {
    if (season == null || episode == null) return "";
    return "S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0");
}

/** Full 5-line rich title. `container` overrides meta.container when known. */
export function richTitle(provider, line1, meta, container) {
    const lines = [line1];
    const l2 = qualityEmoji(meta.quality) + " " + meta.quality +
        (meta.size ? " \u2022 " + meta.size : "") +
        " | \ud83d\udcfc " + (container || meta.container || "VIDEO");
    lines.push(l2);
    const l3parts = [];
    if (meta.hdr) l3parts.push("\ud83c\udf08 " + meta.hdr);
    if (meta.codec) l3parts.push("\ud83c\udf9e " + meta.codec);
    if (meta.dv && meta.hdr !== "DV") l3parts.push("\ud83d\udc41\ufe0f DV");
    if (l3parts.length) lines.push(l3parts.join(" \u2022 "));
    const l4parts = [];
    if (meta.lang) l4parts.push("\ud83c\udf0d " + meta.lang);
    if (meta.audio || meta.atmos) {
        l4parts.push("\ud83c\udfa7 " + (meta.audio || "Audio") + (meta.atmos ? " +Atmos" : ""));
    }
    if (l4parts.length) lines.push(l4parts.join(" | "));
    if (meta.source) lines.push("\ud83d\udcbf " + meta.source);
    return { text: lines.join("\n"), providerTag: provider + " | " + meta.quality };
}

/** Compact provider badge: `Vidlink | 1080p • DDP5.1`. */
export function richName(provider, meta) {
    const bits = [meta.quality];
    if (meta.audio) bits.push(meta.audio + (meta.atmos ? "+Atmos" : ""));
    else if (meta.lang) bits.push(meta.lang);
    return provider + " | " + bits.join(" \u2022 ");
}

/**
 * Enrich one stream in place-copy: parse `raw` blob, rewrite title into
 * the rich block, fill quality/size/language (+seeders/infoHash passthrough).
 * Streams already marked _rich are returned untouched.
 */
export function enrichStream(stream, raw, line1) {
    if (!stream || stream._rich) return stream;
    const meta = parseMeta((raw || "") + " " + (stream.url || ""));
    const rt = richTitle(stream.name, line1 || stream.title, meta);
    const copy = Object.assign({}, stream);
    copy.name = richName(stream.name, meta);
    copy.title = rt.text;
    copy.quality = meta.quality === "Auto" ? stream.quality || "Auto" : meta.quality;
    if (meta.size) copy.size = meta.size;
    if (meta.lang && !copy.language) copy.language = meta.lang.split(" + ")[0];
    copy._rank = meta.rank;
    copy._sizeMB = meta.sizeMB;
    copy._rich = true;
    return copy;
}

/**
 * Final presentation pass for a provider result list: enrich bare streams
 * (hub/torrent paths already enrich themselves), then sort best-first by
 * quality rank and size — then strip the private sort keys.
 */
export function presentStreams(streams, ctx) {
    const line1 = ctx && (ctx.title || ctx.originalTitle)
        ? headline(ctx.originalTitle || ctx.title, ctx.isTv ? null : ctx.year,
            ctx.isTv ? seasonEpCode(ctx.season, ctx.episode) : "")
        : null;
    const enriched = (streams || []).map(function (s) {
        if (!s || s._rich) return s;
        return enrichStream(s, (s.title || "") + " " + (s.quality || ""), line1 || s.title);
    });
    enriched.sort(function (a, b) {
        const r = (b._rank || 0) - (a._rank || 0);
        if (r !== 0) return r;
        return (b._sizeMB || 0) - (a._sizeMB || 0);
    });
    return enriched.map(function (s) {
        if (!s) return s;
        const copy = Object.assign({}, s);
        delete copy._rank;
        delete copy._sizeMB;
        delete copy._rich;
        return copy;
    });
}
