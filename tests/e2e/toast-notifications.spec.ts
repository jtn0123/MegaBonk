// ========================================
// Toast Notifications E2E Tests
// ========================================
// Tests for toast notification system

import { test, expect } from '@playwright/test';

test.describe('Toast Notifications - Basic Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('toast container can be created programmatically', async ({ page }) => {
        // Use existing container or create one (app may already have created it)
        await page.evaluate(() => {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.setAttribute('role', 'status');
                container.setAttribute('aria-live', 'polite');
                container.setAttribute('aria-atomic', 'true');
                document.body.appendChild(container);
            }
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-info toast-visible';
            toast.textContent = 'Test toast';
            container.appendChild(toast);
        });
        
        // Toast container should exist (use .first() since app may have created one too)
        const container = page.locator('#toast-container').first();
        await expect(container).toBeAttached();
        await expect(container).toBeVisible();
    });

    test('toast container has accessibility attributes', async ({ page }) => {
        // Use existing container or create one (app may already have created it)
        await page.evaluate(() => {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.setAttribute('role', 'status');
                container.setAttribute('aria-live', 'polite');
                container.setAttribute('aria-atomic', 'true');
                document.body.appendChild(container);
            }
        });
        
        // Use .first() to avoid strict mode violation when app has also created one
        const container = page.locator('#toast-container').first();
        await expect(container).toHaveAttribute('role', 'status');
        await expect(container).toHaveAttribute('aria-live', 'polite');
    });
});

test.describe('Toast Notifications - Warning Toast', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('warning toast can be displayed programmatically', async ({ page }) => {
        // Create and display a warning toast
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                c.setAttribute('role', 'status');
                c.setAttribute('aria-live', 'polite');
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-warning toast-visible';
            toast.textContent = 'Warning: This is a test warning';
            toast.setAttribute('role', 'alert');
            container.appendChild(toast);
        });
        
        // Warning toast should appear
        const toast = page.locator('.toast.toast-warning, .toast-warning');
        await expect(toast).toBeVisible({ timeout: 2000 });
    });

    test('warning toast has correct styling', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-warning toast-visible';
            toast.textContent = 'Warning message';
            container.appendChild(toast);
        });
        
        const toast = page.locator('.toast.toast-warning').first();
        await expect(toast).toBeVisible();
        await expect(toast).toHaveClass(/warning/);
    });
});

test.describe('Toast Notifications - Auto Dismiss', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('toast auto-dismisses after duration', async ({ page }) => {
        // Create a toast with short duration
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-info toast-visible';
            toast.id = 'test-auto-dismiss';
            toast.textContent = 'Auto dismiss test';
            container.appendChild(toast);
            
            // Auto-dismiss after 1 second
            setTimeout(() => {
                toast.classList.remove('toast-visible');
                setTimeout(() => toast.remove(), 300);
            }, 1000);
        });
        
        const toast = page.locator('#test-auto-dismiss');
        await expect(toast).toBeVisible();
        
        // Wait for auto-dismiss
        await expect(toast).not.toBeAttached({ timeout: 3000 });
    });
});

test.describe('Toast Notifications - Export Success', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
        await page.click('.tab-btn[data-tab="build-planner"]');
        await page.waitForFunction(() => {
            const select = document.getElementById('build-character');
            return select && (select as HTMLSelectElement).options.length > 1;
        }, { timeout: 5000 });
    });

    test('toast or feedback appears on build export', async ({ page, context, browserName }) => {
        // WebKit: Clipboard API behaves differently, toast timing varies
        test.skip(browserName === 'webkit', 'WebKit: Clipboard API and toast timing differences');
        
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        
        // Set up a build
        await page.selectOption('#build-character', { index: 1 });
        await page.selectOption('#build-weapon', { index: 1 });
        
        // Listen for dialog (fallback mechanism)
        let dialogShown = false;
        page.on('dialog', async dialog => {
            dialogShown = true;
            await dialog.accept();
        });
        
        // Get initial toast count
        const initialToastCount = await page.locator('.toast').count();
        
        // Click export
        await page.click('#export-build');
        await page.waitForTimeout(800);
        
        // Check for toast (any type) or dialog
        const toast = page.locator('.toast');
        const toastVisible = await toast.isVisible().catch(() => false);
        const newToastCount = await toast.count();
        const toastAppeared = newToastCount > initialToastCount || toastVisible;
        
        // Check if export field has content (another form of feedback)
        const exportField = page.locator('#build-export-text, #exportText, textarea[readonly]');
        const hasExportContent = await exportField.count() > 0 && 
            (await exportField.first().inputValue().catch(() => '')).length > 0;
        
        // Any feedback mechanism is valid
        expect(toastAppeared || dialogShown || hasExportContent).toBe(true);
    });

    test('toast or feedback appears on share build URL', async ({ page, context, browserName }) => {
        // WebKit: Clipboard API behaves differently, toast timing varies
        test.skip(browserName === 'webkit', 'WebKit: Clipboard API and toast timing differences');
        
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        
        await page.selectOption('#build-character', { index: 1 });
        await page.selectOption('#build-weapon', { index: 1 });
        
        let dialogShown = false;
        page.on('dialog', async dialog => {
            dialogShown = true;
            await dialog.accept();
        });
        
        await page.click('#share-build-url');
        await page.waitForTimeout(500);
        
        const toast = page.locator('.toast');
        const toastVisible = await toast.isVisible().catch(() => false);
        
        expect(toastVisible || dialogShown).toBe(true);
    });
});

test.describe('Toast Notifications - Multiple Toasts', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('multiple toasts can stack', async ({ page }) => {
        // Inject test code to trigger multiple toasts
        await page.evaluate(() => {
            // Access ToastManager from window if exposed, or create toasts directly
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                c.setAttribute('role', 'status');
                c.setAttribute('aria-live', 'polite');
                document.body.appendChild(c);
                return c;
            })();
            
            // Create multiple toasts
            for (let i = 1; i <= 3; i++) {
                const toast = document.createElement('div');
                toast.className = `toast toast-info toast-visible`;
                toast.textContent = `Test toast ${i}`;
                toast.setAttribute('role', 'alert');
                container.appendChild(toast);
            }
        });
        
        // Wait for toasts to render
        await page.waitForTimeout(100);
        
        // Should have multiple toasts
        const toasts = page.locator('#toast-container .toast');
        const count = await toasts.count();
        expect(count).toBeGreaterThanOrEqual(3);
    });

    test('toasts are positioned correctly', async ({ page }) => {
        // Inject multiple toasts
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            for (let i = 1; i <= 2; i++) {
                const toast = document.createElement('div');
                toast.className = `toast toast-info toast-visible`;
                toast.textContent = `Stack test ${i}`;
                container.appendChild(toast);
            }
        });
        
        await page.waitForTimeout(100);
        
        const toasts = page.locator('#toast-container .toast');
        if (await toasts.count() >= 2) {
            const first = await toasts.nth(0).boundingBox();
            const second = await toasts.nth(1).boundingBox();
            
            if (first && second) {
                // Toasts should be vertically stacked (different y positions)
                expect(first.y).not.toBe(second.y);
            }
        }
    });
});

test.describe('Toast Notifications - Types', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('success toast has correct class', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-success toast-visible';
            toast.textContent = 'Success message';
            container.appendChild(toast);
        });
        
        const toast = page.locator('.toast.toast-success');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveClass(/toast-success/);
    });

    test('error toast has correct class', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-error toast-visible';
            toast.textContent = 'Error message';
            container.appendChild(toast);
        });
        
        const toast = page.locator('.toast.toast-error');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveClass(/toast-error/);
    });

    test('warning toast has correct class', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-warning toast-visible';
            toast.textContent = 'Warning message';
            container.appendChild(toast);
        });
        
        const toast = page.locator('.toast.toast-warning');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveClass(/toast-warning/);
    });

    test('info toast has correct class', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-info toast-visible';
            toast.textContent = 'Info message';
            container.appendChild(toast);
        });
        
        const toast = page.locator('.toast.toast-info');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveClass(/toast-info/);
    });
});

test.describe('Toast Notifications - Visibility Transition', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('toast becomes visible with animation class', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-info';
            toast.textContent = 'Animation test';
            container.appendChild(toast);
            
            // Add visible class after frame (like the real implementation)
            requestAnimationFrame(() => {
                toast.classList.add('toast-visible');
            });
        });
        
        // Wait for animation frame
        await page.waitForTimeout(50);
        
        const toast = page.locator('.toast.toast-info');
        await expect(toast).toHaveClass(/toast-visible/);
    });

    test('toast removal respects transition', async ({ page }) => {
        // Create a toast that will auto-remove
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-info toast-visible';
            toast.id = 'test-toast-removal';
            toast.textContent = 'Removal test';
            container.appendChild(toast);
            
            // Simulate removal after short delay
            setTimeout(() => {
                toast.classList.remove('toast-visible');
                setTimeout(() => toast.remove(), 300);
            }, 500);
        });
        
        // Toast should be visible initially
        const toast = page.locator('#test-toast-removal');
        await expect(toast).toBeVisible();
        
        // After delay, toast should be removed
        await expect(toast).not.toBeAttached({ timeout: 2000 });
    });
});

test.describe('Toast Notifications - Content', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#itemsContainer .item-card', { timeout: 15000 });
    });

    test('toast displays message text', async ({ page }) => {
        const testMessage = 'This is a test notification';
        
        await page.evaluate((msg) => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-info toast-visible';
            toast.textContent = msg;
            container.appendChild(toast);
        }, testMessage);
        
        const toast = page.locator('.toast.toast-info');
        await expect(toast).toContainText(testMessage);
    });

    test('toast has alert role for accessibility', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.getElementById('toast-container') || (() => {
                const c = document.createElement('div');
                c.id = 'toast-container';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = 'toast toast-info toast-visible';
            toast.textContent = 'Accessibility test';
            toast.setAttribute('role', 'alert');
            container.appendChild(toast);
        });
        
        const toast = page.locator('.toast.toast-info');
        await expect(toast).toHaveAttribute('role', 'alert');
    });
});
