/**
 * Streamline test harness (multi-provider).
 *  - Always runs: manifest checks, per-provider surface checks,
 *    Hermes-safety of every bundle, crypto round-trips, and a
 *    Nuvio-runtime simulation (Nuvio wrapper, shimmed require, NO timers)
 *    for every provider.
 *  - LIVE=1: live spot-checks against real sources (needs internet).
 *    Used by the weekly health workflow — asserts aggregate results > 0.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const CryptoJS = require('crypto-js');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'));

let passed = 0;
function ok(name, cond) {
    assert(cond, "FAILED: " + name);
    passed++;
    console.log("  ✓ " + name);
}

function loadBuilt(id) {
    const file = path.join(__dirname, 'providers', id + '.js');
    delete require.cache[require.resolve(file)];
    return require(file);
}

async function offline() {
    console.log("Manifest + provider surface:");
    ok("repo named Streamline", manifest.name === "Streamline");
    ok("22 scrapers", manifest.scrapers.length === 22);
    const ids = manifest.scrapers.map(function (s) { return s.id; });
    ok("ids unique", new Set(ids).size === ids.length);

    for (const s of manifest.scrapers) {
        const m = loadBuilt(s.id);
        ok(s.id + " exports getStreams", typeof m.getStreams === "function");
        if (s.hasSettings) {
            ok(s.id + " exports onSettings", typeof m.onSettings === "function");
            const layout = await m.onSettings();
            ok(s.id + " settings non-empty", Array.isArray(layout) && layout.length > 0);
        }
        const code = fs.readFileSync(path.join(__dirname, s.filename), 'utf-8');
        if (/[^_a-zA-Z]await\s/.test(code)) throw new Error("FAILED: " + s.id + " has raw await");
    }
    console.log("  ✓ all bundles Hermes-safe (no raw await)");

    // Vidzee AES-CBC round-trip (mirrors CineStream decryptVidzeeUrl params)
    const secret = Buffer.from("QTdrUDl4TTJRdjhMcjROejFIdTZZYzNCdzVKZjBEc1U=", 'base64').toString('utf-8');
    const key = CryptoJS.enc.Utf8.parse((secret + "\0".repeat(32)).substring(0, 32));
    const iv = CryptoJS.lib.WordArray.random(16);
    const plain = "https://example.com/stream.m3u8";
    const ct = CryptoJS.AES.encrypt(plain, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    const outer = Buffer.from(
        iv.toString(CryptoJS.enc.Base64) + ":" + ct.ciphertext.toString(CryptoJS.enc.Base64)
    ).toString('base64');
    const outerDec = Buffer.from(outer, 'base64').toString('utf-8');
    const idx = outerDec.indexOf(":");
    const dec = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(outerDec.substring(idx + 1)) },
        key,
        { iv: CryptoJS.enc.Base64.parse(outerDec.substring(0, idx)), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    ).toString(CryptoJS.enc.Utf8);
    ok("vidzee AES-CBC round-trip", dec === plain);

    // Rich metadata parsing (All-in-One-style title blocks)
    const metaCases = [
        {
            raw: "Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.DV.HDR.HEVC.TrueHD.Atmos.7.1.Hindi.DDP5.1.x265-FraMeSToR [64.89 GB]",
            quality: "4K", hdr: "DV", codec: "H.265", atmos: true, source: "REMUX",
            size: "64.89 GB", langHas: "Hindi"
        },
        {
            raw: "Dune.Part.Two.2024.720p.10bit.AMZN.WEBRip.x265.HEVC.Org.Hindi.DDP.5.1.192Kbps.+.English.AAC.5.1.ESubs [1.21 GB]",
            quality: "720p", codec: "H.265", audio: "DDP5.1", source: "WEBRip", size: "1.21 GB", langHas: "Hindi"
        },
        {
            raw: "Breaking.Bad.S01E01.1080p.BluRay.x264.DD5.1.HIN-ENG [1.52 GB]",
            quality: "1080p", codec: "H.264", audio: "DD5.1", source: "BluRay", size: "1.52 GB"
        },
        {
            // Release-group tag must not promote the quality…
            raw: "Spider-Man.Into.the.Spider-Verse.2018.1080p.WEB-DL.Hindi.DD5.1.x264-FGT-4kHdHub.mkv [1.41 GB]",
            quality: "1080p", audio: "DD5.1", source: "WEB-DL", size: "1.41 GB"
        },
        {
            // …nor may a bare UHD token override an explicit number
            raw: "Show.S01E01.720p.HDTV.x264-UHDMovies [800 MB] https://cdn.example.workers.dev/abc123def",
            quality: "720p", source: "HDTV", size: "800 MB"
        }
    ];
    const metaMod = await import('./src/_shared/meta.js').catch(function () { return null; });
    if (metaMod) {
        metaCases.forEach(function (c, i) {
            const m = metaMod.parseMeta(c.raw);
            ok("meta[" + i + "] quality " + c.quality, m.quality === c.quality);
            if (c.hdr) ok("meta[" + i + "] hdr " + c.hdr, m.hdr === c.hdr);
            if (c.codec) ok("meta[" + i + "] codec " + c.codec, m.codec === c.codec);
            if (c.atmos) ok("meta[" + i + "] atmos", m.atmos === true);
            if (c.audio) ok("meta[" + i + "] audio " + c.audio, m.audio === c.audio);
            if (c.source) ok("meta[" + i + "] source " + c.source, m.source === c.source);
            if (c.size) ok("meta[" + i + "] size " + c.size, m.size === c.size);
            if (c.langHas) ok("meta[" + i + "] lang has " + c.langHas, m.lang.indexOf(c.langHas) !== -1);
        });
        const rt = metaMod.richTitle("VegaMovies", "🎬 Dune: Part Two (2024)", metaMod.parseMeta(metaCases[0].raw), "MKV");
        ok("rich title has 5 lines", rt.text.split("\n").length === 5);
        ok("rich title mentions Atmos", rt.text.indexOf("Atmos") !== -1);
    }

    console.log("\n✅ offline checks passed");
}

async function nuvioRuntimeSim() {
    console.log("\nNuvio runtime simulation (no timers, shimmed require):");
    for (const s of manifest.scrapers) {
        const code = fs.readFileSync(path.join(__dirname, s.filename), 'utf-8');
        const sandbox = {
            console: console,
            Promise: Promise, JSON: JSON, Object: Object, Array: Array,
            String: String, Number: Number, Boolean: Boolean, Math: Math, Date: Date,
            RegExp: RegExp, Error: Error, TypeError: TypeError, RangeError: RangeError,
            encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
            encodeURI: encodeURI, decodeURI: decodeURI,
            escape: escape, unescape: unescape,
            isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat,
            Uint8Array: Uint8Array, ArrayBuffer: ArrayBuffer,
            TextEncoder: TextEncoder, TextDecoder: TextDecoder,
            URL: URL,
            fetch: async function () { throw new Error("no network in sim"); },
            require: function (name) {
                if (name === "crypto-js") return CryptoJS;
                if (name.indexOf("cheerio") !== -1) {
                    return { load: function () { throw new Error("no dom in sim"); } };
                }
                throw new Error("Module '" + name + "' is not available");
            }
        };
        sandbox.globalThis = sandbox;
        sandbox.global = sandbox;
        sandbox.window = sandbox;
        sandbox.self = sandbox;
        vm.createContext(sandbox);
        vm.runInContext("globalThis.SCRAPER_SETTINGS = {};", sandbox);
        vm.runInContext("var module = { exports: {} }; var exports = module.exports;", sandbox);
        vm.runInContext(code, sandbox);
        const streams = await vm.runInContext('module.exports.getStreams("603", "movie")', sandbox);
        if (!Array.isArray(streams)) throw new Error("FAILED: sim " + s.id + " did not resolve array");
        if (s.hasSettings) {
            const layout = await vm.runInContext(
                "(async function(){ return await module.exports.onSettings(); })()",
                sandbox
            );
            if (!Array.isArray(layout) || !layout.length) throw new Error("FAILED: sim settings " + s.id);
        }
        passed++;
        console.log("  ✓ sim " + s.id);
    }
}

async function live() {
    console.log("\nLive spot-checks:");
    const checks = [
        ["vidlink", "693134", "movie", null, null],
        ["videasy", "693134", "movie", null, null],
        ["hexa", "1396", "tv", 1, 1],
        ["torrents", "693134", "movie", null, null]
    ];
    let total = 0;
    for (const c of checks) {
        const m = loadBuilt(c[0]);
        const r = await m.getStreams(c[1], c[2], c[3], c[4]);
        total += r.length;
        console.log(" - " + c[0] + ": " + r.length + " streams");
        r.slice(0, 3).forEach(function (s) {
            console.log("    [" + s.name + "] " + String(s.title).slice(0, 60));
        });
    }
    ok("live aggregate results > 0", total > 0);
}

(async function () {
    try {
        await offline();
        await nuvioRuntimeSim();
        if (process.env.LIVE === "1") await live();
        console.log("\n✅ " + passed + " tests passed");
    } catch (e) {
        console.error("\n❌ " + e.message);
        process.exit(1);
    }
})();
