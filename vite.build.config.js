import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import pkg from './package.json' with { type: 'json' };
import { resolve } from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';

// Check if we're building with coverage instrumentation
const isCoverage = process.env.COVERAGE === 'true';

// ========================================
// Build-time Git Info Helpers
// ========================================

/**
 * Get the current git commit hash (short)
 * @returns {string} Short commit hash or 'dev' if not in a git repo
 */
function getGitCommit() {
    try {
        return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    } catch {
        return 'dev';
    }
}

/**
 * Get the current git branch name
 * In CI (GitHub Actions), uses GITHUB_REF_NAME or GITHUB_HEAD_REF env vars
 * since git rev-parse returns "HEAD" in detached HEAD state
 * @returns {string} Branch name or 'unknown' if not in a git repo
 */
function getGitBranch() {
    // GitHub Actions sets these environment variables
    // GITHUB_HEAD_REF is set for PRs, GITHUB_REF_NAME for pushes
    const ciBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
    if (ciBranch) {
        return ciBranch;
    }

    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
        // If we're in detached HEAD state, try to get the branch from git describe
        if (branch === 'HEAD') {
            // Try to get branch name from symbolic ref
            try {
                return execSync('git symbolic-ref --short HEAD', { encoding: 'utf-8' }).trim();
            } catch {
                return 'release'; // Default for detached HEAD (likely a release build)
            }
        }
        return branch;
    } catch {
        return 'unknown';
    }
}

// Simple MIME type lookup
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};
function getMimeType(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    return mimeTypes[ext] || 'application/octet-stream';
}

// Use package version for cache versioning
const cacheVersion = `megabonk-v${pkg.version}`;

// Plugin to serve test-images and data directories from project root in dev
function serveProjectRoot() {
    const projectRoot = resolve(import.meta.dirname);
    const servedPaths = ['/test-images/', '/data/', '/dist/', '/src/'];

    return {
        name: 'serve-project-root',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = req.url?.split('?')[0];
                if (!url || !servedPaths.some(p => url.startsWith(p))) {
                    return next();
                }

                let filePath = resolve(projectRoot, '.' + url);

                // Check if URL has no extension (for .html fallback)
                const lastDot = url.lastIndexOf('.');
                const lastSlash = url.lastIndexOf('/');
                const hasNoExtension = lastDot < lastSlash || lastDot === -1;

                // Try .html extension if URL has no extension and .html file exists
                // This takes priority even if a directory with the same name exists
                if (hasNoExtension) {
                    const htmlPath = filePath + '.html';
                    if (existsSync(htmlPath)) {
                        filePath = htmlPath;
                    }
                }

                // Handle directory requests - try index.html
                if (existsSync(filePath) && statSync(filePath).isDirectory()) {
                    const indexPath = resolve(filePath, 'index.html');
                    if (existsSync(indexPath)) {
                        filePath = indexPath;
                    } else {
                        return next();
                    }
                }

                if (!existsSync(filePath)) {
                    return next();
                }

                const stat = statSync(filePath);
                if (stat.isDirectory()) {
                    return next();
                }

                const mimeType = getMimeType(filePath);
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Cache-Control', 'no-cache');
                createReadStream(filePath).pipe(res);
            });
        },
    };
}

// Use async config function for dynamic imports
export default defineConfig(async () => {
    // Dynamically import istanbul plugin only when needed (ESM-only package)
    let istanbulPlugin = null;
    if (isCoverage) {
        try {
            const istanbul = await import('vite-plugin-istanbul');
            istanbulPlugin = istanbul.default;
            console.log('[vite] Istanbul coverage instrumentation enabled');
        } catch (e) {
            console.warn('[vite] Failed to load vite-plugin-istanbul:', e.message);
        }
    }

    return {
        base: process.env.VITE_BASE || '/',
        root: 'src',
        publicDir: false, // No separate public dir, static assets handled separately
        // Define global constants available at build time
        define: {
            __APP_VERSION__: JSON.stringify(pkg.version),
            __CACHE_VERSION__: JSON.stringify(cacheVersion),
            __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
            __GIT_COMMIT__: JSON.stringify(getGitCommit()),
            __GIT_BRANCH__: JSON.stringify(getGitBranch()),
        },
        build: {
            outDir: '../dist',
            emptyOutDir: true,
            sourcemap: 'hidden',
            rollupOptions: {
                input: {
                    main: './src/index.html',
                },
                output: {
                    manualChunks: {
                        'chart': ['chart.js'],
                        'fuse': ['fuse.js'],
                    },
                },
            },
            // Code splitting strategy
            chunkSizeWarningLimit: 500,
            // Disable minification for coverage builds to preserve instrumentation
            minify: isCoverage ? false : 'terser',
            terserOptions: isCoverage
                ? undefined
                : {
                      compress: {
                          drop_console: true, // Remove console.* in production
                          drop_debugger: true, // Remove debugger statements
                          pure_funcs: ['console.log', 'console.debug'], // Remove specific console methods
                      },
                      mangle: {
                          safari10: true, // Fix Safari 10 issues
                      },
                  },
        },
        appType: 'mpa', // Disable SPA fallback so /test-images/... URLs work correctly
        server: {
            port: 8000,
            open: true,
            fs: {
                // Allow serving files from the data directory (outside root)
                allow: ['..'],
            },
        },
        resolve: {
            alias: {
                '@': '/src',
                '@modules': '/modules',
            },
        },
        plugins: [
            serveProjectRoot(),
            // Istanbul coverage instrumentation - only when COVERAGE=true
            ...(istanbulPlugin
                ? [
                      istanbulPlugin({
                          include: 'src/**/*.ts',
                          exclude: ['src/libs/**', 'src/sw.js', 'src/types/**', 'node_modules/**'],
                          extension: ['.ts'],
                          requireEnv: false, // Don't require env since we check manually
                          forceBuildInstrument: true, // Instrument even in build mode
                      }),
                  ]
                : []),
            viteStaticCopy({
                targets: [
                    { src: '../data', dest: '.' },
                    { src: 'images', dest: '.' },
                    { src: 'icons', dest: '.' },
                ],
            }),
            // Skip PWA plugin during coverage builds (unminified code is too large)
            ...(isCoverage
                ? []
                : [
                      VitePWA({
                          registerType: 'prompt',
                          manifest: {
                              name: 'MegaBonk Complete Guide',
                              short_name: 'MegaBonk',
                              description:
                                  'Complete guide for MegaBonk roguelike with items, weapons, tomes, characters, build planner and calculator',
                              theme_color: '#00ff88',
                              background_color: '#1a1a1a',
                              display: 'standalone',
                              scope: process.env.VITE_BASE || '/',
                              start_url: process.env.VITE_BASE || '/',
                              icons: [
                                  {
                                      src: 'icons/icon-192.png',
                                      sizes: '192x192',
                                      type: 'image/png',
                                  },
                                  {
                                      src: 'icons/icon-512.png',
                                      sizes: '512x512',
                                      type: 'image/png',
                                  },
                              ],
                          },
                          workbox: {
                              globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webp}'],
                              runtimeCaching: [
                                  {
                                      urlPattern: /^https?:\/\/.*\.json$/,
                                      handler: 'StaleWhileRevalidate',
                                      options: {
                                          cacheName: 'game-data-cache',
                                          expiration: {
                                              maxEntries: 50,
                                              maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                                          },
                                      },
                                  },
                                  {
                                      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/,
                                      handler: 'CacheFirst',
                                      options: {
                                          cacheName: 'image-cache',
                                          expiration: {
                                              maxEntries: 100,
                                              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                                          },
                                      },
                                  },
                              ],
                              // Clear old caches on activation
                              cleanupOutdatedCaches: true,
                              // Cache versioning - uses package.json version for automatic cache busting
                              cacheId: cacheVersion,
                          },
                      }),
                  ]),
        ],
    };
});
