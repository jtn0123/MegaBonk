/* global indexedDB */
const DB_NAME = 'cv-validator-lab';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'runId' });
                store.createIndex('createdAt', 'createdAt');
                store.createIndex('imageName', 'imageName');
                store.createIndex('failureKind', 'metrics.dominantFailureKind');
            }
        };
    });
}

async function withStore(mode, handler) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);

        let result;
        try {
            result = handler(store, resolve, reject);
        } catch (error) {
            reject(error);
        }

        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => {
            db.close();
            if (result !== undefined) {
                resolve(result);
            }
        };
    });
}

export async function saveSessionBundle(bundle) {
    return withStore('readwrite', store => {
        store.put(bundle);
    });
}

export async function getSessionBundle(runId) {
    return withStore('readonly', (store, resolve, reject) => {
        const request = store.get(runId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
    });
}

export async function listSessionBundles() {
    return withStore('readonly', (store, resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const sessions = request.result || [];
            sessions.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
            resolve(sessions);
        };
    });
}

export async function deleteSessionBundle(runId) {
    return withStore('readwrite', store => {
        store.delete(runId);
    });
}

export async function clearSessionBundles() {
    return withStore('readwrite', store => {
        store.clear();
    });
}

export function summarizeSessions(sessions) {
    const summary = {
        count: sessions.length,
        avgF1: 0,
        avgPrecision: 0,
        avgRecall: 0,
        failureKinds: {},
    };

    if (sessions.length === 0) {
        return summary;
    }

    for (const session of sessions) {
        summary.avgF1 += session.metrics?.f1 || 0;
        summary.avgPrecision += session.metrics?.precision || 0;
        summary.avgRecall += session.metrics?.recall || 0;

        const failureKind = session.metrics?.dominantFailureKind || 'unknown';
        summary.failureKinds[failureKind] = (summary.failureKinds[failureKind] || 0) + 1;
    }

    summary.avgF1 /= sessions.length;
    summary.avgPrecision /= sessions.length;
    summary.avgRecall /= sessions.length;
    return summary;
}
