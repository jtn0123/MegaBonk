/* global Blob */
import { clearSessionBundles, listSessionBundles } from './session-history.js';

const elements = {
    summary: document.getElementById('performance-summary'),
    recentRuns: document.getElementById('recent-runs-panel'),
    stageTrends: document.getElementById('stage-trends-panel'),
    perImage: document.getElementById('per-image-panel'),
    refresh: document.getElementById('refresh-performance-btn'),
    export: document.getElementById('export-performance-btn'),
    clear: document.getElementById('clear-performance-btn'),
};

function formatPercent(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function renderSummary(sessions) {
    if (sessions.length === 0) {
        elements.summary.className = 'empty-state';
        elements.summary.textContent = 'No stored runs yet.';
        return;
    }

    const latest = sessions[0];
    const oldest = sessions[sessions.length - 1];
    const deltaF1 = latest.metrics.f1 - oldest.metrics.f1;

    elements.summary.className = '';
    elements.summary.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card"><strong>Latest F1</strong>${formatPercent(latest.metrics.f1)}</div>
            <div class="summary-card"><strong>Latest Precision</strong>${formatPercent(latest.metrics.precision)}</div>
            <div class="summary-card"><strong>Latest Recall</strong>${formatPercent(latest.metrics.recall)}</div>
            <div class="summary-card"><strong>Runs</strong>${sessions.length}</div>
            <div class="summary-card"><strong>Warnings</strong>${latest.progressSummary?.activeWarningCount || 0}</div>
            <div class="summary-card"><strong>Status</strong>${escapeHtml(latest.status || latest.progressSummary?.runStatus || 'completed')}</div>
        </div>
        <div class="tag-row">
            <span class="tag">Latest: ${escapeHtml(latest.imageName)}</span>
            <span class="tag">F1 Delta vs First: ${deltaF1 >= 0 ? '+' : ''}${(deltaF1 * 100).toFixed(1)} pts</span>
        </div>
    `;
}

function renderRecentRuns(sessions) {
    if (sessions.length === 0) {
        elements.recentRuns.className = 'empty-state';
        elements.recentRuns.textContent = 'No stored runs yet.';
        return;
    }

    elements.recentRuns.className = '';
    elements.recentRuns.innerHTML = `
        <table class="history-table">
            <thead>
                <tr><th>Date</th><th>Image</th><th>F1</th><th>Precision</th><th>Recall</th><th>Failure</th></tr>
            </thead>
            <tbody>
                ${sessions
                    .slice(0, 20)
                    .map(
                        session => `
                            <tr>
                                <td>${new Date(session.createdAt).toLocaleString()}</td>
                                <td>${escapeHtml(session.imageName)}</td>
                                <td>${formatPercent(session.metrics.f1)}</td>
                                <td>${formatPercent(session.metrics.precision)}</td>
                                <td>${formatPercent(session.metrics.recall)}</td>
                                <td>${escapeHtml(session.metrics.dominantFailureKind)}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

function renderPerImage(sessions) {
    if (sessions.length === 0) {
        elements.perImage.className = 'empty-state';
        elements.perImage.textContent = 'No stored runs yet.';
        return;
    }

    const grouped = new Map();
    for (const session of sessions) {
        if (!grouped.has(session.imageName)) {
            grouped.set(session.imageName, []);
        }
        grouped.get(session.imageName).push(session);
    }

    const rows = Array.from(grouped.entries()).map(([imageName, runs]) => {
        runs.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
        const latest = runs[0];
        const best = runs.reduce((max, run) => Math.max(max, run.metrics.f1), 0);
        const avg = runs.reduce((total, run) => total + run.metrics.f1, 0) / runs.length;
        return { imageName, latest, best, avg, runs: runs.length };
    });

    rows.sort((left, right) => right.latest.metrics.f1 - left.latest.metrics.f1);

    elements.perImage.className = '';
    elements.perImage.innerHTML = `
        <table class="history-table">
            <thead>
                <tr><th>Image</th><th>Latest F1</th><th>Best F1</th><th>Avg F1</th><th>Runs</th></tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        row => `
                            <tr>
                                <td>${escapeHtml(row.imageName)}</td>
                                <td>${formatPercent(row.latest.metrics.f1)}</td>
                                <td>${formatPercent(row.best)}</td>
                                <td>${formatPercent(row.avg)}</td>
                                <td>${row.runs}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

function renderStageTrends(sessions) {
    if (sessions.length === 0) {
        elements.stageTrends.className = 'empty-state';
        elements.stageTrends.textContent = 'No stored runs yet.';
        return;
    }

    const grouped = new Map();
    for (const session of sessions) {
        for (const stage of session.trace.stages || []) {
            if (!grouped.has(stage.name)) {
                grouped.set(stage.name, { totalMs: 0, count: 0, warnings: 0 });
            }
            const entry = grouped.get(stage.name);
            entry.totalMs += stage.durationMs || 0;
            entry.count += 1;
            entry.warnings += stage.warnings?.length || 0;
        }
    }

    const rows = Array.from(grouped.entries())
        .map(([name, entry]) => ({
            name,
            avgMs: entry.totalMs / entry.count,
            warnings: entry.warnings,
        }))
        .sort((left, right) => right.avgMs - left.avgMs);

    elements.stageTrends.className = '';
    elements.stageTrends.innerHTML = `
        <table class="history-table">
            <thead>
                <tr><th>Stage</th><th>Avg Duration</th><th>Warnings</th></tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        row => `
                            <tr>
                                <td>${escapeHtml(row.name)}</td>
                                <td>${Math.round(row.avgMs)} ms</td>
                                <td>${row.warnings}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

async function loadPerformance() {
    const sessions = await listSessionBundles();
    renderSummary(sessions);
    renderRecentRuns(sessions);
    renderStageTrends(sessions);
    renderPerImage(sessions);
    return sessions;
}

elements.refresh.addEventListener('click', () => {
    loadPerformance().catch(error => {
        elements.summary.className = 'error-callout';
        elements.summary.textContent = error.message;
    });
});

elements.export.addEventListener('click', async () => {
    const sessions = await listSessionBundles();
    downloadJson(`cv-performance-history-${new Date().toISOString().slice(0, 10)}.json`, sessions);
});

elements.clear.addEventListener('click', async () => {
    await clearSessionBundles();
    await loadPerformance();
});

loadPerformance().catch(error => {
    elements.summary.className = 'error-callout';
    elements.summary.textContent = error.message;
});
