// ========================================
// MegaBonk About Tab Module
// Displays app version, build info, and credits
// ========================================

import { safeGetElementById, escapeHtml } from './utils.ts';

// ========================================
// Build-time Constants (injected by Vite)
// ========================================

// These are defined in vite.build.config.js
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
declare const __GIT_COMMIT__: string;
declare const __GIT_BRANCH__: string;

// ========================================
// Constants
// ========================================

const GITHUB_REPO_URL = 'https://github.com/jtn0123/MegaBonk';

// ========================================
// Rendering
// ========================================

/**
 * Render the about tab content
 */
export function renderAbout(): void {
    const container = safeGetElementById('aboutContainer');
    if (!container) return;

    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
    const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString();
    const gitCommit = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'dev';
    const gitBranch = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'main';

    // Format build date for display
    const formattedDate = new Date(buildDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    container.innerHTML = `
        <div class="about-content">
            <div class="about-header">
                <div class="about-logo">🎮</div>
                <h2 class="about-title">MegaBonk Complete Guide</h2>
                <p class="about-subtitle">Your ultimate companion for MegaBonk</p>
            </div>

            <div class="about-info-grid">
                <div class="about-info-card">
                    <span class="about-info-icon">📦</span>
                    <div class="about-info-details">
                        <span class="about-info-label">Version</span>
                        <span class="about-info-value">${escapeHtml(version)}</span>
                    </div>
                </div>
                <div class="about-info-card">
                    <span class="about-info-icon">📅</span>
                    <div class="about-info-details">
                        <span class="about-info-label">Build Date</span>
                        <span class="about-info-value">${escapeHtml(formattedDate)}</span>
                    </div>
                </div>
                <div class="about-info-card">
                    <span class="about-info-icon">🔀</span>
                    <div class="about-info-details">
                        <span class="about-info-label">Commit</span>
                        <span class="about-info-value">
                            <a href="${GITHUB_REPO_URL}/commit/${escapeHtml(gitCommit)}" 
                               target="_blank" 
                               rel="noopener noreferrer"
                               class="about-commit-link"
                               title="View commit on GitHub">
                                ${escapeHtml(gitCommit.substring(0, 7))}
                            </a>
                        </span>
                    </div>
                </div>
                <div class="about-info-card">
                    <span class="about-info-icon">🌿</span>
                    <div class="about-info-details">
                        <span class="about-info-label">Branch</span>
                        <span class="about-info-value">${escapeHtml(gitBranch)}</span>
                    </div>
                </div>
            </div>

            <div class="about-links-section">
                <h3>Resources</h3>
                <div class="about-links">
                    <a href="${GITHUB_REPO_URL}" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="about-link">
                        <span class="about-link-icon">📂</span>
                        <div class="about-link-text">
                            <strong>GitHub Repository</strong>
                            <span>View source code and contribute</span>
                        </div>
                    </a>
                    <a href="${GITHUB_REPO_URL}/releases" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="about-link">
                        <span class="about-link-icon">📋</span>
                        <div class="about-link-text">
                            <strong>Release History</strong>
                            <span>See all app versions and updates</span>
                        </div>
                    </a>
                    <a href="${GITHUB_REPO_URL}/issues" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="about-link">
                        <span class="about-link-icon">🐛</span>
                        <div class="about-link-text">
                            <strong>Report Issues</strong>
                            <span>Found a bug? Let us know!</span>
                        </div>
                    </a>
                </div>
            </div>

            <div class="about-features-section">
                <h3>Features</h3>
                <ul class="about-features">
                    <li>📦 77 items with detailed stats and scaling</li>
                    <li>⚔️ 29 weapons with upgrade paths</li>
                    <li>📚 23 tomes with priority rankings</li>
                    <li>👤 20 playable characters</li>
                    <li>⛩️ 8 shrine types</li>
                    <li>🛠️ Interactive build planner</li>
                    <li>🧮 Breakpoint calculator</li>
                    <li>🤖 AI-powered build advisor</li>
                    <li>📱 Offline PWA support</li>
                </ul>
            </div>

            <div class="about-footer">
                <p class="about-credits">Made with ❤️ for MegaBonk players</p>
                <p class="about-disclaimer">
                    This is a community-made guide. Not affiliated with the game developers.
                </p>
            </div>
        </div>
    `;
}

/**
 * Update about tab stats (placeholder for consistency with other tabs)
 */
export function updateAboutStats(): void {
    const itemCount = safeGetElementById('item-count');
    if (itemCount) {
        itemCount.textContent = 'About';
    }
}

// ========================================
// Exports for Testing
// ========================================

export const __test__ = {
    GITHUB_REPO_URL,
};
