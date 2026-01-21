/* ========================================
 * CV Validator - Image Modal
 * Full-size image viewer with overlay
 * ======================================== */

import { CONFIG, CSS_CLASSES } from './config.js';
import { state } from './state.js';
import { detectGridPositions } from './cv-detection.js';

// DOM element references
let elements = {};
let onSlotClick = null;
let getSlotFilter = null;

// ========================================
// Initialization
// ========================================

export function initImageModal(domElements, callbacks) {
    elements = domElements;
    onSlotClick = callbacks.onSlotClick;
    getSlotFilter = callbacks.getSlotFilter;

    // Close modal on Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && elements.modal.classList.contains(CSS_CLASSES.SHOW)) {
            closeImageModal();
        }
    });

    // Close modal when clicking outside the image
    elements.modal.addEventListener('click', e => {
        if (e.target === elements.modal || e.target === elements.content) {
            closeImageModal();
        }
    });

    // Prevent closing when clicking on the image itself
    elements.img.addEventListener('click', e => {
        e.stopPropagation();
    });

    // Modal overlay click handler for slot selection
    elements.overlay.addEventListener('click', handleOverlayClick);
}

// ========================================
// Open/Close Modal
// ========================================

export function openImageModal(screenshotSrc) {
    if (!screenshotSrc || screenshotSrc === window.location.href) return;

    // Show loading state
    elements.loading.classList.remove(CSS_CLASSES.HIDDEN);

    elements.img.src = screenshotSrc;
    elements.title.textContent = state.currentImagePath || 'Screenshot';

    // Wait for image to load then setup overlay
    elements.img.onload = () => {
        elements.loading.classList.add(CSS_CLASSES.HIDDEN);
        state.currentZoom = 1;
        updateModalZoom();
        drawModalOverlay();
    };

    // Handle cached images - onload won't fire if already loaded
    if (elements.img.complete && elements.img.naturalWidth) {
        elements.loading.classList.add(CSS_CLASSES.HIDDEN);
        state.currentZoom = 1;
        updateModalZoom();
        drawModalOverlay();
    }

    elements.modal.classList.add(CSS_CLASSES.SHOW);
    document.body.style.overflow = 'hidden';
}

export function closeImageModal() {
    elements.modal.classList.remove(CSS_CLASSES.SHOW);
    document.body.style.overflow = '';
}

// ========================================
// Zoom Controls
// ========================================

export function zoomImage(delta) {
    state.currentZoom = Math.max(0.25, Math.min(4, state.currentZoom + delta));
    updateModalZoom();
}

export function resetZoom() {
    state.currentZoom = 1;
    updateModalZoom();
}

export function fitToScreen() {
    if (!elements.img.naturalWidth) return;

    const maxW = window.innerWidth - 60;
    const maxH = window.innerHeight - 120;
    const scaleW = maxW / elements.img.naturalWidth;
    const scaleH = maxH / elements.img.naturalHeight;
    state.currentZoom = Math.min(scaleW, scaleH, 1);
    updateModalZoom();
}

function updateModalZoom() {
    const w = elements.img.naturalWidth * state.currentZoom;
    const h = elements.img.naturalHeight * state.currentZoom;
    const dpr = window.devicePixelRatio || 1;

    elements.img.style.width = w + 'px';
    elements.img.style.height = h + 'px';

    // Set canvas size accounting for device pixel ratio for sharp rendering on retina displays
    elements.overlay.width = w * dpr;
    elements.overlay.height = h * dpr;
    elements.overlay.style.width = w + 'px';
    elements.overlay.style.height = h + 'px';

    elements.zoomLevel.textContent = Math.round(state.currentZoom * 100) + '%';
    drawModalOverlay();
}

// ========================================
// Modal Overlay Drawing
// ========================================

export function drawModalOverlay() {
    const ctx = elements.overlay.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, elements.overlay.width, elements.overlay.height);

    // Scale context for device pixel ratio (sharp rendering on retina displays)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Make modal canvas clickable
    elements.overlay.classList.add(CSS_CLASSES.CLICKABLE);

    const scale = state.currentZoom;
    const slotFilter = getSlotFilter ? getSlotFilter() : null;

    // Draw grid positions with slot numbers
    if (state.currentImage) {
        const gridPositions = detectGridPositions(state.currentImage.width, state.currentImage.height);

        // Draw grid overlay with modal-specific options
        for (const pos of gridPositions) {
            // Skip slots not in filter
            if (slotFilter && !slotFilter.has(pos.slotIndex)) continue;

            const x = pos.x * scale;
            const y = pos.y * scale;
            const w = pos.width * scale;
            const h = pos.height * scale;

            const slotData = state.detectionsBySlot.get(pos.slotIndex);
            const correction = state.corrections.get(pos.slotIndex);

            // Different styling based on state
            if (correction) {
                if (correction.verified) {
                    ctx.strokeStyle = '#4ade80';
                } else {
                    ctx.strokeStyle = '#06b6d4';
                }
                ctx.lineWidth = 2 * scale;
            } else if (slotData) {
                const hue = Math.round(slotData.detection.confidence * 120);
                ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
                ctx.lineWidth = 2 * scale;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
            }
            ctx.strokeRect(x, y, w, h);

            // Draw slot number
            const slotNumW = CONFIG.SLOT_BADGE_SIZE.w * scale;
            const slotNumH = CONFIG.SLOT_BADGE_SIZE.h * scale;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x, y, slotNumW, slotNumH);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = `${9 * scale}px sans-serif`;
            ctx.fillText(pos.slotIndex.toString(), x + 2 * scale, y + 9 * scale);
        }
    }

    // Draw detection labels
    const labelH = CONFIG.MODAL_LABEL_HEIGHT;
    for (const d of state.lastDetections) {
        const pos = d.position;
        const correction = state.corrections.get(pos.slotIndex);

        if (correction) continue; // Corrected items drawn separately
        // Skip slots not in filter
        if (slotFilter && !slotFilter.has(pos.slotIndex)) continue;

        const x = pos.x * scale;
        const y = pos.y * scale;
        const w = pos.width * scale;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x, y - labelH * scale, w, labelH * scale);
        ctx.fillStyle = '#fff';
        ctx.font = `${12 * scale}px sans-serif`;
        ctx.fillText(`${d.item.name} ${(d.confidence * 100).toFixed(0)}%`, x + 3 * scale, y - 4 * scale);
    }

    // Draw corrected/verified slot labels
    for (const [slotIndex, correction] of state.corrections) {
        // Skip slots not in filter
        if (slotFilter && !slotFilter.has(slotIndex)) continue;

        const slotData = state.detectionsBySlot.get(slotIndex);
        if (!slotData) continue;

        const pos = slotData.position;
        const x = pos.x * scale;
        const y = pos.y * scale;
        const w = pos.width * scale;

        if (correction.verified) {
            ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
            ctx.fillRect(x, y - labelH * scale, w, labelH * scale);
            ctx.fillStyle = '#000';
            ctx.font = `bold ${12 * scale}px sans-serif`;
            ctx.fillText(`\u2713 ${correction.corrected.slice(0, 8)}`, x + 3 * scale, y - 4 * scale);
        } else {
            ctx.fillStyle = 'rgba(6, 182, 212, 0.8)';
            ctx.fillRect(x, y - labelH * scale, w, labelH * scale);
            ctx.fillStyle = '#000';
            ctx.font = `bold ${12 * scale}px sans-serif`;
            const label = correction.corrected ? correction.corrected.slice(0, 10) : '(empty)';
            ctx.fillText(label, x + 3 * scale, y - 4 * scale);
        }
    }

    // Reset transform for future operations
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ========================================
// Overlay Click Handler
// ========================================

function handleOverlayClick(e) {
    e.stopPropagation(); // Don't close modal

    if (!state.currentImage || state.detectionsBySlot.size === 0) return;

    const rect = elements.overlay.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaleX = elements.overlay.width / rect.width / dpr;
    const scaleY = elements.overlay.height / rect.height / dpr;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Convert to image coordinates
    const x = clickX / state.currentZoom;
    const y = clickY / state.currentZoom;

    // Find which slot was clicked
    for (const [slotIndex, slotData] of state.detectionsBySlot) {
        const pos = slotData.position;
        if (x >= pos.x && x <= pos.x + pos.width && y >= pos.y && y <= pos.y + pos.height) {
            closeImageModal();
            if (onSlotClick) onSlotClick(slotIndex);
            return;
        }
    }
}

// Export check for modal visibility
export function isModalOpen() {
    return elements.modal?.classList.contains(CSS_CLASSES.SHOW);
}
