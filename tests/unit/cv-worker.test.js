import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.js';

// Mock Web Worker
class MockWorker {
    constructor() {
        this.onmessage = null;
        this.onerror = null;
        this.messages = [];
        this.terminated = false;
    }

    postMessage(message) {
        this.messages.push(message);

        // Simulate async response
        setTimeout(() => {
            if (this.onmessage && !this.terminated) {
                if (message.type === 'init') {
                    this.onmessage({ data: { type: 'ready', id: message.id } });
                } else if (message.type === 'detect') {
                    this.onmessage({
                        data: {
                            type: 'result',
                            id: message.id,
                            data: { detections: [] },
                        },
                    });
                } else if (message.type === 'terminate') {
                    this.terminated = true;
                }
            }
        }, 10);
    }

    terminate() {
        this.terminated = true;
    }
}

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

// Store original values
let originalWorker;
let originalURL;

beforeEach(() => {
    originalWorker = global.Worker;
    originalURL = global.URL;

    global.Worker = MockWorker;
    global.URL = {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
    };
});

afterEach(() => {
    global.Worker = originalWorker;
    global.URL = originalURL;
    vi.clearAllMocks();
});

// Mock the logger
vi.mock('../../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import {
    cvWorker,
    isWorkerSupported,
    runCVDetection,
} from '../../src/modules/cv-worker.ts';

describe('CV Worker Module', () => {
    beforeEach(() => {
        createMinimalDOM();
        // Terminate any existing worker
        cvWorker.terminate();
    });

    describe('isWorkerSupported()', () => {
        it('should return true when Worker is available', () => {
            expect(isWorkerSupported()).toBe(true);
        });

        it('should return false when Worker is not available', () => {
            const originalWorker = global.Worker;
            delete global.Worker;

            expect(isWorkerSupported()).toBe(false);

            global.Worker = originalWorker;
        });
    });

    describe('cvWorker', () => {
        describe('init()', () => {
            it('should initialize the worker', async () => {
                await cvWorker.init();
                expect(cvWorker.ready).toBe(true);
            });

            it('should accept config options', async () => {
                await cvWorker.init({ threshold: 0.8, maxDetections: 30, enableDebug: true });
                expect(cvWorker.ready).toBe(true);
            });

            it('should create blob URL for worker code', async () => {
                await cvWorker.init();
                expect(mockCreateObjectURL).toHaveBeenCalled();
            });

            it('should revoke blob URL after worker creation', async () => {
                await cvWorker.init();
                expect(mockRevokeObjectURL).toHaveBeenCalled();
            });
        });

        describe('detect()', () => {
            it('should throw error if worker not initialized', async () => {
                await expect(cvWorker.detect(new ImageData(10, 10))).rejects.toThrow(
                    'CV Worker not initialized'
                );
            });

            it('should return detection results', async () => {
                await cvWorker.init();

                const imageData = new ImageData(100, 100);
                const results = await cvWorker.detect(imageData);

                expect(Array.isArray(results)).toBe(true);
            });

            it('should call progress callback', async () => {
                await cvWorker.init();

                // Create a worker that reports progress
                class ProgressWorker extends MockWorker {
                    postMessage(message) {
                        this.messages.push(message);
                        setTimeout(() => {
                            if (this.onmessage && !this.terminated) {
                                if (message.type === 'init') {
                                    this.onmessage({ data: { type: 'ready', id: message.id } });
                                } else if (message.type === 'detect') {
                                    // Send progress first
                                    this.onmessage({
                                        data: { type: 'progress', id: message.id, data: { progress: 50 } },
                                    });
                                    // Then result
                                    setTimeout(() => {
                                        this.onmessage({
                                            data: { type: 'result', id: message.id, data: { detections: [] } },
                                        });
                                    }, 5);
                                }
                            }
                        }, 10);
                    }
                }

                global.Worker = ProgressWorker;

                // Re-initialize with new worker
                cvWorker.terminate();
                await cvWorker.init();

                const progressCallback = vi.fn();
                const imageData = new ImageData(100, 100);
                await cvWorker.detect(imageData, progressCallback);

                // Progress should have been called
                expect(progressCallback).toHaveBeenCalled();
            });
        });

        describe('terminate()', () => {
            it('should terminate the worker', async () => {
                await cvWorker.init();
                cvWorker.terminate();

                expect(cvWorker.ready).toBe(false);
            });

            it('should handle multiple terminate calls gracefully', () => {
                cvWorker.terminate();
                cvWorker.terminate();
                cvWorker.terminate();

                expect(cvWorker.ready).toBe(false);
            });
        });

        describe('ready property', () => {
            it('should be false before initialization', () => {
                cvWorker.terminate();
                expect(cvWorker.ready).toBe(false);
            });

            it('should be true after initialization', async () => {
                await cvWorker.init();
                expect(cvWorker.ready).toBe(true);
            });

            it('should be false after termination', async () => {
                await cvWorker.init();
                cvWorker.terminate();
                expect(cvWorker.ready).toBe(false);
            });
        });
    });

    describe('runCVDetection()', () => {
        it('should initialize worker if not ready', async () => {
            cvWorker.terminate();

            const imageData = new ImageData(100, 100);
            await runCVDetection(imageData);

            expect(cvWorker.ready).toBe(true);
        });

        it('should return detection results', async () => {
            const imageData = new ImageData(100, 100);
            const results = await runCVDetection(imageData);

            expect(Array.isArray(results)).toBe(true);
        });

        it('should pass config to worker', async () => {
            cvWorker.terminate();

            const imageData = new ImageData(100, 100);
            await runCVDetection(imageData, { threshold: 0.9 });

            expect(cvWorker.ready).toBe(true);
        });

        it('should return empty array when workers not supported', async () => {
            const originalWorker = global.Worker;
            delete global.Worker;

            const imageData = new ImageData(100, 100);
            const results = await runCVDetection(imageData);

            expect(results).toEqual([]);

            global.Worker = originalWorker;
        });
    });
});
