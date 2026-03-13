/* global Blob, FileReader, URLSearchParams, requestAnimationFrame */
import {
    clearSessionBundles,
    deleteSessionBundle,
    listSessionBundles,
    saveSessionBundle,
    summarizeSessions,
} from './session-history.js';

const DATA_BASE_PATH = '/data';
const TRAINING_DATA_BASE_PATH = '/data/training-data/';

const elements = {
    runtimeBadge: document.getElementById('runtime-badge'),
    runtimeStatus: document.getElementById('runtime-status'),
    runtimeError: document.getElementById('runtime-error'),
    liveStatusBadge: document.getElementById('live-status-badge'),
    liveStatusPanel: document.getElementById('live-status-panel'),
    imageSelect: document.getElementById('image-select'),
    thresholdInput: document.getElementById('threshold-input'),
    thresholdValue: document.getElementById('threshold-value'),
    workersToggle: document.getElementById('workers-toggle'),
    cacheToggle: document.getElementById('cache-toggle'),
    fullTemplatesToggle: document.getElementById('full-templates-toggle'),
    uploadImageBtn: document.getElementById('upload-image-btn'),
    uploadImageInput: document.getElementById('upload-image-input'),
    runPreflightBtn: document.getElementById('run-preflight-btn'),
    runDetectionBtn: document.getElementById('run-detection-btn'),
    runBatchBtn: document.getElementById('run-batch-btn'),
    exportBundleBtn: document.getElementById('export-bundle-btn'),
    importBundleBtn: document.getElementById('import-bundle-btn'),
    importBundleInput: document.getElementById('import-bundle-input'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    sourceImage: document.getElementById('source-image'),
    overlayCanvas: document.getElementById('overlay-canvas'),
    imageStage: document.getElementById('image-stage'),
    imageMeta: document.getElementById('image-meta'),
    preflightPanel: document.getElementById('preflight-panel'),
    runSummary: document.getElementById('run-summary'),
    diagnosisPanel: document.getElementById('diagnosis-panel'),
    reviewQueue: document.getElementById('review-queue'),
    timelinePanel: document.getElementById('timeline-panel'),
    logFilter: document.getElementById('log-filter'),
    logSearch: document.getElementById('log-search'),
    logPauseAutoscroll: document.getElementById('log-pause-autoscroll'),
    copyLogBtn: document.getElementById('copy-log-btn'),
    exportLogBtn: document.getElementById('export-log-btn'),
    logPanel: document.getElementById('log-panel'),
    slotList: document.getElementById('slot-list'),
    slotDetail: document.getElementById('slot-detail'),
    historyPanel: document.getElementById('history-panel'),
    compareLeft: document.getElementById('compare-left'),
    compareRight: document.getElementById('compare-right'),
    compareBtn: document.getElementById('compare-btn'),
    comparePanel: document.getElementById('compare-panel'),
    batchPanel: document.getElementById('batch-panel'),
    itemOptions: document.getElementById('item-options'),
};

const state = {
    runtimeModule: null,
    runtimeEventUnsubscribe: null,
    runtimeStatus: null,
    groundTruth: {},
    items: [],
    itemLookup: new Map(),
    imageCache: new Map(),
    currentImagePath: '',
    currentImageName: '',
    currentImageDataUrl: '',
    currentPreflight: null,
    currentRun: null,
    activeRunId: '',
    liveProgress: null,
    liveStages: [],
    liveLogEvents: [],
    selectedSlotId: '',
    sessions: [],
    compareLeft: '',
    compareRight: '',
    batchRuns: [],
    busyMessage: '',
    logFilter: 'all',
    logSearch: '',
};

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function formatPercent(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
}

function formatDuration(value) {
    return `${Math.round(value || 0)} ms`;
}

function formatTimestamp(value) {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString();
}

function toBadgeClass(kind) {
    if (kind === 'pass' || kind === 'good') return 'good';
    if (kind === 'warn' || kind === 'warning' || kind === 'review') return 'warn';
    if (kind === 'bad' || kind === 'error' || kind === 'high_risk' || kind === 'risky') return 'bad';
    return 'neutral';
}

async function loadJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
    }
    return response.json();
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

async function imageUrlToDataUrl(url) {
    if (state.imageCache.has(url)) {
        return state.imageCache.get(url);
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load image ${url}: HTTP ${response.status}`);
    }
    const dataUrl = await blobToDataUrl(await response.blob());
    state.imageCache.set(url, dataUrl);
    return dataUrl;
}

async function fileToDataUrl(file) {
    return blobToDataUrl(file);
}

function currentPipelineConfig() {
    return {
        useWorkers: elements.workersToggle.checked,
        disableCache: elements.cacheToggle.checked,
        requireFullTemplates: elements.fullTemplatesToggle.checked,
        threshold: Number(elements.thresholdInput.value),
    };
}

function setBusy(message = '') {
    state.busyMessage = message;
    if (message) {
        elements.runtimeBadge.textContent = message;
        elements.runtimeBadge.className = 'badge neutral';
    } else {
        renderRuntimeStatus();
    }
    syncActionAvailability();
}

function resetLiveRunState() {
    state.activeRunId = '';
    state.liveProgress = null;
    state.liveStages = [];
    state.liveLogEvents = [];
}

function getGroundTruthItems(imagePath) {
    return state.groundTruth[imagePath]?.items || [];
}

function getReviewLevel(slot) {
    const top = slot.topCandidates?.[0];
    const second = slot.topCandidates?.[1];
    const gap = top && second ? top.confidence - second.confidence : top ? top.confidence : 0;

    if (slot.status === 'filtered' || slot.status === 'missed' || slot.finalDetection?.confidence < 0.55) {
        return 'risky';
    }
    if (slot.finalDetection?.confidence >= 0.8 && gap >= 0.08) {
        return 'safe';
    }
    return 'review';
}

function getSlotById(slotId) {
    return state.currentRun?.trace?.slots?.find(slot => slot.slotId === slotId) || null;
}

function getSessionById(runId) {
    return state.sessions.find(session => session.runId === runId) || null;
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

async function ensureRuntime() {
    if (state.runtimeModule) {
        return state.runtimeModule;
    }

    try {
        state.runtimeModule = await import('../../../../dist/validator-runtime/validator-runtime.js');
        if (!state.runtimeEventUnsubscribe && state.runtimeModule.subscribeValidatorEvents) {
            state.runtimeEventUnsubscribe = state.runtimeModule.subscribeValidatorEvents(handleValidatorEvent);
        }
        state.runtimeStatus = await state.runtimeModule.initValidatorRuntime({
            dataBasePath: DATA_BASE_PATH,
            trainingDataBasePath: TRAINING_DATA_BASE_PATH,
        });
        return state.runtimeModule;
    } catch (error) {
        state.runtimeStatus = {
            initialized: false,
            authoritativeMode: true,
            runtimeVersion: 'unavailable',
            dataBasePath: DATA_BASE_PATH,
            trainingDataBasePath: TRAINING_DATA_BASE_PATH,
            templateReadiness: 'cold',
            templateCount: 0,
            itemCount: 0,
            trainingDataLoaded: false,
            trainingDataVersion: null,
            workerSupported: typeof Worker !== 'undefined',
            lastError: error.message,
        };
        renderRuntimeStatus();
        throw error;
    }
}

function renderRuntimeStatus() {
    const status = state.runtimeStatus;
    if (!status) {
        return;
    }

    elements.runtimeBadge.textContent = status.initialized ? 'Authoritative' : 'Blocked';
    elements.runtimeBadge.className = `badge ${status.initialized ? 'good' : 'bad'}`;
    elements.runtimeStatus.innerHTML = [
        ['Runtime', status.runtimeVersion],
        ['Templates', `${status.templateReadiness} (${status.templateCount})`],
        ['Items', status.itemCount],
        ['Training', status.trainingDataLoaded ? status.trainingDataVersion || 'loaded' : 'not loaded'],
        ['Workers', status.workerSupported ? 'supported' : 'unsupported'],
        ['Data Path', status.dataBasePath],
    ]
        .map(
            ([label, value]) => `
                <div class="runtime-card">
                    <strong>${escapeHtml(label)}</strong>
                    <div>${escapeHtml(value)}</div>
                </div>
            `
        )
        .join('');

    elements.runtimeError.hidden = !status.lastError;
    elements.runtimeError.textContent = status.lastError || '';
    syncActionAvailability();
}

function syncActionAvailability() {
    const busy = Boolean(state.busyMessage);
    const initialized = Boolean(state.runtimeStatus?.initialized);
    const hasImage = Boolean(state.currentImageDataUrl);
    const hasRun = Boolean(state.currentRun || state.activeRunId);
    const hasSessions = state.sessions.length > 0;
    const hasGroundTruth = Object.keys(state.groundTruth).some(key => !key.startsWith('_'));

    elements.uploadImageBtn.disabled = busy;
    elements.importBundleBtn.disabled = busy;
    elements.clearHistoryBtn.disabled = busy || !hasSessions;
    elements.runPreflightBtn.disabled = busy || !initialized || !hasImage;
    elements.runDetectionBtn.disabled = busy || !initialized || !hasImage;
    elements.runBatchBtn.disabled = busy || !initialized || !hasGroundTruth;
    elements.exportBundleBtn.disabled = busy || !initialized || !hasRun;
}

function upsertLiveStage(event) {
    if (!event.stage) {
        return;
    }

    const existing = state.liveStages.find(stage => stage.name === event.stage);
    const warningList = Array.isArray(event.metadata?.warnings) ? event.metadata.warnings : existing?.warnings || [];
    const nextStage = {
        name: event.stage,
        startedAtMs: existing?.startedAtMs || Date.now(),
        endedAtMs: event.type === 'stage_completed' ? Date.now() : existing?.endedAtMs || Date.now(),
        durationMs: Number(event.metadata?.elapsedMs || existing?.durationMs || 0),
        active: event.type !== 'stage_completed',
        status:
            event.type === 'stage_warning'
                ? 'warning'
                : event.level === 'error'
                  ? 'error'
                  : event.type === 'stage_completed'
                    ? event.metadata?.status || existing?.status || 'ok'
                    : existing?.status || 'ok',
        inputCount: event.metadata?.inputCount ?? existing?.inputCount,
        outputCount: event.metadata?.outputCount ?? existing?.outputCount,
        warnings: event.type === 'stage_warning' ? warningList.concat(event.message) : Array.from(new Set(warningList)),
        metadata: {
            ...(existing?.metadata || {}),
            ...(event.metadata || {}),
        },
    };

    if (existing) {
        Object.assign(existing, nextStage);
        return;
    }
    state.liveStages.push(nextStage);
}

function getCurrentLiveStageName() {
    const activeStages = state.liveStages.filter(stage => stage.active);
    return activeStages[activeStages.length - 1]?.name;
}

function appendLiveLogFromEvent(event) {
    if (event.type === 'stage_progress') {
        return;
    }
    const source = event.type === 'logger_event' ? event.metadata?.source || 'cv' : 'runtime';
    const operation = event.type === 'logger_event' ? event.metadata?.operation : event.type;
    state.liveLogEvents.push({
        id: `${event.runId}:${event.timestamp}:${event.type}:${state.liveLogEvents.length}`,
        timestamp: event.timestamp,
        runId: event.runId,
        level: event.level,
        source,
        message: event.message,
        operation,
        stage: event.stage,
        metadata: { ...(event.metadata || {}) },
    });
    if (state.liveLogEvents.length > 2000) {
        state.liveLogEvents = state.liveLogEvents.filter((entry, index) => {
            if (state.liveLogEvents.length - index <= 2000) {
                return true;
            }
            return entry.level === 'warn' || entry.level === 'error';
        });
        state.liveLogEvents = state.liveLogEvents.slice(-2000);
    }
}

function getDisplayedProgressSummary() {
    return state.liveProgress || state.currentRun?.progressSummary || null;
}

function getDisplayedLogs() {
    if (state.liveLogEvents.length > 0 && state.activeRunId) {
        return state.liveLogEvents;
    }
    return state.currentRun?.logEvents || [];
}

function getFilteredLogs() {
    const logs = getDisplayedLogs();
    return logs.filter(log => {
        if (state.logFilter === 'cv' && log.source !== 'cv') return false;
        if (state.logFilter === 'runtime' && log.source !== 'runtime') return false;
        if (state.logFilter === 'warnings' && !['warn', 'error'].includes(log.level)) return false;
        if (state.logSearch) {
            const haystack =
                `${log.message} ${log.operation || ''} ${JSON.stringify(log.metadata || {})}`.toLowerCase();
            if (!haystack.includes(state.logSearch.toLowerCase())) return false;
        }
        return true;
    });
}

async function refreshPartialRun(runId = state.activeRunId) {
    if (!runId || !state.runtimeModule) {
        return;
    }
    const bundle = state.runtimeModule.exportSessionBundle(runId);
    const run = state.runtimeModule.importSessionBundle(bundle);
    state.currentRun = run;
    state.currentPreflight = run.preflight;
    state.currentImageDataUrl = run.sourceImageDataUrl;
    state.currentImageName = run.imageName;
    state.currentImagePath = run.imagePath || '';
    if (!state.selectedSlotId) {
        state.selectedSlotId = run.trace.slots[0]?.slotId || '';
    }
    renderAll();
}

function handleValidatorEvent(event) {
    if (event.runId === 'runtime') {
        return;
    }

    if (event.type === 'run_started') {
        state.activeRunId = event.runId;
        state.currentRun = null;
        state.selectedSlotId = '';
        state.liveStages = [];
        state.liveLogEvents = [];
        state.liveProgress = {
            runStatus: 'running',
            startedAt: event.timestamp,
            updatedAt: event.timestamp,
            currentStage: undefined,
            totalElapsedMs: 0,
            stageElapsedMs: 0,
            activeWarningCount: 0,
            eventCount: 1,
            stalled: false,
            currentDiagnosis: null,
            slowestStage: null,
            stageProgress: {},
        };
    }

    if (!state.activeRunId || state.activeRunId !== event.runId) {
        return;
    }

    appendLiveLogFromEvent(event);

    if (event.stage) {
        upsertLiveStage(event);
    }

    const previousProgress = state.liveProgress || getDisplayedProgressSummary();
    if (previousProgress) {
        const currentLiveStage = getCurrentLiveStageName();
        state.liveProgress = {
            ...previousProgress,
            updatedAt: event.timestamp,
            runStatus:
                event.type === 'run_failed'
                    ? 'failed'
                    : event.type === 'run_completed'
                      ? 'completed'
                      : event.type === 'run_stalled'
                        ? 'stalled'
                        : previousProgress.runStatus || 'running',
            currentStage: currentLiveStage || event.stage || previousProgress.currentStage,
            totalElapsedMs: Math.max(
                previousProgress.totalElapsedMs || 0,
                Date.parse(event.timestamp) - Date.parse(previousProgress.startedAt)
            ),
            stageElapsedMs: Number(event.metadata?.elapsedMs || previousProgress.stageElapsedMs || 0),
            activeWarningCount:
                event.type === 'stage_warning'
                    ? (previousProgress.activeWarningCount || 0) + 1
                    : previousProgress.activeWarningCount || 0,
            eventCount: (previousProgress.eventCount || 0) + 1,
            stalled:
                event.type === 'run_stalled'
                    ? true
                    : event.type === 'stage_progress'
                      ? false
                      : previousProgress.stalled,
            currentDiagnosis:
                event.type === 'run_stalled'
                    ? {
                          diagnosis: event.metadata?.diagnosis || 'unknown',
                          message: event.message,
                          stage: event.stage,
                          detectedAt: event.timestamp,
                          stalledForMs: Number(event.metadata?.stalledForMs || 0),
                          thresholdMs: Number(event.metadata?.thresholdMs || 0),
                      }
                    : event.type === 'stage_progress'
                      ? null
                      : previousProgress.currentDiagnosis || null,
            slowestStage:
                event.type === 'stage_completed' && event.stage
                    ? !previousProgress.slowestStage ||
                      Number(event.metadata?.elapsedMs || 0) > previousProgress.slowestStage.durationMs
                        ? { name: event.stage, durationMs: Number(event.metadata?.elapsedMs || 0) }
                        : previousProgress.slowestStage
                    : previousProgress.slowestStage || null,
            stageProgress: {
                ...(previousProgress.stageProgress || {}),
                ...(event.stage
                    ? {
                          [event.stage]: {
                              stage: event.stage,
                              startedAt: previousProgress.stageProgress?.[event.stage]?.startedAt || event.timestamp,
                              updatedAt: event.timestamp,
                              elapsedMs: Number(
                                  event.metadata?.elapsedMs ||
                                      previousProgress.stageProgress?.[event.stage]?.elapsedMs ||
                                      0
                              ),
                              warningCount:
                                  event.type === 'stage_warning'
                                      ? (previousProgress.stageProgress?.[event.stage]?.warningCount || 0) + 1
                                      : previousProgress.stageProgress?.[event.stage]?.warningCount || 0,
                              metadata: {
                                  ...(previousProgress.stageProgress?.[event.stage]?.metadata || {}),
                                  ...(event.metadata || {}),
                              },
                          },
                      }
                    : {}),
            },
        };
    }

    if (event.type === 'run_stalled' || event.type === 'run_failed' || event.type === 'run_completed') {
        refreshPartialRun(event.runId).catch(error => {
            state.runtimeStatus = {
                ...(state.runtimeStatus || {}),
                lastError: error.message,
            };
            renderRuntimeStatus();
        });
    }

    if (event.type === 'run_completed' || event.type === 'run_failed') {
        state.busyMessage = '';
    }

    renderRuntimeStatus();
    renderLiveStatus();
    renderTimeline();
    renderDiagnosis();
    renderLogs();
}

function renderImageOptions() {
    const options = Object.entries(state.groundTruth)
        .filter(([key]) => !key.startsWith('_'))
        .sort((left, right) => left[0].localeCompare(right[0]));

    elements.imageSelect.innerHTML = '<option value="">Select a labeled screenshot</option>';
    for (const [path, entry] of options) {
        const option = document.createElement('option');
        option.value = path;
        option.textContent = `${path.split('/').pop()} (${entry.items?.length || 0} items)`;
        elements.imageSelect.appendChild(option);
    }
}

function populateItemOptions() {
    elements.itemOptions.innerHTML = state.items
        .map(item => `<option value="${escapeHtml(item.name)}"></option>`)
        .join('');
}

function renderImage() {
    if (!state.currentImageDataUrl) {
        elements.sourceImage.removeAttribute('src');
        elements.imageStage.classList.add('empty');
        elements.imageMeta.textContent = 'No image selected';
        const ctx = elements.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
        return;
    }

    elements.imageStage.classList.remove('empty');
    elements.sourceImage.src = state.currentImageDataUrl;
    const groundTruthCount = state.currentImagePath ? getGroundTruthItems(state.currentImagePath).length : 0;
    elements.imageMeta.textContent = `${state.currentImageName}${groundTruthCount ? ` • ${groundTruthCount} truth items` : ''}`;
}

function drawOverlay() {
    const run = state.currentRun;
    const image = elements.sourceImage;
    const canvas = elements.overlayCanvas;
    const ctx = canvas.getContext('2d');
    if (!run || !image.complete || !image.naturalWidth) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const width = image.clientWidth;
    const height = image.clientHeight;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const scaleX = width / image.naturalWidth;
    const scaleY = height / image.naturalHeight;

    run.trace.slots.forEach(slot => {
        const reviewLevel = getReviewLevel(slot);
        const selected = slot.slotId === state.selectedSlotId;
        ctx.strokeStyle = reviewLevel === 'safe' ? '#4ade80' : reviewLevel === 'review' ? '#f59e0b' : '#ef4444';
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(
            slot.bounds.x * scaleX,
            slot.bounds.y * scaleY,
            slot.bounds.width * scaleX,
            slot.bounds.height * scaleY
        );

        ctx.fillStyle = selected ? 'rgba(15, 118, 110, 0.35)' : 'rgba(15, 23, 42, 0.2)';
        ctx.fillRect(
            slot.bounds.x * scaleX,
            slot.bounds.y * scaleY,
            slot.bounds.width * scaleX,
            slot.bounds.height * scaleY
        );

        const label = slot.finalDetection?.itemName || slot.status;
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(label, slot.bounds.x * scaleX + 4, slot.bounds.y * scaleY + 14);
    });
}

function renderLiveStatus() {
    const progress = getDisplayedProgressSummary();
    if (!progress) {
        elements.liveStatusBadge.textContent = 'Idle';
        elements.liveStatusBadge.className = 'badge neutral';
        elements.liveStatusPanel.className = 'empty-state';
        elements.liveStatusPanel.textContent = 'Start a run to see live stage progress, diagnosis, and warnings.';
        return;
    }

    const badgeKind =
        progress.runStatus === 'completed'
            ? 'good'
            : progress.runStatus === 'failed' || progress.runStatus === 'stalled'
              ? 'bad'
              : 'warn';
    elements.liveStatusBadge.textContent = progress.runStatus;
    elements.liveStatusBadge.className = `badge ${badgeKind}`;
    elements.liveStatusPanel.className = 'live-status-grid';
    elements.liveStatusPanel.innerHTML = `
        <div class="status-card"><strong>Status</strong>${escapeHtml(progress.runStatus)}</div>
        <div class="status-card"><strong>Current Stage</strong>${escapeHtml(progress.currentStage || 'idle')}</div>
        <div class="status-card"><strong>Stage Elapsed</strong>${formatDuration(progress.stageElapsedMs)}</div>
        <div class="status-card"><strong>Total Elapsed</strong>${formatDuration(progress.totalElapsedMs)}</div>
        <div class="status-card"><strong>Warnings</strong>${progress.activeWarningCount}</div>
        <div class="status-card"><strong>Diagnosis</strong>${escapeHtml(progress.currentDiagnosis?.message || 'No active diagnosis')}</div>
    `;
}

function renderPreflight() {
    const preflight = state.currentRun?.preflight || state.currentPreflight;
    if (!preflight) {
        elements.preflightPanel.className = 'empty-state';
        elements.preflightPanel.textContent =
            'Run preflight on an image to see quality risk, grid confidence, and recommendations.';
        return;
    }

    elements.preflightPanel.className = '';
    elements.preflightPanel.innerHTML = `
        <div class="tag-row">
            <span class="badge ${toBadgeClass(preflight.status)}">${escapeHtml(preflight.status)}</span>
            <span class="tag">${escapeHtml(preflight.imageWidth)}x${escapeHtml(preflight.imageHeight)}</span>
            <span class="tag">Grid ${formatPercent(preflight.gridConfidence || 0)}</span>
            <span class="tag">${escapeHtml(preflight.screenType)}</span>
        </div>
        <div class="summary-grid" style="margin-top: 12px;">
            <div class="summary-card"><strong>Sharpness</strong>${(preflight.sharpnessScore || 0).toFixed(1)}</div>
            <div class="summary-card"><strong>Aspect Ratio</strong>${(preflight.aspectRatio || 0).toFixed(2)}</div>
        </div>
        <div>
            <strong>Warnings</strong>
            <ul>${(preflight.warnings || []).map(warning => `<li>${escapeHtml(warning)}</li>`).join('') || '<li>None</li>'}</ul>
        </div>
        <div>
            <strong>Recommendations</strong>
            <ul>${(preflight.recommendations || []).map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}</ul>
        </div>
    `;
}

function renderSummary() {
    const run = state.currentRun;
    if (!run) {
        elements.runSummary.className = 'empty-state';
        elements.runSummary.textContent =
            'Run detection to see precision, recall, F1, trust buckets, and dominant failure cause.';
        return;
    }

    elements.runSummary.className = '';
    elements.runSummary.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card"><strong>F1</strong>${formatPercent(run.metrics.f1)}</div>
            <div class="summary-card"><strong>Precision</strong>${formatPercent(run.metrics.precision)}</div>
            <div class="summary-card"><strong>Recall</strong>${formatPercent(run.metrics.recall)}</div>
            <div class="summary-card"><strong>Detected</strong>${run.metrics.detectedCount}/${run.metrics.expectedCount}</div>
        </div>
        <div class="summary-grid">
            <div class="summary-card"><strong>Safe</strong>${run.reviewSummary.safe}</div>
            <div class="summary-card"><strong>Review</strong>${run.reviewSummary.review}</div>
            <div class="summary-card"><strong>Risky</strong>${run.reviewSummary.risky}</div>
            <div class="summary-card"><strong>Unresolved Risky</strong>${run.reviewSummary.unresolvedRisky}</div>
        </div>
        <div class="tag-row">
            <span class="badge ${toBadgeClass(run.metrics.dominantFailureKind === 'unknown' ? 'warning' : run.metrics.dominantFailureKind)}">${escapeHtml(run.metrics.dominantFailureKind)}</span>
            <span class="tag">Cache ${run.trace.metadata.cacheHit ? 'hit' : 'miss'}</span>
            <span class="tag">${escapeHtml(run.trace.metadata.detectionMode)}</span>
            <span class="tag">${escapeHtml(run.trace.metadata.templateReadiness)}</span>
            <span class="tag">${escapeHtml(run.status)}</span>
            <span class="tag">Warnings ${run.progressSummary?.activeWarningCount || 0}</span>
        </div>
    `;
}

function renderTimeline() {
    const progress = getDisplayedProgressSummary();
    const stages =
        state.liveStages.length > 0 &&
        (!state.currentRun || (progress && ['running', 'stalled'].includes(progress.runStatus)))
            ? state.liveStages
            : state.currentRun?.trace?.stages || [];
    if (stages.length === 0) {
        elements.timelinePanel.className = 'empty-state';
        elements.timelinePanel.textContent = 'No trace yet.';
        return;
    }

    elements.timelinePanel.className = 'timeline-list';
    elements.timelinePanel.innerHTML = stages
        .map(
            stage => `
                <div class="timeline-item ${progress?.currentStage === stage.name ? 'current' : ''}">
                    <div class="panel-header">
                        <strong>${escapeHtml(stage.name)}</strong>
                        <span class="badge ${toBadgeClass(stage.status)}">${escapeHtml(stage.status)}</span>
                    </div>
                    <div class="timeline-meta">
                        <div><strong>Duration</strong><div>${formatDuration(stage.durationMs)}</div></div>
                        <div><strong>In</strong><div>${stage.inputCount ?? '-'}</div></div>
                        <div><strong>Out</strong><div>${stage.outputCount ?? '-'}</div></div>
                    </div>
                    ${
                        stage.warnings?.length
                            ? `<ul>${stage.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`
                            : ''
                    }
                </div>
            `
        )
        .join('');
}

function renderDiagnosis() {
    const progress = getDisplayedProgressSummary();
    if (!progress) {
        elements.diagnosisPanel.className = 'empty-state';
        elements.diagnosisPanel.textContent = 'Run detection to see bottlenecks, slowest stage, and stall diagnosis.';
        return;
    }

    elements.diagnosisPanel.className = '';
    elements.diagnosisPanel.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card"><strong>Run Status</strong>${escapeHtml(progress.runStatus)}</div>
            <div class="summary-card"><strong>Current Stage</strong>${escapeHtml(progress.currentStage || 'idle')}</div>
            <div class="summary-card"><strong>Slowest Stage</strong>${escapeHtml(progress.slowestStage?.name || 'n/a')}</div>
            <div class="summary-card"><strong>Slowest Duration</strong>${formatDuration(progress.slowestStage?.durationMs || 0)}</div>
        </div>
        <div class="tag-row">
            <span class="tag">Stalled: ${progress.stalled ? 'yes' : 'no'}</span>
            <span class="tag">Events: ${progress.eventCount}</span>
            <span class="tag">Updated: ${formatTimestamp(progress.updatedAt)}</span>
        </div>
        <div style="margin-top: 12px;">
            <strong>Diagnosis</strong>
            <div>${escapeHtml(progress.currentDiagnosis?.message || 'No active diagnosis')}</div>
        </div>
    `;
}

function renderLogs() {
    const logs = getDisplayedLogs();
    if (logs.length === 0) {
        elements.logPanel.className = 'empty-state';
        elements.logPanel.textContent = 'Live runtime and CV logs will appear here while a run is active.';
        return;
    }

    const filteredLogs = getFilteredLogs();

    if (filteredLogs.length === 0) {
        elements.logPanel.className = 'empty-state';
        elements.logPanel.textContent = 'No logs match the current filter.';
        return;
    }

    elements.logPanel.className = 'log-list';
    elements.logPanel.innerHTML = filteredLogs
        .map(
            log => `
                <div class="log-entry ${escapeHtml(log.level)}">
                    <div class="log-entry-header">
                        <span class="badge ${toBadgeClass(log.level === 'error' ? 'bad' : log.level === 'warn' ? 'warn' : 'neutral')}">${escapeHtml(log.level)}</span>
                        <strong>${escapeHtml(log.source)}</strong>
                        <span class="log-entry-meta">${escapeHtml(log.operation || log.stage || 'event')}</span>
                        <span class="log-entry-meta">${escapeHtml(formatTimestamp(log.timestamp))}</span>
                    </div>
                    <div>${escapeHtml(log.message)}</div>
                    ${
                        log.metadata && Object.keys(log.metadata).length
                            ? `<pre>${escapeHtml(JSON.stringify(log.metadata, null, 2))}</pre>`
                            : ''
                    }
                </div>
            `
        )
        .join('');

    if (!elements.logPauseAutoscroll.checked) {
        elements.logPanel.scrollTop = elements.logPanel.scrollHeight;
    }
}

function renderReviewQueue() {
    const run = state.currentRun;
    if (!run) {
        elements.reviewQueue.className = 'empty-state';
        elements.reviewQueue.textContent = 'Risky and review-needed slots will appear here after a run.';
        return;
    }

    const reviewSlots = run.trace.slots
        .map(slot => ({ slot, level: getReviewLevel(slot) }))
        .filter(entry => entry.level !== 'safe');

    if (reviewSlots.length === 0) {
        elements.reviewQueue.className = 'empty-state';
        elements.reviewQueue.textContent = 'All traced slots are currently in the safe bucket.';
        return;
    }

    elements.reviewQueue.className = 'review-list';
    elements.reviewQueue.innerHTML = reviewSlots
        .map(
            ({ slot, level }) => `
                <div class="review-item">
                    <div class="panel-header">
                        <strong>${escapeHtml(slot.finalDetection?.itemName || slot.slotId)}</strong>
                        <span class="badge ${toBadgeClass(level)}">${escapeHtml(level)}</span>
                    </div>
                    <div>${escapeHtml(slot.notes?.join(', ') || 'No notes')}</div>
                    <button data-slot-focus="${escapeHtml(slot.slotId)}">Inspect Slot</button>
                </div>
            `
        )
        .join('');
}

function renderSlotList() {
    const run = state.currentRun;
    if (!run) {
        elements.slotList.className = 'slot-list empty-state';
        elements.slotList.textContent = 'No slots yet.';
        return;
    }

    elements.slotList.className = 'slot-list';
    elements.slotList.innerHTML = run.trace.slots
        .map(slot => {
            const reviewLevel = getReviewLevel(slot);
            return `
                <div class="slot-item ${slot.slotId === state.selectedSlotId ? 'active' : ''}">
                    <div class="panel-header">
                        <strong>${escapeHtml(slot.finalDetection?.itemName || slot.slotId)}</strong>
                        <span class="badge ${toBadgeClass(reviewLevel)}">${escapeHtml(reviewLevel)}</span>
                    </div>
                    <div class="slot-meta">
                        <div><strong>Status</strong><div>${escapeHtml(slot.status)}</div></div>
                        <div><strong>Confidence</strong><div>${formatPercent(slot.finalDetection?.confidence || 0)}</div></div>
                        <div><strong>Candidates</strong><div>${slot.candidateCount}</div></div>
                    </div>
                    <button data-slot-focus="${escapeHtml(slot.slotId)}">Focus</button>
                </div>
            `;
        })
        .join('');
}

function makeSlotCrop(slot) {
    if (!state.currentImageDataUrl || !elements.sourceImage.naturalWidth) {
        return '';
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(slot.bounds.width));
    canvas.height = Math.max(1, Math.round(slot.bounds.height));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
        elements.sourceImage,
        slot.bounds.x,
        slot.bounds.y,
        slot.bounds.width,
        slot.bounds.height,
        0,
        0,
        canvas.width,
        canvas.height
    );
    return canvas.toDataURL('image/png');
}

function renderSlotDetail() {
    const slot = getSlotById(state.selectedSlotId);
    if (!slot) {
        elements.slotDetail.className = 'empty-state';
        elements.slotDetail.textContent = 'Select a slot from the overlay or slot inspector.';
        return;
    }

    const cropUrl = makeSlotCrop(slot);
    const action = state.currentRun.reviewActions.find(entry => entry.slotId === slot.slotId);

    elements.slotDetail.className = 'slot-detail-grid';
    elements.slotDetail.innerHTML = `
        <div class="panel-header">
            <strong>${escapeHtml(slot.finalDetection?.itemName || slot.slotId)}</strong>
            <span class="badge ${toBadgeClass(getReviewLevel(slot))}">${escapeHtml(getReviewLevel(slot))}</span>
        </div>
        ${cropUrl ? `<img class="slot-crop" src="${cropUrl}" alt="Slot crop">` : ''}
        <div class="summary-grid">
            <div class="summary-card"><strong>Status</strong>${escapeHtml(slot.status)}</div>
            <div class="summary-card"><strong>Confidence</strong>${formatPercent(slot.finalDetection?.confidence || 0)}</div>
            <div class="summary-card"><strong>Reviewed</strong>${escapeHtml(action?.action || 'no')}</div>
            <div class="summary-card"><strong>Bounds</strong>${Math.round(slot.bounds.x)}, ${Math.round(slot.bounds.y)}</div>
        </div>
        <div>
            <strong>Top Candidates</strong>
            <div class="candidate-list">
                ${
                    slot.topCandidates.length
                        ? slot.topCandidates
                              .map(
                                  candidate => `
                                    <div class="candidate-row">
                                        <span>${escapeHtml(candidate.itemName)}</span>
                                        <span>${formatPercent(candidate.confidence)}</span>
                                    </div>
                                `
                              )
                              .join('')
                        : '<div class="candidate-row">No top candidates captured.</div>'
                }
            </div>
        </div>
        <div>
            <strong>Rejected Candidates</strong>
            <div class="candidate-list">
                ${
                    slot.rejectedCandidates.length
                        ? slot.rejectedCandidates
                              .map(
                                  candidate => `
                                    <div class="candidate-row rejected">
                                        <span>${escapeHtml(candidate.itemName)} (${escapeHtml(candidate.reason)})</span>
                                        <span>${formatPercent(candidate.confidence)}</span>
                                    </div>
                                `
                              )
                              .join('')
                        : '<div class="candidate-row">No rejected candidates recorded.</div>'
                }
            </div>
        </div>
        <div>
            <strong>Notes</strong>
            <ul>${slot.notes.map(note => `<li>${escapeHtml(note)}</li>`).join('') || '<li>None</li>'}</ul>
        </div>
        <div class="slot-actions">
            <div class="button-row">
                <button data-slot-action="verified">Mark Correct</button>
                <button data-slot-action="empty">Mark Empty</button>
                <button data-slot-action="flagged">Flag</button>
            </div>
            <label>
                <span>Correct To</span>
                <input id="slot-correction-input" list="item-options" placeholder="Search an item name">
            </label>
            <button data-slot-action="corrected" class="primary">Apply Correction</button>
        </div>
    `;
}

function renderHistory() {
    if (state.sessions.length === 0) {
        elements.historyPanel.className = 'empty-state';
        elements.historyPanel.textContent = 'Saved session bundles will appear here.';
        return;
    }

    const summary = summarizeSessions(state.sessions);
    elements.historyPanel.className = '';
    elements.historyPanel.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card"><strong>Stored Runs</strong>${summary.count}</div>
            <div class="summary-card"><strong>Avg F1</strong>${formatPercent(summary.avgF1)}</div>
            <div class="summary-card"><strong>Avg Precision</strong>${formatPercent(summary.avgPrecision)}</div>
            <div class="summary-card"><strong>Avg Recall</strong>${formatPercent(summary.avgRecall)}</div>
        </div>
        <div class="history-list">
            ${state.sessions
                .slice(0, 12)
                .map(
                    session => `
                        <div class="history-item">
                            <div class="panel-header">
                                <strong>${escapeHtml(session.imageName)}</strong>
                                <span class="badge ${toBadgeClass(session.metrics.dominantFailureKind)}">${escapeHtml(session.metrics.dominantFailureKind)}</span>
                            </div>
                            <div>${new Date(session.createdAt).toLocaleString()}</div>
                            <div>F1 ${formatPercent(session.metrics.f1)} • ${escapeHtml(session.trace.metadata.detectionMode)} • ${escapeHtml(session.status || session.progressSummary?.runStatus || 'completed')}</div>
                            <div class="button-row">
                                <button data-load-run="${escapeHtml(session.runId)}">Load</button>
                                <button data-delete-run="${escapeHtml(session.runId)}">Delete</button>
                            </div>
                        </div>
                    `
                )
                .join('')}
        </div>
    `;
}

function renderCompare() {
    if (!state.compareLeft || !state.compareRight) {
        elements.comparePanel.className = 'empty-state';
        elements.comparePanel.textContent = 'Pick two stored runs to compare stage deltas, metrics, and slot changes.';
        return;
    }

    const left = getSessionById(state.compareLeft);
    const right = getSessionById(state.compareRight);
    if (!left || !right) {
        elements.comparePanel.className = 'empty-state';
        elements.comparePanel.textContent = 'One of the selected runs is no longer available.';
        return;
    }

    const stageNames = Array.from(
        new Set([...left.trace.stages.map(stage => stage.name), ...right.trace.stages.map(stage => stage.name)])
    );
    const leftSlotMap = new Map(left.trace.slots.map(slot => [slot.slotId, slot.finalDetection?.itemName || '']));
    const rightSlotMap = new Map(right.trace.slots.map(slot => [slot.slotId, slot.finalDetection?.itemName || '']));
    let slotDiffs = 0;
    const allSlotIds = new Set([...leftSlotMap.keys(), ...rightSlotMap.keys()]);
    for (const slotId of allSlotIds) {
        if ((leftSlotMap.get(slotId) || '') !== (rightSlotMap.get(slotId) || '')) {
            slotDiffs++;
        }
    }

    elements.comparePanel.className = '';
    elements.comparePanel.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card"><strong>F1 Delta</strong>${((right.metrics.f1 - left.metrics.f1) * 100).toFixed(1)} pts</div>
            <div class="summary-card"><strong>Precision Delta</strong>${((right.metrics.precision - left.metrics.precision) * 100).toFixed(1)} pts</div>
            <div class="summary-card"><strong>Recall Delta</strong>${((right.metrics.recall - left.metrics.recall) * 100).toFixed(1)} pts</div>
            <div class="summary-card"><strong>Slot Changes</strong>${slotDiffs}</div>
        </div>
        <div class="tag-row" style="margin-bottom: 12px;">
            <span class="tag">Warning Delta: ${(right.progressSummary?.activeWarningCount || 0) - (left.progressSummary?.activeWarningCount || 0)}</span>
            <span class="tag">Diagnosis: ${escapeHtml(left.progressSummary?.currentDiagnosis?.diagnosis || 'none')} -> ${escapeHtml(right.progressSummary?.currentDiagnosis?.diagnosis || 'none')}</span>
        </div>
        <div class="compare-grid">
            ${stageNames
                .map(name => {
                    const leftStage = left.trace.stages.find(stage => stage.name === name);
                    const rightStage = right.trace.stages.find(stage => stage.name === name);
                    const delta = (rightStage?.durationMs || 0) - (leftStage?.durationMs || 0);
                    return `
                        <div class="compare-card">
                            <strong>${escapeHtml(name)}</strong>
                            <div>Left: ${formatDuration(leftStage?.durationMs || 0)}</div>
                            <div>Right: ${formatDuration(rightStage?.durationMs || 0)}</div>
                            <div>Delta: ${formatDuration(delta)}</div>
                        </div>
                    `;
                })
                .join('')}
        </div>
    `;
}

function renderBatch() {
    if (state.batchRuns.length === 0) {
        elements.batchPanel.className = 'empty-state';
        elements.batchPanel.textContent =
            'Batch runs use the same authoritative runtime and store every session bundle for analytics/performance pages.';
        return;
    }

    const summary = summarizeSessions(state.batchRuns);
    elements.batchPanel.className = '';
    elements.batchPanel.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card"><strong>Images</strong>${summary.count}</div>
            <div class="summary-card"><strong>Avg F1</strong>${formatPercent(summary.avgF1)}</div>
            <div class="summary-card"><strong>Avg Precision</strong>${formatPercent(summary.avgPrecision)}</div>
            <div class="summary-card"><strong>Avg Recall</strong>${formatPercent(summary.avgRecall)}</div>
        </div>
        <table class="batch-table">
            <thead>
                <tr>
                    <th>Image</th>
                    <th>F1</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>Failure</th>
                </tr>
            </thead>
            <tbody>
                ${state.batchRuns
                    .map(
                        run => `
                            <tr>
                                <td>${escapeHtml(run.imageName)}</td>
                                <td>${formatPercent(run.metrics.f1)}</td>
                                <td>${formatPercent(run.metrics.precision)}</td>
                                <td>${formatPercent(run.metrics.recall)}</td>
                                <td>${escapeHtml(run.metrics.dominantFailureKind)}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

function renderAll() {
    renderRuntimeStatus();
    renderLiveStatus();
    renderImage();
    renderPreflight();
    renderSummary();
    renderTimeline();
    renderDiagnosis();
    renderLogs();
    renderReviewQueue();
    renderSlotList();
    renderSlotDetail();
    renderHistory();
    renderCompare();
    renderBatch();
    requestAnimationFrame(drawOverlay);
}

async function persistCurrentRun(run = state.currentRun) {
    const runToPersist = run || state.currentRun;
    if ((!runToPersist && !state.activeRunId) || !state.runtimeModule) {
        return;
    }
    const runId = runToPersist?.runId || state.activeRunId;
    const bundle = state.runtimeModule.exportSessionBundle(runId);
    await saveSessionBundle(bundle);
    state.sessions = await listSessionBundles();
    syncCompareOptions();
}

function syncCompareOptions() {
    const optionsHtml = ['<option value="">Select run</option>']
        .concat(
            state.sessions.map(
                session =>
                    `<option value="${escapeHtml(session.runId)}">${escapeHtml(session.imageName)} • ${formatPercent(session.metrics.f1)}</option>`
            )
        )
        .join('');
    elements.compareLeft.innerHTML = optionsHtml;
    elements.compareRight.innerHTML = optionsHtml;

    if (!state.compareLeft && state.sessions[0]) {
        state.compareLeft = state.sessions[0].runId;
    }
    if (!state.compareRight && state.sessions[1]) {
        state.compareRight = state.sessions[1].runId;
    }

    elements.compareLeft.value = state.compareLeft || '';
    elements.compareRight.value = state.compareRight || '';
}

async function loadImageSelection(imagePath) {
    if (!imagePath) {
        state.currentImagePath = '';
        state.currentImageName = '';
        state.currentImageDataUrl = '';
        state.currentPreflight = null;
        state.currentRun = null;
        resetLiveRunState();
        state.selectedSlotId = '';
        renderAll();
        return;
    }

    setBusy('Loading image...');
    try {
        resetLiveRunState();
        state.currentImagePath = imagePath;
        state.currentImageName = imagePath.split('/').pop();
        state.currentImageDataUrl = await imageUrlToDataUrl(imagePath);
        state.currentRun = null;
        state.selectedSlotId = '';
        state.currentPreflight = null;
        renderAll();

        if (state.runtimeStatus?.initialized && state.runtimeModule) {
            state.currentPreflight = await state.runtimeModule.runPreflight(state.currentImageDataUrl);
        }
        renderAll();
    } finally {
        setBusy('');
    }
}

async function runCurrentDetection() {
    if (!state.currentImageDataUrl) {
        return;
    }

    setBusy('Running detection...');
    try {
        resetLiveRunState();
        state.currentRun = null;
        renderAll();
        const run = await state.runtimeModule.runDetectionWithTrace({
            imageDataUrl: state.currentImageDataUrl,
            imageName: state.currentImageName,
            imagePath: state.currentImagePath || undefined,
            groundTruthItems: state.currentImagePath ? getGroundTruthItems(state.currentImagePath) : [],
            pipelineConfig: currentPipelineConfig(),
        });
        state.currentRun = run;
        state.activeRunId = run.runId;
        state.currentPreflight = run.preflight;
        state.selectedSlotId = run.trace.slots[0]?.slotId || '';
        await persistCurrentRun(run);
        renderAll();
    } finally {
        setBusy('');
    }
}

async function runBatch() {
    const imagePaths = Object.keys(state.groundTruth).filter(key => !key.startsWith('_'));
    if (imagePaths.length === 0) {
        return;
    }

    state.batchRuns = [];
    setBusy('Running batch...');
    try {
        for (const imagePath of imagePaths) {
            const imageDataUrl = await imageUrlToDataUrl(imagePath);
            const run = await state.runtimeModule.runDetectionWithTrace({
                imageDataUrl,
                imageName: imagePath.split('/').pop(),
                imagePath,
                groundTruthItems: getGroundTruthItems(imagePath),
                pipelineConfig: currentPipelineConfig(),
            });
            state.batchRuns.push(run);
            await persistCurrentRun(run);
            renderBatch();
        }
    } finally {
        setBusy('');
        renderAll();
    }
}

async function applyReviewAction(action) {
    if (!state.currentRun || !state.selectedSlotId) {
        return;
    }

    let payload = {
        slotId: state.selectedSlotId,
        action,
        createdAt: new Date().toISOString(),
    };

    if (action === 'corrected') {
        const input = document.getElementById('slot-correction-input');
        const itemName = input?.value?.trim();
        if (!itemName) {
            return;
        }
        const matchedItem = state.itemLookup.get(itemName.toLowerCase());
        payload = {
            ...payload,
            itemId: matchedItem?.id,
            itemName,
        };
    }

    state.currentRun = state.runtimeModule.applyReviewActions(state.currentRun.runId, [payload]);
    await persistCurrentRun(state.currentRun);
    renderAll();
}

async function importBundle(file) {
    const bundle = JSON.parse(await file.text());
    const run = state.runtimeModule.importSessionBundle(bundle);
    resetLiveRunState();
    state.currentRun = run;
    state.currentPreflight = run.preflight;
    state.currentImageDataUrl = run.sourceImageDataUrl;
    state.currentImageName = run.imageName;
    state.currentImagePath = run.imagePath || '';
    state.selectedSlotId = run.trace.slots[0]?.slotId || '';
    await saveSessionBundle(bundle);
    state.sessions = await listSessionBundles();
    syncCompareOptions();
    renderAll();
}

async function bootstrap() {
    elements.thresholdValue.textContent = Number(elements.thresholdInput.value).toFixed(2);
    const [runtimeResult, groundTruthResult, itemsDataResult, sessionsResult] = await Promise.allSettled([
        ensureRuntime(),
        loadJson('./ground-truth.json'),
        loadJson(`${DATA_BASE_PATH}/items.json`),
        listSessionBundles(),
    ]);

    if (groundTruthResult.status === 'fulfilled') {
        state.groundTruth = groundTruthResult.value;
    }

    if (itemsDataResult.status === 'fulfilled') {
        state.items = itemsDataResult.value.items || [];
        state.itemLookup.clear();
        state.items.forEach(item => state.itemLookup.set(item.name.toLowerCase(), item));
    }

    if (sessionsResult.status === 'fulfilled') {
        state.sessions = sessionsResult.value;
    }

    renderImageOptions();
    populateItemOptions();
    syncCompareOptions();

    if (runtimeResult.status === 'rejected') {
        state.runtimeStatus = {
            ...(state.runtimeStatus || {}),
            initialized: false,
            lastError: runtimeResult.reason?.message || String(runtimeResult.reason),
        };
    }

    const requestedImage = new URLSearchParams(window.location.search).get('image');
    if (requestedImage && state.groundTruth[requestedImage]) {
        elements.imageSelect.value = requestedImage;
        await loadImageSelection(requestedImage);
        return;
    }

    renderAll();
}

elements.thresholdInput.addEventListener('input', () => {
    elements.thresholdValue.textContent = Number(elements.thresholdInput.value).toFixed(2);
});

elements.imageSelect.addEventListener('change', event => {
    loadImageSelection(event.target.value).catch(error => {
        state.runtimeStatus.lastError = error.message;
        renderRuntimeStatus();
    });
});

elements.uploadImageBtn.addEventListener('click', () => elements.uploadImageInput.click());
elements.uploadImageInput.addEventListener('change', async event => {
    const [file] = event.target.files || [];
    if (!file) return;
    setBusy('Loading upload...');
    try {
        resetLiveRunState();
        state.currentImagePath = '';
        state.currentImageName = file.name;
        state.currentImageDataUrl = await fileToDataUrl(file);
        state.currentRun = null;
        state.selectedSlotId = '';
        state.currentPreflight = null;
        renderAll();

        if (state.runtimeStatus?.initialized && state.runtimeModule) {
            state.currentPreflight = await state.runtimeModule.runPreflight(state.currentImageDataUrl);
        }
        renderAll();
    } catch (error) {
        state.runtimeStatus = {
            ...(state.runtimeStatus || {}),
            lastError: error.message,
        };
        renderRuntimeStatus();
    } finally {
        setBusy('');
        event.target.value = '';
    }
});

elements.runPreflightBtn.addEventListener('click', async () => {
    if (!state.currentImageDataUrl || !state.runtimeStatus?.initialized) return;
    setBusy('Running preflight...');
    try {
        state.currentPreflight = await state.runtimeModule.runPreflight(state.currentImageDataUrl);
        renderAll();
    } finally {
        setBusy('');
    }
});

elements.runDetectionBtn.addEventListener('click', () => {
    runCurrentDetection().catch(error => {
        if (state.activeRunId && state.runtimeModule) {
            refreshPartialRun(state.activeRunId).catch(() => {
                // Best effort partial capture.
            });
        }
        state.runtimeStatus.lastError = error.message;
        setBusy('');
        renderRuntimeStatus();
    });
});

elements.runBatchBtn.addEventListener('click', () => {
    runBatch().catch(error => {
        state.runtimeStatus.lastError = error.message;
        setBusy('');
        renderRuntimeStatus();
    });
});

elements.exportBundleBtn.addEventListener('click', () => {
    const runId = state.currentRun?.runId || state.activeRunId;
    if (!runId || !state.runtimeModule) return;
    const bundle = state.runtimeModule.exportSessionBundle(runId);
    downloadJson(
        `${(state.currentRun?.imageName || state.currentImageName || 'validator-run').replace(/\.[^.]+$/, '')}-${runId}.json`,
        bundle
    );
});

elements.importBundleBtn.addEventListener('click', () => elements.importBundleInput.click());
elements.importBundleInput.addEventListener('change', async event => {
    const [file] = event.target.files || [];
    if (!file) return;
    await importBundle(file);
    event.target.value = '';
});

elements.clearHistoryBtn.addEventListener('click', async () => {
    await clearSessionBundles();
    state.sessions = [];
    state.compareLeft = '';
    state.compareRight = '';
    syncCompareOptions();
    renderAll();
});

elements.logFilter.addEventListener('change', event => {
    state.logFilter = event.target.value;
    renderLogs();
});

elements.logSearch.addEventListener('input', event => {
    state.logSearch = event.target.value.trim();
    renderLogs();
});

elements.copyLogBtn.addEventListener('click', async () => {
    const logText = getFilteredLogs()
        .map(log => `[${formatTimestamp(log.timestamp)}] [${log.level}] [${log.source}] ${log.message}`)
        .join('\n');
    if (!logText) return;
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(logText);
    }
});

elements.exportLogBtn.addEventListener('click', () => {
    const logPayload = getFilteredLogs();
    if (logPayload.length === 0) return;
    downloadJson(
        `${(state.currentRun?.imageName || state.currentImageName || 'validator-logs').replace(/\.[^.]+$/, '')}-logs.json`,
        logPayload
    );
});

elements.compareLeft.addEventListener('change', event => {
    state.compareLeft = event.target.value;
    renderCompare();
});

elements.compareRight.addEventListener('change', event => {
    state.compareRight = event.target.value;
    renderCompare();
});

elements.compareBtn.addEventListener('click', renderCompare);

elements.reviewQueue.addEventListener('click', event => {
    const button = event.target.closest('[data-slot-focus]');
    if (!button) return;
    state.selectedSlotId = button.dataset.slotFocus;
    renderAll();
});

elements.slotList.addEventListener('click', event => {
    const button = event.target.closest('[data-slot-focus]');
    if (!button) return;
    state.selectedSlotId = button.dataset.slotFocus;
    renderAll();
});

elements.slotDetail.addEventListener('click', event => {
    const button = event.target.closest('[data-slot-action]');
    if (!button) return;
    applyReviewAction(button.dataset.slotAction).catch(error => {
        state.runtimeStatus.lastError = error.message;
        renderRuntimeStatus();
    });
});

elements.historyPanel.addEventListener('click', async event => {
    const loadButton = event.target.closest('[data-load-run]');
    if (loadButton) {
        const session = getSessionById(loadButton.dataset.loadRun);
        if (!session) return;
        const run = state.runtimeModule.importSessionBundle(session);
        resetLiveRunState();
        state.currentRun = run;
        state.currentPreflight = run.preflight;
        state.currentImageDataUrl = run.sourceImageDataUrl;
        state.currentImageName = run.imageName;
        state.currentImagePath = run.imagePath || '';
        state.selectedSlotId = run.trace.slots[0]?.slotId || '';
        renderAll();
        return;
    }

    const deleteButton = event.target.closest('[data-delete-run]');
    if (deleteButton) {
        await deleteSessionBundle(deleteButton.dataset.deleteRun);
        state.sessions = await listSessionBundles();
        syncCompareOptions();
        renderAll();
    }
});

elements.overlayCanvas.addEventListener('click', event => {
    if (!state.currentRun || !elements.sourceImage.naturalWidth) return;
    const rect = elements.overlayCanvas.getBoundingClientRect();
    const scaleX = elements.sourceImage.naturalWidth / rect.width;
    const scaleY = elements.sourceImage.naturalHeight / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    const slot = state.currentRun.trace.slots.find(
        candidate =>
            clickX >= candidate.bounds.x &&
            clickX <= candidate.bounds.x + candidate.bounds.width &&
            clickY >= candidate.bounds.y &&
            clickY <= candidate.bounds.y + candidate.bounds.height
    );

    if (!slot) return;
    state.selectedSlotId = slot.slotId;
    renderAll();
});

bootstrap();
