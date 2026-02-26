import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldShowWhatsNew, dismissWhatsNew, showWhatsNewModal, initWhatsNew } from '../../src/modules/whats-new.ts';

describe('whats-new', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('shouldShowWhatsNew', () => {
        it('should return true when no version seen', () => {
            expect(shouldShowWhatsNew()).toBe(true);
        });

        it('should return false when current version already seen', () => {
            // __APP_VERSION__ is defined as '0.0.0-test' via vitest.config.js define
            localStorage.setItem('megabonk-last-seen-version', '0.0.0-test');
            expect(shouldShowWhatsNew()).toBe(false);
        });

        it('should return false when DISMISS_ALL sentinel is set', () => {
            localStorage.setItem('megabonk-last-seen-version', 'DISMISS_ALL');
            expect(shouldShowWhatsNew()).toBe(false);
        });

        it('should return true when different version is stored', () => {
            localStorage.setItem('megabonk-last-seen-version', '0.0.1');
            expect(shouldShowWhatsNew()).toBe(true);
        });
    });

    describe('dismissWhatsNew', () => {
        it('should store current version in localStorage', () => {
            dismissWhatsNew();
            expect(localStorage.getItem('megabonk-last-seen-version')).toBe('0.0.0-test');
        });
    });

    describe('showWhatsNewModal', () => {
        it('should create modal overlay', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            const modal = document.getElementById('whats-new-modal');
            expect(modal).toBeTruthy();
            expect(modal?.className).toBe('whats-new-overlay');
        });

        it('should not create duplicate modals', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            await showWhatsNewModal();
            const modals = document.querySelectorAll('#whats-new-modal');
            expect(modals.length).toBe(1);
        });

        it('should show version in header', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            const title = document.querySelector('.whats-new-title');
            expect(title?.textContent).toContain('0.0.0-test');
        });

        it('should show commit hash when available', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            const commit = document.querySelector('.whats-new-commit');
            expect(commit?.textContent).toBe('abc1234');
        });

        it('should render releases from GitHub', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [
                    {
                        tag_name: 'v1.2.0',
                        published_at: '2026-01-15T00:00:00Z',
                        body: '## Changes\n- Fixed bugs\n- Added features',
                    },
                    {
                        tag_name: 'v1.1.0',
                        published_at: '2026-01-10T00:00:00Z',
                        body: '**Bold text** and stuff',
                    },
                ],
            } as Response);

            await showWhatsNewModal();
            const releases = document.querySelectorAll('.whats-new-release');
            expect(releases.length).toBe(2);

            const firstVersion = releases[0]?.querySelector('.whats-new-version');
            expect(firstVersion?.textContent).toContain('1.2.0');
        });

        it('should show empty state when no releases', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            const empty = document.querySelector('.whats-new-empty');
            expect(empty).toBeTruthy();
            const link = document.querySelector('.whats-new-github-link');
            expect(link).toBeTruthy();
        });

        it('should show empty state on fetch failure', async () => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

            await showWhatsNewModal();
            const empty = document.querySelector('.whats-new-empty');
            expect(empty).toBeTruthy();
        });

        it('should show empty state on non-ok response', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: false,
            } as Response);

            await showWhatsNewModal();
            const empty = document.querySelector('.whats-new-empty');
            expect(empty).toBeTruthy();
        });

        it('should close on close button click', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            const closeBtn = document.querySelector('.whats-new-close') as HTMLButtonElement;
            closeBtn.click();
            expect(document.getElementById('whats-new-modal')).toBeNull();
        });

        it('should close on overlay click', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            const overlay = document.getElementById('whats-new-modal')!;
            overlay.click();
            expect(document.getElementById('whats-new-modal')).toBeNull();
        });

        it('should close on Escape key', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(document.getElementById('whats-new-modal')).toBeNull();
        });

        it('should dismiss version on close', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            await showWhatsNewModal();
            const closeBtn = document.querySelector('.whats-new-close') as HTMLButtonElement;
            closeBtn.click();
            expect(localStorage.getItem('megabonk-last-seen-version')).toBe('0.0.0-test');
        });

        it('should handle release with no published_at', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [
                    { tag_name: 'v1.0.0', published_at: null, body: 'Notes' },
                ],
            } as Response);

            await showWhatsNewModal();
            const date = document.querySelector('.whats-new-date');
            expect(date?.textContent).toBe('');
        });

        it('should handle release with no body', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [
                    { tag_name: 'v1.0.0', published_at: '2026-01-01T00:00:00Z', body: null },
                ],
            } as Response);

            await showWhatsNewModal();
            const body = document.querySelector('.whats-new-release-body');
            expect(body?.innerHTML).toContain('No release notes');
        });

        it('should convert markdown headers to HTML', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [
                    { tag_name: 'v1.0.0', published_at: '2026-01-01T00:00:00Z', body: '## Big Header\n### Small Header' },
                ],
            } as Response);

            await showWhatsNewModal();
            const body = document.querySelector('.whats-new-release-body');
            expect(body?.innerHTML).toContain('<h3>');
            expect(body?.innerHTML).toContain('<h4>');
        });

        it('should convert markdown bold to HTML', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [
                    { tag_name: 'v1.0.0', published_at: '2026-01-01T00:00:00Z', body: '**bold text**' },
                ],
            } as Response);

            await showWhatsNewModal();
            const body = document.querySelector('.whats-new-release-body');
            expect(body?.innerHTML).toContain('<strong>');
        });

        it('should convert markdown lists to HTML', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [
                    { tag_name: 'v1.0.0', published_at: '2026-01-01T00:00:00Z', body: '- item 1\n- item 2' },
                ],
            } as Response);

            await showWhatsNewModal();
            const body = document.querySelector('.whats-new-release-body');
            expect(body?.innerHTML).toContain('<li>');
            expect(body?.innerHTML).toContain('<ul>');
        });
    });

    describe('initWhatsNew', () => {
        it('should show modal after delay when new version', () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => [],
            } as Response);

            initWhatsNew();
            expect(document.getElementById('whats-new-modal')).toBeNull();

            vi.advanceTimersByTime(600);
            expect(fetchSpy).toHaveBeenCalled();
        });

        it('should not show modal when version already seen', () => {
            localStorage.setItem('megabonk-last-seen-version', '0.0.0-test');
            const fetchSpy = vi.spyOn(globalThis, 'fetch');

            initWhatsNew();
            vi.advanceTimersByTime(600);
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });
});
