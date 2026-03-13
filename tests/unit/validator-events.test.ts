import { describe, it, expect, afterEach, vi } from 'vitest';

vi.unmock('../../src/modules/logger.ts');

import { logger } from '../../src/modules/logger.ts';
import {
    addValidatorEventStageWarning,
    beginValidatorRun,
    clearValidatorRunArtifacts,
    completeValidatorEventStage,
    completeValidatorRun,
    configureValidatorEvents,
    getValidatorRunArtifacts,
    startValidatorEventStage,
    subscribeValidatorEvents,
    updateValidatorEventStageProgress,
} from '../../src/modules/cv/validator-events.ts';

describe('validator-events', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        clearValidatorRunArtifacts('run-events-1');
        clearValidatorRunArtifacts('run-events-2');
        configureValidatorEvents({ eventEndpoint: null });
    });

    it('emits runtime events for stage lifecycle and archives progress', () => {
        configureValidatorEvents({ eventEndpoint: null });
        const received: string[] = [];
        const unsubscribe = subscribeValidatorEvents(event => {
            if (event.runId === 'run-events-1') {
                received.push(event.type);
            }
        });

        beginValidatorRun('run-events-1', 'image.png');
        startValidatorEventStage('preflight', { imageName: 'image.png' });
        updateValidatorEventStageProgress('preflight', { imageWidth: 1920, imageHeight: 1080 });
        addValidatorEventStageWarning('preflight', 'Image detail is low');
        completeValidatorEventStage('preflight', { elapsedMs: 25 });
        completeValidatorRun('done');
        unsubscribe();

        expect(received).toEqual(
            expect.arrayContaining([
                'run_started',
                'stage_started',
                'stage_progress',
                'stage_warning',
                'stage_completed',
                'run_completed',
            ])
        );

        const artifacts = getValidatorRunArtifacts('run-events-1');
        expect(artifacts?.progressSummary.runStatus).toBe('completed');
        expect(artifacts?.progressSummary.activeWarningCount).toBeGreaterThanOrEqual(1);
        expect(artifacts?.progressSummary.slowestStage?.name).toBe('preflight');
    });

    it('captures raw logger events into run artifacts', () => {
        configureValidatorEvents({ eventEndpoint: null });

        beginValidatorRun('run-events-2', 'logger.png');
        logger.error({
            operation: 'cv.test_error',
            error: {
                name: 'Error',
                message: 'simulated failure',
            },
        });
        completeValidatorRun('done');

        const artifacts = getValidatorRunArtifacts('run-events-2');
        expect(artifacts?.logEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    source: 'cv',
                    operation: 'cv.test_error',
                    level: 'error',
                }),
            ])
        );
    });
});
