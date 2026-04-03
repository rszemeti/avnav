const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const LOCAL_PORT = 8083;
const REMOTE_HOST = 'https://www.wellenvogel.net';
const REMOTE_BASE = REMOTE_HOST + '/software/avnav/viewer';
const BUILD_DIR = path.join(__dirname, 'build', 'debug');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function proxyToUrl(targetUrl, res) {
    console.log(`PROXY -> ${targetUrl}`);
    https.get(targetUrl, { headers: { 'User-Agent': 'avnav-dev-proxy' } }, (proxyRes) => {
        const headers = { ...proxyRes.headers };
        delete headers['x-frame-options'];
        delete headers['content-security-policy'];
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
    }).on('error', (err) => {
        console.error('Proxy error:', err.message);
        res.writeHead(502);
        res.end('Proxy error: ' + err.message);
    });
}

function proxyRequest(reqUrl, res) {
    proxyToUrl(REMOTE_BASE + reqUrl, res);
}

function proxyAbsolute(reqUrl, res) {
    proxyToUrl(REMOTE_HOST + reqUrl, res);
}

function tryServeLocal(filePath, res) {
    const cleanPath = filePath.split('?')[0];
    const fullPath = path.join(BUILD_DIR, cleanPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error reading file');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
        return true;
    }
    return false;
}

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url);
    let reqPath = parsed.path;
    console.log(`REQ ${reqPath}`);

    // API requests -> proxy to remote server
    if (reqPath.startsWith('/avnav_navi.php')) {
        proxyRequest(reqPath, res);
        return;
    }

    // /user/ paths -> proxy to remote (server-side user data)
    if (reqPath.startsWith('/user/')) {
        proxyRequest(reqPath, res);
        return;
    }

    // Paths already containing the full remote path -> proxy as absolute
    if (reqPath.startsWith('/software/avnav/')) {
        proxyAbsolute(reqPath, res);
        return;
    }

    // Strip /viewer/ prefix and try local first
    let localPath = reqPath;
    if (reqPath.startsWith('/viewer/')) {
        localPath = reqPath.substring('/viewer'.length); // keep leading /
    }

    // Root -> serve index
    if (localPath === '/') {
        localPath = '/avnav_viewer.html';
    }

    // Try serving from local build
    if (tryServeLocal(localPath, res)) {
        return;
    }

    // Not found locally -> proxy to remote server
    proxyRequest(reqPath, res);
});

server.listen(LOCAL_PORT, () => {
    console.log(`\nDev proxy running at:`);
    console.log(`  http://localhost:${LOCAL_PORT}/avnav_viewer.html?navurl=/avnav_navi.php&readOnlyServer=true&lang=en`);
    console.log(`\nLocal files served from: ${BUILD_DIR}`);
    console.log(`API proxied to: ${REMOTE_BASE}`);
});
