/**
 * Dismiss the "What's New" modal if it appears.
 *
 * On CI runners localStorage is empty, so shouldShowWhatsNew() returns true
 * and a fixed overlay (z-index 1000) covers the entire viewport after ~500ms.
 * This blocks Playwright's actionability checks on tab buttons, causing
 * 60-second click timeouts on every non-default tab.
 */
export async function dismissWhatsNewModal(
    page: import('@playwright/test').Page,
): Promise<void> {
    const modal = page.locator('#whats-new-modal');
    try {
        await modal.waitFor({ state: 'visible', timeout: 2000 });
        await modal.locator('.whats-new-close').click();
        await modal.waitFor({ state: 'detached', timeout: 2000 });
    } catch {
        // Modal didn't appear — version already seen in localStorage
    }
}
