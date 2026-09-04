#!/usr/bin/env node

/**
 * Streamline build script.
 *
 * Bundles each provider from src/<provider>/ into a single Hermes/QuickJS-safe
 * file at providers/<provider>.js
 *
 * Usage:
 *   node build.js                    # Build all providers
 *   node build.js streamline         # Build only streamline
 *   node build.js --transpile        # Transpile single-file providers in-place
 *   node build.js --transpile foo.js # Transpile one file in-place
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const outDir = path.join(__dirname, 'providers');

// Modules provided by the Nuvio runtime — never bundle these.
const EXTERNAL_MODULES = [
    'cheerio-without-node-native',
    'react-native-cheerio',
    'cheerio',
    'crypto-js',
    'axios'
];

function getProvidersToBuild() {
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
    if (args.length > 0) return args;
    if (!fs.existsSync(srcDir)) {
        console.error('❌ src/ directory not found. Create provider folders in src/<provider>/');
        process.exit(1);
    }
    return fs.readdirSync(srcDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name[0] !== '_') // _shared is a library, not a provider
        .map(d => d.name);
}

async function buildProvider(providerName) {
    const providerDir = path.join(srcDir, providerName);
    const entryPoint = path.join(providerDir, 'index.js');
    const outFile = path.join(outDir, `${providerName}.js`);

    if (!fs.existsSync(entryPoint)) {
        console.warn(`⚠️  Skipping ${providerName}: no src/${providerName}/index.js found`);
        return false;
    }

    try {
        await esbuild.build({
            entryPoints: [entryPoint],
            bundle: true,
            outfile: outFile,
            format: 'cjs',
            platform: 'neutral',
            target: 'es2016', // transpile async/await -> generators for Hermes/QuickJS
            minify: false,
            sourcemap: false,
            external: EXTERNAL_MODULES,
            banner: {
                // No timestamps: builds must be byte-identical for the CI sync check.
                js: `/**\n * ${providerName} - Built from src/${providerName}/ (run bun build.js to regenerate)\n */`
            },
            logLevel: 'warning'
        });
        const stats = fs.statSync(outFile);
        console.log(`✅ ${providerName}.js (${(stats.size / 1024).toFixed(1)} KB)`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to build ${providerName}:`, err.message);
        return false;
    }
}

async function transpileSingleFile(filename) {
    const inputPath = path.join(outDir, filename);
    if (!fs.existsSync(inputPath)) {
        console.warn(`⚠️  File not found: providers/${filename}`);
        return false;
    }
    const originalContent = fs.readFileSync(inputPath, 'utf-8');
    if (!originalContent.includes('async ') && !originalContent.includes('await ')) {
        console.log(`⏭️  ${filename} - no async/await, skipping`);
        return true;
    }
    try {
        const result = await esbuild.transform(originalContent, {
            loader: 'js',
            target: 'es2016',
            format: 'cjs'
        });
        fs.writeFileSync(inputPath, result.code);
        const stats = fs.statSync(inputPath);
        console.log(`✅ ${filename} transpiled (${(stats.size / 1024).toFixed(1)} KB)`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to transpile ${filename}:`, err.message);
        return false;
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--transpile')) {
        const files = args.filter(a => a !== '--transpile' && !a.startsWith('-'));
        if (files.length === 0) {
            const srcProviders = fs.existsSync(srcDir)
                ? fs.readdirSync(srcDir, { withFileTypes: true })
                    .filter(d => d.isDirectory())
                    .map(d => d.name + '.js')
                : [];
            const allProviderFiles = fs.readdirSync(outDir)
                .filter(f => f.endsWith('.js') && !srcProviders.includes(f));
            console.log(`\n🔄 Transpiling ${allProviderFiles.length} single-file provider(s)...\n`);
            for (const file of allProviderFiles) await transpileSingleFile(file);
        } else {
            console.log(`\n🔄 Transpiling ${files.length} file(s)...\n`);
            for (const file of files) {
                await transpileSingleFile(file.endsWith('.js') ? file : file + '.js');
            }
        }
        return;
    }

    const providers = getProvidersToBuild();
    if (providers.length === 0) {
        console.log('No providers found in src/ directory.');
        return;
    }
    console.log(`\n📦 Building ${providers.length} provider(s)...\n`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    let success = 0, failed = 0;
    for (const provider of providers) {
        (await buildProvider(provider)) ? success++ : failed++;
    }
    console.log(`\n✨ Done! ${success} built, ${failed} skipped/failed\n`);
}

main().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
