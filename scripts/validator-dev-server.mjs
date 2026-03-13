import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
};

function shouldPrintEvent(event) {
    if (!event) return false;
    if (event.level === 'warn' || event.level === 'error') return true;
    return [
        'runtime_ready',
        'run_started',
        'stage_started',
        'stage_completed',
        'stage_warning',
        'run_completed',
        'run_failed',
        'run_stalled',
    ].includes(event.type);
}

function summarizeMetadata(metadata = {}) {
    const interestingKeys = [
        'diagnosis',
        'elapsedMs',
        'cacheHit',
        'cacheKey',
        'templatesLoaded',
        'templatesTotal',
        'workerBatchesPending',
        'slotsProcessed',
        'slotsTotal',
        'candidateCount',
        'ocrSlotsDone',
        'ocrSlotsTotal',
        'detectionsOut',
        'resultCount',
    ];

    return interestingKeys
        .filter(key => metadata[key] !== undefined && metadata[key] !== null)
        .map(key => `${key}=${JSON.stringify(metadata[key])}`)
        .join(' ');
}

function formatEvent(event) {
    const timestamp = new Date(event.timestamp || Date.now()).toISOString().slice(11, 19);
    const level = String(event.level || 'info').toUpperCase();
    const stageOrType = event.stage || event.type || 'event';
    const summary = summarizeMetadata(event.metadata);
    return `[${timestamp}] [${event.runId || 'runtime'}] [${level}] [${stageOrType}] ${event.message || ''}${summary ? ` ${summary}` : ''}`.trim();
}

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(body));
}

function sendNoContent(response) {
    response.writeHead(204, {
        'Cache-Control': 'no-store',
    });
    response.end();
}

function resolveStaticFile(rootDir, requestPath, defaultPage) {
    const decodedPath = decodeURIComponent(requestPath || '/');
    const normalizedPath = decodedPath === '/' ? defaultPage : decodedPath;
    const absolutePath = path.resolve(rootDir, `.${normalizedPath}`);

    if (!absolutePath.startsWith(rootDir)) {
        return null;
    }

    const candidates = [absolutePath];
    if (!path.extname(absolutePath)) {
        candidates.push(`${absolutePath}.html`);
    }
    if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
        candidates.push(path.join(absolutePath, 'index.html'));
    }

    for (const candidate of candidates) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
            return candidate;
        }
    }

    return null;
}

function serveFile(response, filePath, headOnly = false) {
    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';
    response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
    });

    if (headOnly) {
        response.end();
        return;
    }

    createReadStream(filePath).pipe(response);
}

export function createValidatorDevServer({
    rootDir = process.cwd(),
    port = 8002,
    defaultPage = '/test-images/gameplay/cv-validator.html',
} = {}) {
    const normalizedRootDir = path.resolve(rootDir);
    const server = http.createServer((request, response) => {
        const url = new URL(request.url || '/', 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/__validator/health') {
            sendJson(response, 200, {
                ok: true,
                defaultPage,
                rootDir: normalizedRootDir,
            });
            return;
        }

        if (request.method === 'POST' && url.pathname === '/__validator/events') {
            let body = '';
            request.on('data', chunk => {
                body += chunk;
            });
            request.on('end', () => {
                try {
                    const event = body ? JSON.parse(body) : null;
                    if (shouldPrintEvent(event)) {
                        console.log(formatEvent(event));
                    }
                    sendNoContent(response);
                } catch (error) {
                    sendJson(response, 400, {
                        ok: false,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            });
            return;
        }

        if (request.method === 'GET' || request.method === 'HEAD') {
            const filePath = resolveStaticFile(normalizedRootDir, url.pathname, defaultPage);
            if (!filePath) {
                response.writeHead(404, {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-store',
                });
                response.end('Not Found');
                return;
            }

            serveFile(response, filePath, request.method === 'HEAD');
            return;
        }

        response.writeHead(405, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        response.end('Method Not Allowed');
    });

    return {
        server,
        start() {
            return new Promise(resolve => {
                server.listen(port, () => {
                    console.log(`Validator dev server running at http://localhost:${port}${defaultPage}`);
                    console.log(`Health endpoint: http://localhost:${port}/__validator/health`);
                    resolve(server);
                });
            });
        },
        stop() {
            return new Promise((resolve, reject) => {
                server.close(error => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        },
    };
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
    const defaultPage = process.argv[2] || '/test-images/gameplay/cv-validator.html';
    const port = Number(process.env.VALIDATOR_PORT || '8002');
    const instance = createValidatorDevServer({
        rootDir: process.cwd(),
        port,
        defaultPage,
    });

    instance.start();

    const shutdown = () => {
        instance
            .stop()
            .catch(() => {
                // Best effort shutdown.
            })
            .finally(() => {
                process.exit(0);
            });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
