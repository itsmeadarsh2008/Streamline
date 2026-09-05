/**
 * Streamline constants — port of CineStream `ApiConstants.kt`.
 *
 * Static endpoints live here. Hosts that rotate frequently (Indian mirrors)
 * are resolved at runtime from the same dynamic `urls.json` CineStream uses.
 */

// ── TMDB (meta resolution: Nuvio only passes a TMDB id) ──────────────
// Public community key, same one used across open Nuvio provider projects.
export const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// ── Static source APIs (CineStream ApiConstants.kt) ──────────────────
export const SHOWBOX_API = "https://showbox.media";
export const FEBBOX_API = "https://www.febbox.com";
export const HEXA_API = "https://theemoviedb.hexa.su";
export const VIDEASY_API = "https://api.speedracelight.com";
export const VIDLINK_API = "https://vidlink.pro";
export const MULTI_DECRYPT_API = "https://enc-dec.app/api";
export const VIDZEE_API = "https://player.vidzee.wtf";
export const VIDZEE_SECRET_B64 = "QTdrUDl4TTJRdjhMcjROejFIdTZZYzNCdzVKZjBEc1U=";
export const VIDROCK_API = "https://vidrock.ru";
export const VIDROCK_KEY_HEX = "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f";
export const PRIMESRC_API = "https://primesrc.me";
export const VIDFAST_API = "https://vidfast.vc";
export const VIDCORE_API = "https://vidcore.io";
export const VAPLAYER_API = "https://streamdata.vaplayer.ru";
export const CINEJOY_API = "https://api.shegu.st";
export const CINEJOY_BASE = "https://cinejoy.to";
export const ALLMOVIELAND_API = "https://allmovieland.one";
export const MOVIEBOX_HOST = "h5-api.aoneroom.com";
export const MOVIEBOX_BASE = "https://h5-api.aoneroom.com";
export const WYZIE_API = "https://sub.wyzie.io";

// Stremio-compatible torrent + subtitle backends (CineStream Stremio helpers)
export const TORRENTIO_API = "https://torrentio.strem.fun/limit=4";
export const TORRENTSDB_API = "https://torrentsdb.com/eyJsaW1pdCI6IjMiLCJkZWJyaWRvcHRpb25zIjpbIm5vZG93bmxvYWRsaW5rcyJdfQ==";
// (Moved to subs.js with full route config — bare bases 404.)
export const STREMIO_SUBS = [];

// ── Dynamic API config (CineStream `init()` from urls.json) ──────────
const URLS_JSON = "https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json";

let _dynamicCache = null;
let _dynamicAt = 0;

export async function getDynamicUrls() {
    const now = Date.now();
    if (_dynamicCache && now - _dynamicAt < 30 * 60 * 1000) return _dynamicCache;
    try {
        const res = await fetch(URLS_JSON, {
            headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
        });
        if (res.ok) {
            const json = await res.json();
            _dynamicCache = json || {};
            _dynamicAt = now;
            return _dynamicCache;
        }
    } catch (e) {
        console.log("[Streamline] dynamic urls.json failed: " + (e && e.message));
    }
    return _dynamicCache || {};
}

export async function dynUrl(key) {
    const cfg = await getDynamicUrls();
    return (cfg && cfg[key]) || "";
}

export const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const UA_MOBILE =
    "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";
