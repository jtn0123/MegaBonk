import { listSessionBundles, summarizeSessions } from './session-history.js';

const elements = {
    summary: document.getElementById('analytics-summary'),
    failureKinds: document.getElementById('failure-kinds-panel'),
    stageBottlenecks: document.getElementById('stage-bottlenecks-panel'),
    weakImages: document.getElementById('weak-images-panel'),
    stallDiagnoses: document.getElementById('stall-diagnosis-panel'),
    confusion: document.getElementById('confusion-panel'),
    refresh: document.getElementById('refresh-analytics-btn'),
};

function formatPercent(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function renderSummary(sessions) {
    if (sessions.length === 0) {
        elements.summary.className = 'empty-state';
        elements.summary.textContent = 'No stored sessions yet.';
        return;
    }

    const summary = summarizeSessions(sessions);
    const images = new Set(sessions.map(session => session.imageName));
    const averageStages =
        sessions.reduce((total, session) => total + session.trace.stages.length, 0) / Math.max(1, sessions.length);

    elements.summary.className = '';
    elements.summary.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card"><strong>Stored Runs</strong>${summary.count}</div>
            <div class="summary-card"><strong>Images Covered</strong>${images.size}</div>
            <div class="summary-card"><strong>Avg F1</strong>${formatPercent(summary.avgF1)}</div>
            <div class="summary-card"><strong>Avg Stage Count</strong>${averageStages.toFixed(1)}</div>
            <div class="summary-card"><strong>Warnings</strong>${summary.warningCount}</div>
            <div class="summary-card"><strong>Errors</strong>${summary.errorCount}</div>
        </div>
    `;
}

function renderFailureKinds(sessions) {
    if (sessions.length === 0) {
        elements.failureKinds.className = 'empty-state';
        elements.failureKinds.textContent = 'No stored sessions yet.';
        return;
    }

    const counts = {};
    for (const session of sessions) {
        const kind = session.metrics?.dominantFailureKind || 'unknown';
        counts[kind] = (counts[kind] || 0) + 1;
    }

    const rows = Object.entries(counts).sort((left, right) => right[1] - left[1]);
    elements.failureKinds.className = '';
    elements.failureKinds.innerHTML = `
        <table class="history-table">
            <thead>
                <tr><th>Failure Kind</th><th>Runs</th><th>Share</th></tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        ([kind, count]) => `
                            <tr>
                                <td>${escapeHtml(kind)}</td>
                                <td>${count}</td>
                                <td>${formatPercent(count / sessions.length)}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

function renderStageBottlenecks(sessions) {
    if (sessions.length === 0) {
        elements.stageBottlenecks.className = 'empty-state';
        elements.stageBottlenecks.textContent = 'No stored sessions yet.';
        return;
    }

    const stats = new Map();
    for (const session of sessions) {
        for (const stage of session.trace.stages) {
            if (!stats.has(stage.name)) {
                stats.set(stage.name, { total: 0, count: 0, warnings: 0, errors: 0, slowestWins: 0 });
            }
            const entry = stats.get(stage.name);
            entry.total += stage.durationMs || 0;
            entry.count += 1;
            entry.warnings += stage.warnings?.length || 0;
            entry.errors += (session.logEvents || []).filter(
                event => event.stage === stage.name && event.level === 'error'
            ).length;
            if (session.progressSummary?.slowestStage?.name === stage.name) {
                entry.slowestWins += 1;
            }
        }
    }

    const rows = Array.from(stats.entries())
        .map(([name, entry]) => ({
            name,
            avgMs: entry.total / entry.count,
            warnings: entry.warnings,
            errors: entry.errors,
            slowestWins: entry.slowestWins,
        }))
        .sort((left, right) => right.avgMs - left.avgMs);

    elements.stageBottlenecks.className = '';
    elements.stageBottlenecks.innerHTML = `
        <table class="history-table">
            <thead>
                <tr><th>Stage</th><th>Avg Duration</th><th>Warnings</th><th>Errors</th><th>Slowest</th></tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        row => `
                            <tr>
                                <td>${escapeHtml(row.name)}</td>
                                <td>${Math.round(row.avgMs)} ms</td>
                                <td>${row.warnings}</td>
                                <td>${row.errors}</td>
                                <td>${row.slowestWins}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

function renderStallDiagnoses(sessions) {
    if (sessions.length === 0) {
        elements.stallDiagnoses.className = 'empty-state';
        elements.stallDiagnoses.textContent = 'No stored sessions yet.';
        return;
    }

    const counts = new Map();
    for (const session of sessions) {
        const diagnosis = session.progressSummary?.currentDiagnosis?.diagnosis;
        if (!diagnosis) continue;
        counts.set(diagnosis, (counts.get(diagnosis) || 0) + 1);
    }

    if (counts.size === 0) {
        elements.stallDiagnoses.className = 'empty-state';
        elements.stallDiagnoses.textContent = 'No stall diagnoses recorded yet.';
        return;
    }

    const rows = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
    elements.stallDiagnoses.className = '';
    elements.stallDiagnoses.innerHTML = `
        <table class="history-table">
            <thead>
                <tr><th>Diagnosis</th><th>Runs</th></tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        ([diagnosis, count]) => `
                            <tr>
                                <td>${escapeHtml(diagnosis)}</td>
                                <td>${count}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

function renderWeakImages(sessions) {
    if (sessions.length === 0) {
        elements.weakImages.className = 'empty-state';
        elements.weakImages.textContent = 'No stored sessions yet.';
        return;
    }

    const rows = [...sessions].sort((left, right) => left.metrics.f1 - right.metrics.f1).slice(0, 12);

    elements.weakImages.className = '';
    elements.weakImages.innerHTML = `
        <table class="history-table">
            <thead>
                <tr><th>Image</th><th>F1</th><th>Failure</th><th>Mode</th></tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        session => `
                            <tr>
                                <td>${escapeHtml(session.imageName)}</td>
                                <td>${formatPercent(session.metrics.f1)}</td>
                                <td>${escapeHtml(session.metrics.dominantFailureKind)}</td>
                                <td>${escapeHtml(session.trace.metadata.detectionMode)}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

function renderConfusions(sessions) {
    const counts = new Map();
    for (const session of sessions) {
        const slotLookup = new Map(session.trace.slots.map(slot => [slot.slotId, slot]));
        for (const action of session.reviewActions || []) {
            if (action.action !== 'corrected' || !action.itemName) continue;
            const originalName = slotLookup.get(action.slotId)?.finalDetection?.itemName || '(empty)';
            const key = `${originalName} -> ${action.itemName}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }

    if (counts.size === 0) {
        elements.confusion.className = 'empty-state';
        elements.confusion.textContent = 'No corrections recorded yet.';
        return;
    }

    const rows = Array.from(counts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 15);
    elements.confusion.className = '';
    elements.confusion.innerHTML = `
        <table class="history-table">
            <thead>
                <tr><th>Confusion</th><th>Count</th></tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        ([label, count]) => `
                            <tr>
                                <td>${escapeHtml(label)}</td>
                                <td>${count}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

async function loadAnalytics() {
    const sessions = await listSessionBundles();
    renderSummary(sessions);
    renderFailureKinds(sessions);
    renderStageBottlenecks(sessions);
    renderWeakImages(sessions);
    renderStallDiagnoses(sessions);
    renderConfusions(sessions);
}

elements.refresh.addEventListener('click', () => {
    loadAnalytics().catch(error => {
        elements.summary.className = 'error-callout';
        elements.summary.textContent = error.message;
    });
});

loadAnalytics().catch(error => {
    elements.summary.className = 'error-callout';
    elements.summary.textContent = error.message;
});
