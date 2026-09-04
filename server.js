/**
 * Minimal static server for local Nuvio plugin testing.
 * Serves manifest.json + providers/ so the in-app Plugin Tester can load:
 *   http://<LAN-IP>:3000/manifest.json
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.md': 'text/markdown',
    '.png': 'image/png',
    '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(ROOT, urlPath === '/' ? 'manifest.json' : urlPath);

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`📡 Streamline test server: http://localhost:${PORT}/manifest.json`);
});
