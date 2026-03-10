import type { Item } from '../types/index.ts';
import { findUncertainDetections, getCurrentSession, type DetectionForFeedback } from './computer-vision.ts';
import { extractCropFromImage } from './cv/training-feedback.ts';
import type { DisplayDetectionResult } from './scan-build-results.ts';
import { escapeHtml } from './utils.ts';

export interface ScanCorrection {
    detectedItemId: string;
    detectedItemName: string;
    correctedItemId: string;
    correctedItemName: string;
    confidence: number;
    count: number;
    crop?: { x: number; y: number; width: number; height: number; dataUrl?: string };
    sourceSessionStartedAt?: string;
}

interface OpenScanCorrectionModalOptions {
    detection: DisplayDetectionResult;
    allItems: Item[];
    imageDataUrl: string;
    onSubmit: (correction: ScanCorrection) => Promise<void> | void;
    onClose?: () => void;
}

function removeExistingModal(): void {
    document.querySelector('.scan-correction-modal')?.remove();
}

function buildDetectionForFeedback(detection: DisplayDetectionResult, cropDataUrl?: string): DetectionForFeedback {
    return {
        detectedItemId: detection.entity.id,
        detectedItemName: detection.entity.name,
        confidence: detection.confidence,
        x: detection.position?.x || 0,
        y: detection.position?.y || 0,
        width: detection.position?.width || 0,
        height: detection.position?.height || 0,
        cropDataUrl,
    };
}

function renderSearchResults(
    container: HTMLElement,
    items: Item[],
    query: string,
    selectedId: string | null,
    onSelect: (item: Item) => void
): void {
    const normalized = query.trim().toLowerCase();
    const matches = items
        .filter(item => (normalized ? item.name.toLowerCase().includes(normalized) : true))
        .slice(0, 8);

    container.innerHTML = matches
        .map(
            item => `
                <button type="button" class="scan-correction-result ${selectedId === item.id ? 'is-selected' : ''}" data-item-id="${escapeHtml(item.id)}">
                    <span>${escapeHtml(item.name)}</span>
                    <span>${escapeHtml(item.rarity)}</span>
                </button>
            `
        )
        .join('');

    container.querySelectorAll<HTMLElement>('[data-item-id]').forEach(button => {
        button.addEventListener('click', () => {
            const selected = items.find(item => item.id === button.dataset.itemId);
            if (!selected) return;
            onSelect(selected);
        });
    });
}

export async function openScanCorrectionModal({
    detection,
    allItems,
    imageDataUrl,
    onSubmit,
    onClose,
}: OpenScanCorrectionModalOptions): Promise<void> {
    removeExistingModal();

    const root = document.getElementById('scan-correction-modal-root') || document.body;
    const modal = document.createElement('div');
    modal.className = 'scan-correction-modal';

    let cropDataUrl: string | undefined;
    if (detection.position) {
        try {
            cropDataUrl = await extractCropFromImage(
                imageDataUrl,
                detection.position.x,
                detection.position.y,
                detection.position.width,
                detection.position.height
            );
        } catch {
            cropDataUrl = undefined;
        }
    }

    const feedbackDetection = buildDetectionForFeedback(detection, cropDataUrl);
    const alternatives = findUncertainDetections([feedbackDetection], 1)[0]?.alternatives ?? [];
    let selectedItem: Item | null = alternatives[0] || null;

    const session = getCurrentSession();
    const previewHtml = cropDataUrl
        ? `<img src="${cropDataUrl}" alt="Detected crop preview" loading="lazy" />`
        : '<div class="scan-correction-preview-empty">No crop preview available for this detection.</div>';

    modal.innerHTML = `
        <div class="scan-correction-dialog" role="dialog" aria-modal="true" aria-labelledby="scan-correction-title">
            <div class="scan-correction-header">
                <div>
                    <h4 id="scan-correction-title">Correct detection</h4>
                    <p>Choose the right item and the current scan will update immediately.</p>
                </div>
                <button type="button" class="scan-correction-close" aria-label="Close correction dialog">×</button>
            </div>
            <div class="scan-correction-layout">
                <div class="scan-correction-preview">
                    ${previewHtml}
                    <div class="scan-correction-detected">
                        <span>Detected item</span>
                        <strong>${escapeHtml(detection.entity.name)}</strong>
                        <span>${Math.round(detection.confidence * 100)}% confidence${detection.count && detection.count > 1 ? ` · x${detection.count}` : ''}</span>
                    </div>
                </div>
                <div class="scan-correction-form">
                    <div>
                        <strong>Likely alternatives</strong>
                        <div class="scan-correction-alternatives">
                            ${alternatives
                                .map(
                                    item => `
                                        <button type="button" class="scan-correction-choice ${selectedItem?.id === item.id ? 'is-selected' : ''}" data-alt-id="${escapeHtml(item.id)}">
                                            ${escapeHtml(item.name)}
                                        </button>
                                    `
                                )
                                .join('')}
                        </div>
                    </div>
                    <div>
                        <label for="scan-correction-search"><strong>Find any item</strong></label>
                        <input id="scan-correction-search" class="scan-correction-search" type="search" placeholder="Search all items" />
                    </div>
                    <div class="scan-correction-results" id="scan-correction-results"></div>
                    <div class="scan-correction-actions">
                        <button type="button" class="scan-correction-secondary" data-action="cancel">Cancel</button>
                        <button type="button" class="scan-correction-primary" data-action="submit" ${selectedItem ? '' : 'disabled'}>
                            Apply correction
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    root.appendChild(modal);

    const close = () => {
        modal.remove();
        onClose?.();
    };

    const searchInput = modal.querySelector<HTMLInputElement>('#scan-correction-search');
    const resultsContainer = modal.querySelector<HTMLElement>('#scan-correction-results');
    const submitButton = modal.querySelector<HTMLButtonElement>('[data-action="submit"]');

    const syncSelection = (item: Item | null) => {
        selectedItem = item;
        submitButton?.toggleAttribute('disabled', !selectedItem);
        modal.querySelectorAll<HTMLElement>('[data-alt-id]').forEach(button => {
            button.classList.toggle('is-selected', button.dataset.altId === selectedItem?.id);
        });
        if (resultsContainer) {
            renderSearchResults(
                resultsContainer,
                allItems,
                searchInput?.value || '',
                selectedItem?.id || null,
                item => {
                    syncSelection(item);
                }
            );
        }
    };

    modal.querySelectorAll<HTMLElement>('[data-alt-id]').forEach(button => {
        button.addEventListener('click', () => {
            const item = allItems.find(entry => entry.id === button.dataset.altId);
            if (!item) return;
            syncSelection(item);
        });
    });

    if (resultsContainer) {
        renderSearchResults(resultsContainer, allItems, '', selectedItem?.id || null, item => {
            syncSelection(item);
        });
    }

    searchInput?.addEventListener('input', () => {
        if (!resultsContainer) return;
        renderSearchResults(resultsContainer, allItems, searchInput.value, selectedItem?.id || null, item => {
            syncSelection(item);
        });
    });

    modal.querySelector<HTMLElement>('[data-action="cancel"]')?.addEventListener('click', close);
    modal.querySelector<HTMLElement>('.scan-correction-close')?.addEventListener('click', close);
    modal.addEventListener('click', event => {
        if (event.target === modal) {
            close();
        }
    });

    submitButton?.addEventListener('click', async () => {
        if (!selectedItem) return;

        await onSubmit({
            detectedItemId: detection.entity.id,
            detectedItemName: detection.entity.name,
            correctedItemId: selectedItem.id,
            correctedItemName: selectedItem.name,
            confidence: detection.confidence,
            count: detection.count || 1,
            crop: detection.position
                ? {
                      ...detection.position,
                      dataUrl: cropDataUrl,
                  }
                : undefined,
            sourceSessionStartedAt: session?.startedAt,
        });
        close();
    });
}
