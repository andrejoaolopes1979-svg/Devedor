const assert = require('assert');
const { pickWinner } = require('../backup.js');

const T = 1700000000000;

function mk(n, prefix) {
    return Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}` }));
}

let passed = 0;
function t(name, fn) {
    fn();
    passed++;
    console.log('  \u2713', name);
}

console.log('Backup: lógica de conciliação');

t('ambas fontes ausentes -> estado vazio', () => {
    const w = pickWinner(null, null);
    assert.strictEqual(w.source, 'empty');
    assert.deepStrictEqual(w.devedores, []);
    assert.strictEqual(w.savedAt, null);
});

t('só localStorage (legado sem timestamp) -> local vence', () => {
    const w = pickWinner({ devedores: mk(3, 'ls'), savedAt: null }, null);
    assert.strictEqual(w.source, 'local');
    assert.strictEqual(w.devedores.length, 3);
});

t('localStorage limpo (cache apagado) -> restaura do IndexedDB', () => {
    const w = pickWinner(null, { devedores: mk(2, 'idb'), savedAt: T });
    assert.strictEqual(w.source, 'idb');
    assert.strictEqual(w.devedores.length, 2);
});

t('IndexedDB limpo -> restaura do localStorage e realimenta o backup', () => {
    const w = pickWinner({ devedores: mk(3, 'ls'), savedAt: T }, null);
    assert.strictEqual(w.source, 'local');
    assert.strictEqual(w.devedores.length, 3);
});

t('duas fontes com timestamps -> vence a mais recente (idb)', () => {
    const w = pickWinner(
        { devedores: mk(1, 'ls'), savedAt: T },
        { devedores: mk(1, 'idb'), savedAt: T + 5000 }
    );
    assert.strictEqual(w.source, 'idb');
});

t('duas fontes com timestamps -> vence a mais recente (local)', () => {
    const w = pickWinner(
        { devedores: mk(1, 'ls'), savedAt: T + 5000 },
        { devedores: mk(1, 'idb'), savedAt: T }
    );
    assert.strictEqual(w.source, 'local');
});

t('timestamps iguais -> mantém localStorage', () => {
    const w = pickWinner(
        { devedores: mk(1, 'ls'), savedAt: T },
        { devedores: mk(2, 'idb'), savedAt: T }
    );
    assert.strictEqual(w.source, 'local');
    assert.strictEqual(w.devedores.length, 1);
});

t('apenas local tem timestamp -> local vence', () => {
    const w = pickWinner(
        { devedores: mk(1, 'ls'), savedAt: T },
        { devedores: mk(3, 'idb'), savedAt: null }
    );
    assert.strictEqual(w.source, 'local');
});

t('apenas idb tem timestamp -> idb vence', () => {
    const w = pickWinner(
        { devedores: mk(3, 'ls'), savedAt: null },
        { devedores: mk(1, 'idb'), savedAt: T }
    );
    assert.strictEqual(w.source, 'idb');
});

t('listas vazias excluídas mais recentemente não são ressuscitadas', () => {
    const w = pickWinner(
        { devedores: [], savedAt: T + 10000 },
        { devedores: mk(5, 'idb'), savedAt: T }
    );
    assert.strictEqual(w.source, 'local');
    assert.deepStrictEqual(w.devedores, []);
});

t('legado sem timestamp: idb com mais dados vence', () => {
    const w = pickWinner(
        { devedores: mk(1, 'ls'), savedAt: null },
        { devedores: mk(4, 'idb'), savedAt: null }
    );
    assert.strictEqual(w.source, 'idb');
});

t('legado sem timestamp: local com mais dados vence', () => {
    const w = pickWinner(
        { devedores: mk(4, 'ls'), savedAt: null },
        { devedores: mk(1, 'idb'), savedAt: null }
    );
    assert.strictEqual(w.source, 'local');
});

t('legado sem timestamp: empate -> local vence', () => {
    const w = pickWinner(
        { devedores: mk(2, 'ls'), savedAt: null },
        { devedores: mk(2, 'idb'), savedAt: null }
    );
    assert.strictEqual(w.source, 'local');
});

t('localStorage corrompido -> restaura do IndexedDB', () => {
    const w = pickWinner(
        { devedores: 'not-an-array', savedAt: T },
        { devedores: mk(2, 'idb'), savedAt: T }
    );
    assert.strictEqual(w.source, 'idb');
});

t('timestamp legado em string é normalizado para número', () => {
    const w = pickWinner(null, { devedores: mk(1, 'idb'), savedAt: String(T) });
    assert.strictEqual(w.source, 'idb');
    assert.strictEqual(w.savedAt, T);
});

t('não muta as fontes de entrada', () => {
    const ls = { devedores: mk(1, 'ls'), savedAt: T };
    const idb = { devedores: mk(2, 'idb'), savedAt: T + 1 };
    const lsSnapshot = JSON.parse(JSON.stringify(ls));
    const idbSnapshot = JSON.parse(JSON.stringify(idb));
    pickWinner(ls, idb);
    assert.deepStrictEqual(ls, lsSnapshot);
    assert.deepStrictEqual(idb, idbSnapshot);
});

console.log(`\n${passed} testes de conciliação passaram`);