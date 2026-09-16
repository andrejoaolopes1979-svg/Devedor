(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.Backup = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    const CONFIG = {
        DB_NAME: 'devedor-db',
        DB_VERSION: 1,
        STORE: 'profile',
        KEY: 'main',
        LS_KEY: 'devedores_app',
        LS_TS_KEY: 'devedores_app_savedAt'
    };

    let dbPromise = null;
    let writeQueue = Promise.resolve();
    let backupAvailable = true;
    let lastSyncAt = null;

    function toTimestamp(value) {
        if (value === null || value === undefined || value === '') return null;
        const t = Number(value);
        return Number.isFinite(t) ? t : null;
    }

    function validSource(source) {
        return !!(source && Array.isArray(source.devedores));
    }

    function normalize(source, name) {
        return {
            source: name,
            devedores: source.devedores,
            savedAt: toTimestamp(source.savedAt)
        };
    }

    function pickWinner(ls, idb) {
        const hasLs = validSource(ls);
        const hasIdb = validSource(idb);

        if (!hasLs && !hasIdb) {
            return { source: 'empty', devedores: [], savedAt: null };
        }
        if (hasLs && !hasIdb) return normalize(ls, 'local');
        if (!hasLs && hasIdb) return normalize(idb, 'idb');

        const lsTs = toTimestamp(ls.savedAt);
        const idbTs = toTimestamp(idb.savedAt);

        if (lsTs !== null && idbTs !== null) {
            return lsTs >= idbTs ? normalize(ls, 'local') : normalize(idb, 'idb');
        }
        if (lsTs !== null) return normalize(ls, 'local');
        if (idbTs !== null) return normalize(idb, 'idb');

        const lsLen = ls.devedores.length;
        const idbLen = idb.devedores.length;
        return lsLen === idbLen ? normalize(ls, 'local')
            : (lsLen > idbLen ? normalize(ls, 'local') : normalize(idb, 'idb'));
    }

    function readLocal() {
        try {
            const raw = localStorage.getItem(CONFIG.LS_KEY);
            if (raw === null) return null;
            let devedores = null;
            try {
                devedores = JSON.parse(raw);
            } catch (err) {
                devedores = null;
            }
            if (!Array.isArray(devedores)) devedores = null;
            return { devedores, savedAt: toTimestamp(localStorage.getItem(CONFIG.LS_TS_KEY)) };
        } catch (err) {
            return null;
        }
    }

    function writeLocal(devedores, savedAt) {
        try {
            localStorage.setItem(CONFIG.LS_KEY, JSON.stringify(devedores));
            localStorage.setItem(CONFIG.LS_TS_KEY, String(savedAt));
            lastSyncAt = savedAt;
        } catch (err) {
            // armazenamento local indisponível: segue apenas com estado em memória
        }
    }

    function openDB() {
        if (dbPromise) return dbPromise;
        if (typeof indexedDB === 'undefined') {
            backupAvailable = false;
            return Promise.reject(new Error('indexeddb-indisponivel'));
        }
        dbPromise = new Promise((resolve, reject) => {
            let request;
            try {
                request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
            } catch (err) {
                dbPromise = null;
                backupAvailable = false;
                reject(err);
                return;
            }
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(CONFIG.STORE)) {
                    db.createObjectStore(CONFIG.STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => db.close();
                db.onclose = () => { dbPromise = null; };
                resolve(db);
            };
            request.onerror = () => {
                dbPromise = null;
                backupAvailable = false;
                reject(request.error || new Error('open-error'));
            };
        });
        return dbPromise;
    }

    function readIdb() {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(CONFIG.STORE, 'readonly');
            const req = tx.objectStore(CONFIG.STORE).get(CONFIG.KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error || new Error('get-error'));
        })).catch(() => null);
    }

    function writeRecord(record) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(CONFIG.STORE, 'readwrite');
            tx.objectStore(CONFIG.STORE).put(record);
            tx.oncomplete = () => {
                backupAvailable = true;
                lastSyncAt = record.savedAt;
                resolve({ persisted: true });
            };
            tx.onerror = () => {
                dbPromise = null;
                backupAvailable = false;
                reject(tx.error || new Error('write-error'));
            };
            tx.onabort = () => {
                dbPromise = null;
                backupAvailable = false;
                reject(tx.error || new Error('write-abort'));
            };
        }));
    }

    function enqueueWrite(record) {
        writeQueue = writeQueue
            .then(() => writeRecord(record))
            .catch(() => ({ persisted: false }));
        return writeQueue;
    }

    function buildRecord(devedores, savedAt) {
        return { id: CONFIG.KEY, devedores, savedAt };
    }

    function save(devedores) {
        const savedAt = Date.now();
        writeLocal(devedores, savedAt);
        return enqueueWrite(buildRecord(devedores, savedAt));
    }

    async function reconcileAndLoad() {
        const ls = readLocal();
        const idb = await readIdb();
        const winner = pickWinner(ls, idb);
        if (winner.source !== 'empty') {
            sync(winner.devedores, winner.savedAt);
        }
        if (winner.savedAt) lastSyncAt = winner.savedAt;
        return winner.devedores;
    }

    function sync(devedores, savedAt) {
        const ts = toTimestamp(savedAt) !== null ? toTimestamp(savedAt) : Date.now();
        writeLocal(devedores, ts);
        return enqueueWrite(buildRecord(devedores, ts));
    }

    async function backupNow(devedores) {
        if (!Array.isArray(devedores) || devedores.length === 0) {
            return { empty: true, savedAt: null, persisted: false };
        }
        const savedAt = Date.now();
        writeLocal(devedores, savedAt);
        const result = await enqueueWrite(buildRecord(devedores, savedAt));
        return { empty: false, savedAt, persisted: !!(result && result.persisted) };
    }

    function status() {
        return { available: backupAvailable, lastSyncAt };
    }

    return { CONFIG, pickWinner, save, sync, reconcileAndLoad, backupNow, status };
});