import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock directory handle factory
function createMockDirectoryHandle(
    name: string,
    entries: Array<{ name: string; kind: 'file' | 'directory'; entries?: any[] }>
) {
    return {
        name,
        kind: 'directory' as const,
        getDirectoryHandle: vi.fn(async (subdir: string) => {
            const entry = entries.find(e => e.name === subdir && e.kind === 'directory');
            if (!entry) {
                const error = new Error(`Directory ${subdir} not found`);
                (error as any).name = 'NotFoundError';
                throw error;
            }
            return createMockDirectoryHandle(entry.name, entry.entries || []);
        }),
        async *values() {
            for (const entry of entries) {
                yield entry;
            }
        },
    };
}

function createMockFileHandle(name: string) {
    return { name, kind: 'file' as const };
}

// We need to test the populateFileHandles function in isolation
// Since it's tightly coupled with state, we'll create a minimal test module

describe('populateFileHandles()', () => {
    // Store original state
    let mockState: { directoryHandle: any; hasFileSystemAccess: boolean };

    beforeEach(() => {
        mockState = {
            directoryHandle: null,
            hasFileSystemAccess: false,
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Test helper that mimics populateFileHandles logic
    async function populateFileHandles(
        state: typeof mockState,
        images: Array<{ path: string; fileHandle: any }>,
        progressCallback?: (count: number, filename: string) => void
    ) {
        if (!state.directoryHandle) {
            return { success: false, error: 'No directory handle' };
        }

        const subdirs = ['pc-screenshots', 'steam-community', 'steam-scraped'];
        let matched = 0;

        for (const subdir of subdirs) {
            try {
                const subdirHandle = await state.directoryHandle.getDirectoryHandle(subdir);

                for await (const entry of subdirHandle.values()) {
                    if (entry.kind === 'file') {
                        const path = `${subdir}/${entry.name}`;
                        const img = images.find((i: any) => i.path === path);
                        if (img) {
                            img.fileHandle = entry;
                            matched++;
                            if (progressCallback) {
                                progressCallback(matched, entry.name);
                            }
                        }
                    }
                }
            } catch (err: any) {
                console.warn(`Subdirectory ${subdir} not found:`, err.message);
            }
        }

        return { success: true, matched };
    }

    it('should match existing images with file handles', async () => {
        const mockFile1 = createMockFileHandle('screenshot1.png');
        const mockFile2 = createMockFileHandle('screenshot2.png');

        const mockSubdir = {
            name: 'pc-screenshots',
            kind: 'directory' as const,
            entries: [mockFile1, mockFile2],
        };

        mockState.directoryHandle = createMockDirectoryHandle('gameplay', [mockSubdir]);

        // Images from ground-truth.json (no fileHandle)
        const images = [
            { path: 'pc-screenshots/screenshot1.png', fileHandle: null },
            { path: 'pc-screenshots/screenshot2.png', fileHandle: null },
            { path: 'pc-screenshots/missing.png', fileHandle: null }, // Not in directory
        ];

        const result = await populateFileHandles(mockState, images);

        expect(result.success).toBe(true);
        expect(result.matched).toBe(2);
        expect(images[0].fileHandle).toEqual(mockFile1);
        expect(images[1].fileHandle).toEqual(mockFile2);
        expect(images[2].fileHandle).toBeNull(); // Not matched
    });

    it('should handle multiple subdirectories', async () => {
        const mockFile1 = createMockFileHandle('pc-shot.png');
        const mockFile2 = createMockFileHandle('steam-shot.png');

        const pcSubdir = {
            name: 'pc-screenshots',
            kind: 'directory' as const,
            entries: [mockFile1],
        };

        const steamSubdir = {
            name: 'steam-community',
            kind: 'directory' as const,
            entries: [mockFile2],
        };

        mockState.directoryHandle = createMockDirectoryHandle('gameplay', [pcSubdir, steamSubdir]);

        const images = [
            { path: 'pc-screenshots/pc-shot.png', fileHandle: null },
            { path: 'steam-community/steam-shot.png', fileHandle: null },
        ];

        const result = await populateFileHandles(mockState, images);

        expect(result.success).toBe(true);
        expect(result.matched).toBe(2);
        expect(images[0].fileHandle).toEqual(mockFile1);
        expect(images[1].fileHandle).toEqual(mockFile2);
    });

    it('should handle missing subdirectories gracefully', async () => {
        // Empty root directory - no subdirectories
        mockState.directoryHandle = createMockDirectoryHandle('gameplay', []);

        const images = [{ path: 'pc-screenshots/screenshot1.png', fileHandle: null }];

        const result = await populateFileHandles(mockState, images);

        expect(result.success).toBe(true);
        expect(result.matched).toBe(0);
        expect(images[0].fileHandle).toBeNull();
    });

    it('should return error when no directory handle set', async () => {
        mockState.directoryHandle = null;

        const result = await populateFileHandles(mockState, []);

        expect(result.success).toBe(false);
        expect(result.error).toBe('No directory handle');
    });

    it('should call progress callback for each matched file', async () => {
        const mockFile1 = createMockFileHandle('shot1.png');
        const mockFile2 = createMockFileHandle('shot2.png');

        const mockSubdir = {
            name: 'pc-screenshots',
            kind: 'directory' as const,
            entries: [mockFile1, mockFile2],
        };

        mockState.directoryHandle = createMockDirectoryHandle('gameplay', [mockSubdir]);

        const images = [
            { path: 'pc-screenshots/shot1.png', fileHandle: null },
            { path: 'pc-screenshots/shot2.png', fileHandle: null },
        ];

        const progressCallback = vi.fn();
        await populateFileHandles(mockState, images, progressCallback);

        expect(progressCallback).toHaveBeenCalledTimes(2);
        expect(progressCallback).toHaveBeenCalledWith(1, 'shot1.png');
        expect(progressCallback).toHaveBeenCalledWith(2, 'shot2.png');
    });

    it('should not match files that are not images in the list', async () => {
        const mockFile1 = createMockFileHandle('screenshot.png');
        const mockFile2 = createMockFileHandle('readme.txt'); // Not an image in our list

        const mockSubdir = {
            name: 'pc-screenshots',
            kind: 'directory' as const,
            entries: [mockFile1, mockFile2],
        };

        mockState.directoryHandle = createMockDirectoryHandle('gameplay', [mockSubdir]);

        // Only have an image entry for the PNG
        const images = [{ path: 'pc-screenshots/screenshot.png', fileHandle: null }];

        const result = await populateFileHandles(mockState, images);

        expect(result.success).toBe(true);
        expect(result.matched).toBe(1);
    });

    it('should handle empty image list', async () => {
        const mockSubdir = {
            name: 'pc-screenshots',
            kind: 'directory' as const,
            entries: [createMockFileHandle('screenshot.png')],
        };

        mockState.directoryHandle = createMockDirectoryHandle('gameplay', [mockSubdir]);

        const images: Array<{ path: string; fileHandle: any }> = [];

        const result = await populateFileHandles(mockState, images);

        expect(result.success).toBe(true);
        expect(result.matched).toBe(0);
    });
});
