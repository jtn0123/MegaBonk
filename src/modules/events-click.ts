// ========================================
// Click Event Handlers
// Extracted from events-core.ts for modularity
// ========================================

import { ToastManager } from './toast.ts';
import { logger } from './logger.ts';
import { openDetailModal } from './modal.ts';
import { toggleFavorite } from './favorites.ts';
import { type TabName } from './store.ts';
import { normalizeEntityType, type EntityType } from '../types/index.ts';

/**
 * Handle View Details button click
 */
export function handleViewDetailsClick(target: HTMLElement): void {
    const type = target.dataset.type as EntityType | undefined;
    const id = target.dataset.id;
    if (type && id) openDetailModal(type, id);
}

/**
 * Handle item card click to open detail modal
 */
export function handleCardClick(target: HTMLElement): void {
    const card = target.closest<HTMLElement>('.item-card');
    if (!card) return;

    const entityType = card.dataset.entityType as EntityType | undefined;
    const entityId = card.dataset.entityId;

    if (entityType && entityId) {
        const type = normalizeEntityType(entityType);
        if (type) openDetailModal(type, entityId);
    }
}

/**
 * Handle compare checkbox click with debouncing
 */
export function handleCompareCheckboxClick(e: MouseEvent, target: Element): void {
    const label = target.closest('.compare-checkbox-label') as HTMLElement;
    const checkbox = label?.querySelector<HTMLInputElement>('.compare-checkbox') ?? null;
    if (!checkbox) return;

    const now = Date.now();
    const lastToggle = Number.parseInt(checkbox.dataset.lastToggle || '0', 10);
    if (now - lastToggle < 100) return;
    checkbox.dataset.lastToggle = now.toString();

    const id = checkbox.dataset.id || checkbox.value;
    if (id) {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        import('./compare.ts')
            .then(({ toggleCompareItem }) => toggleCompareItem(id))
            .catch(err =>
                logger.warn({ operation: 'import.compare', error: { name: 'ImportError', message: err.message } })
            );
    }
}

/**
 * Handle remove from comparison button click
 */
export function handleRemoveCompareClick(target: Element): void {
    const btn = target.classList.contains('remove-compare-btn')
        ? (target as HTMLElement)
        : target.closest<HTMLElement>('.remove-compare-btn');
    const id = btn?.dataset.removeId;
    if (id) {
        import('./compare.ts')
            .then(({ toggleCompareItem, updateCompareDisplay }) => {
                toggleCompareItem(id);
                updateCompareDisplay();
            })
            .catch(err =>
                logger.warn({ operation: 'import.compare', error: { name: 'ImportError', message: err.message } })
            );
    }
}

/**
 * Handle breakpoint card click for quick calc
 */
export function handleBreakpointCardClick(target: Element): void {
    const card = target.closest<HTMLElement>('.breakpoint-card');
    const itemId = card?.dataset.item;
    const targetVal = card?.dataset.target;
    if (itemId && targetVal) {
        const parsedTarget = Number.parseInt(targetVal, 10);
        if (!Number.isNaN(parsedTarget)) {
            import('./calculator.ts')
                .then(({ quickCalc }) => quickCalc(itemId, parsedTarget))
                .catch(err =>
                    logger.warn({
                        operation: 'import.calculator',
                        error: { name: 'ImportError', message: err.message },
                    })
                );
        }
    }
}

/**
 * Handle favorite button click
 */
export function handleFavoriteClick(target: Element): void {
    const btn = (
        target.classList.contains('favorite-btn') ? target : target.closest('.favorite-btn')
    ) as HTMLButtonElement | null;
    const tabName = btn?.dataset.tab as TabName | undefined;
    const itemId = btn?.dataset.id;

    const isEntityTab = (tab: TabName | undefined): tab is EntityType => {
        return tab === 'items' || tab === 'weapons' || tab === 'tomes' || tab === 'characters' || tab === 'shrines';
    };

    if (btn && tabName && isEntityTab(tabName) && itemId && typeof toggleFavorite === 'function') {
        const nowFavorited = toggleFavorite(tabName, itemId);
        btn.classList.toggle('favorited', nowFavorited);
        btn.textContent = nowFavorited ? '⭐' : '☆';
        btn.title = nowFavorited ? 'Remove from favorites' : 'Add to favorites';
        btn.setAttribute('aria-label', nowFavorited ? 'Remove from favorites' : 'Add to favorites');
        if (ToastManager !== undefined) {
            ToastManager.success(nowFavorited ? 'Added to favorites' : 'Removed from favorites');
        }
    }
}
