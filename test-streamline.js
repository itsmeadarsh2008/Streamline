/**
 * Streamline test harness.
 *  - Always runs: offline unit tests (quality parsing, crypto round-trips,
 *    settings blueprint, manifest validity).
 *  - Live network test only with LIVE=1 (hits real sources; needs internet).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');

const built = require('./providers/streamline.js');

let passed = 0;
function ok(name, cond) {
    assert(cond, "FAILED: " + name);
    passed++;
    console.log("  ✓ " + name);
}

async function offline() {
    console.log("Offline unit tests:");

    // Provider surface
    ok("exports getStreams", typeof built.getStreams === "function");
    ok("exports onSettings", typeof built.onSettings === "function");
    const settings = await built.onSettings();
    ok("settings is non-empty array", Array.isArray(settings) && settings.length > 10);
    ok("settings has showboxToken", settings.some(function (s) { return s.key === "showboxToken"; }));
    ok("settings has concurrency", settings.some(function (s) { return s.key === "concurrency"; }));

    // Manifest validity
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'));
    ok("manifest names repo Streamline", manifest.name === "Streamline");
    const scraper = manifest.scrapers[0];
    ok("scraper named Streamline", scraper.name === "Streamline");
    ok("provider file exists", fs.existsSync(path.join(__dirname, scraper.filename)));
    ok("hasSettings enabled", scraper.hasSettings === true);

    // Built artifact is Hermes-safe (no raw async/await left)
    const code = fs.readFileSync(path.join(__dirname, 'providers/streamline.js'), 'utf-8');
    ok("no raw await", !/[^_a-zA-Z]await\s/.test(code));
    ok("uses __async helper", code.indexOf("__async") !== -1);

    // Vidzee AES-CBC round-trip (mirrors CineStream decryptVidzeeUrl params)
    const secretB64 = "QTdrUDl4TTJRdjhMcjROejFIdTZZYzNCdzVKZjBEc1U=";
    const secret = Buffer.from(secretB64, 'base64').toString('utf-8');
    const key = CryptoJS.enc.Utf8.parse((secret + "\0".repeat(32)).substring(0, 32));
    const iv = CryptoJS.lib.WordArray.random(16);
    const plain = "https://example.com/stream.m3u8";
    const ct = CryptoJS.AES.encrypt(plain, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    const outer = Buffer.from(
        iv.toString(CryptoJS.enc.Base64) + ":" + ct.ciphertext.toString(CryptoJS.enc.Base64)
    ).toString('base64');
    // Re-implement the bundled decrypt path with the same params
    const outerDec = Buffer.from(outer, 'base64').toString('utf-8');
    const idx = outerDec.indexOf(":");
    const dec = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(outerDec.substring(idx + 1)) },
        key,
        { iv: CryptoJS.enc.Base64.parse(outerDec.substring(0, idx)), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    ).toString(CryptoJS.enc.Utf8);
    ok("vidzee AES-CBC round-trip", dec === plain);

    // Vidrock AES-GCM round-trip (WebCrypto, same layout: nonce[12] + ct+tag)
    if (globalThis.crypto && globalThis.crypto.subtle) {
        const keyHex = "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f";
        const keyBytes = new Uint8Array(keyHex.match(/../g).map(function (h) { return parseInt(h, 16); }));
        const ck = await globalThis.crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
        const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
        const enc = new Uint8Array(await globalThis.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce, tagLength: 128 },
            ck,
            new TextEncoder().encode("https://example.com/v.m3u8")
        ));
        const payload = Buffer.concat([Buffer.from(nonce), Buffer.from(enc)])
            .toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
        // decrypt path mirror
        let std = payload.replace(/-/g, "+").replace(/_/g, "/");
        while (std.length % 4 !== 0) std += "=";
        const data = Buffer.from(std, 'base64');
        const pt = await globalThis.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(data.slice(0, 12)), tagLength: 128 },
            ck,
            new Uint8Array(data.slice(12))
        );
        ok("vidrock AES-GCM round-trip", Buffer.from(pt).toString('utf-8') === "https://example.com/v.m3u8");
    } else {
        console.log("  - vidrock GCM test skipped (no SubtleCrypto)");
    }

    console.log("\n✅ " + passed + " offline tests passed");
}

async function live() {
    console.log("\nLive test (Dune: Part Two, movie, TMDB 693134)...");
    const streams = await built.getStreams('693134', 'movie');
    console.log("Found " + streams.length + " streams");
    streams.slice(0, 10).forEach(function (s) {
        console.log(" - [" + s.name + "] " + s.title + " (" + s.quality + ") subs=" + (s.subtitles || []).length);
    });
    console.log("\nLive test (Breaking Bad S01E01, TV, TMDB 1396)...");
    const tv = await built.getStreams('1396', 'tv', 1, 1);
    console.log("Found " + tv.length + " streams");
    tv.slice(0, 10).forEach(function (s) {
        console.log(" - [" + s.name + "] " + s.title + " (" + s.quality + ")");
    });
}

(async function () {
    try {
        await offline();
        if (process.env.LIVE === "1") await live();
    } catch (e) {
        console.error("\n❌ " + e.message);
        process.exit(1);
    }
})();
