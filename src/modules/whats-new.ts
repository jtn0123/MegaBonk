// ========================================
// MegaBonk What's New Module
// Shows app release changelog on version update
// ========================================

import { escapeHtml } from './utils.ts';

// Build-time constants (injected by Vite)
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;

const GITHUB_REPO_URL = 'https://github.com/jtn0123/MegaBonk';
const STORAGE_KEY = 'megabonk-last-seen-version';

// ========================================
// Types
// ========================================

interface Release {
    version: string;
    date: string;
    body: string;
}

// ========================================
// Version Check
// ========================================

/**
 * Check if the user should see the What's New modal
 * Shows when the app version is newer than the last seen version
 */
export function shouldShowWhatsNew(): boolean {
    const currentVersion = __APP_VERSION__ ?? '0.0.0';
    if (currentVersion === '0.0.0') return false;
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    // Already seen this version
    if (lastSeen === currentVersion) return false;
    // Sentinel value: suppress modal unconditionally (used by E2E storageState)
    if (lastSeen === 'DISMISS_ALL') return false;
    return lastSeen !== currentVersion;
}

/**
 * Mark the current version as seen
 */
export function dismissWhatsNew(): void {
    const currentVersion = __APP_VERSION__ ?? '0.0.0';
    localStorage.setItem(STORAGE_KEY, currentVersion);
}

// ========================================
// GitHub Releases Fetcher
// ========================================

/**
 * Fetch recent releases from GitHub API
 */
async function fetchReleases(limit = 5): Promise<Release[]> {
    try {
        const res = await fetch(`https://api.github.com/repos/jtn0123/MegaBonk/releases?per_page=${limit}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.map((r: { tag_name: string; published_at: string; body: string }) => ({
            version: r.tag_name.replace(/^v/, ''),
            date: r.published_at ? new Date(r.published_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
            }) : '',
            body: r.body || ''
        }));
    } catch {
        return [];
    }
}

/**
 * Convert basic markdown to HTML (handles bullets, bold, headers)
 */
function markdownToHtml(md: string): string {
    if (!md) return '<p>No release notes available.</p>';
    return escapeHtml(md)
        .replaceAll(/^### (.+)$/gm, '<h4>$1</h4>')
        .replaceAll(/^## (.+)$/gm, '<h3>$1</h3>')
        .replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replaceAll(/^[*-] (.+)$/gm, '<li>$1</li>')
        .replaceAll(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replaceAll(/\n{2,}/g, '<br>')
        .replaceAll('\n', ' ');
}

// ========================================
// Modal Rendering
// ========================================

/**
 * Show the What's New modal
 */
export async function showWhatsNewModal(): Promise<void> {
    // Don't create duplicate modals
    if (document.getElementById('whats-new-modal')) return;

    const version = __APP_VERSION__ ?? '0.0.0';
    const commit = __GIT_COMMIT__ ?? 'dev';
    const commitShort = commit === 'dev' ? '' : commit.substring(0, 7);

    const overlay = document.createElement('div');
    overlay.id = 'whats-new-modal';
    overlay.className = 'whats-new-overlay';
    overlay.innerHTML = `
        <div class="whats-new-panel" role="dialog" aria-label="What's New">
            <div class="whats-new-header">
                <div class="whats-new-title-group">
                    <span class="whats-new-sparkle">✨</span>
                    <div>
                        <h2 class="whats-new-title">What's New — v${escapeHtml(version)}</h2>
                        ${commitShort ? `<span class="whats-new-commit">${escapeHtml(commitShort)}</span>` : ''}
                    </div>
                </div>
                <button class="whats-new-close" aria-label="Close">✕</button>
            </div>
            <div class="whats-new-body">
                <div class="whats-new-loading">Loading releases...</div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Wire up close handlers
    const close = () => {
        dismissWhatsNew();
        overlay.remove();
    };
    overlay.querySelector('.whats-new-close')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', onEsc);
        }
    });

    // Fetch and render releases
    const releases = await fetchReleases();
    const body = overlay.querySelector('.whats-new-body');
    if (!body) return;

    if (releases.length === 0) {
        body.innerHTML = `
            <p class="whats-new-empty">No release notes available.</p>
            <a href="${GITHUB_REPO_URL}/releases" target="_blank" rel="noopener" class="whats-new-github-link">
                View releases on GitHub ↗
            </a>
        `;
        return;
    }

    body.innerHTML = releases.map(r => `
        <div class="whats-new-release">
            <div class="whats-new-release-header">
                <span class="whats-new-version">v${escapeHtml(r.version)}</span>
                <span class="whats-new-date">${escapeHtml(r.date)}</span>
                <a href="${GITHUB_REPO_URL}/releases/tag/v${escapeHtml(r.version)}" 
                   target="_blank" rel="noopener" class="whats-new-release-link">
                    GitHub ↗
                </a>
            </div>
            <div class="whats-new-release-body">${markdownToHtml(r.body)}</div>
        </div>
    `).join('');
}

/**
 * Initialize What's New — call on app startup
 * Automatically shows modal if there's a new version
 */
export function initWhatsNew(): void {
    if (shouldShowWhatsNew()) {
        // Delay slightly so the app renders first
        setTimeout(() => showWhatsNewModal(), 500);
    }
}

// ========================================
// Exports:
// - shouldShowWhatsNew()
// - dismissWhatsNew()
// - showWhatsNewModal()
// - initWhatsNew()
// ========================================
