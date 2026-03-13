import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createValidatorDevServer } from '../../scripts/validator-dev-server.mjs';

const nativeFetch = globalThis.fetch;

describe('validator-dev-server', () => {
    let instance: ReturnType<typeof createValidatorDevServer>;
    let server: Awaited<ReturnType<ReturnType<typeof createValidatorDevServer>['start']>>;
    let baseUrl = '';

    beforeEach(async () => {
        global.fetch = nativeFetch;
        instance = createValidatorDevServer({
            rootDir: path.resolve(process.cwd()),
            port: 0,
            defaultPage: '/test-images/gameplay/cv-validator.html',
        });
        server = await instance.start();
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await instance.stop();
    });

    it('serves the health endpoint', async () => {
        const response = await fetch(`${baseUrl}/__validator/health`);
        expect(response.ok).toBe(true);

        const body = await response.json();
        expect(body).toEqual(
            expect.objectContaining({
                ok: true,
                defaultPage: '/test-images/gameplay/cv-validator.html',
            })
        );
    });

    it('serves validator assets', async () => {
        const response = await fetch(`${baseUrl}/test-images/gameplay/cv-validator.html`);
        expect(response.ok).toBe(true);
        const html = await response.text();
        expect(html).toContain('CV Validator Lab');
    });

    it('prints important forwarded events', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const response = await fetch(`${baseUrl}/__validator/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                runId: 'run-123',
                type: 'run_stalled',
                level: 'warn',
                stage: 'candidate_generation',
                message: 'waiting on worker batches (2 pending)',
                metadata: {
                    diagnosis: 'worker_batch_wait',
                    workerBatchesPending: 2,
                },
            }),
        });

        expect(response.status).toBe(204);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[run-123] [WARN] [candidate_generation] waiting on worker batches (2 pending)')
        );
    });
});
