const { execFileSync } = require('child_process');
const { readFileSync, writeFileSync, mkdtempSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const root = join(__dirname, '..');

for (const file of ['backup.js', 'sw.js']) {
    execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
const inline = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1])
    .join('\n');

if (!inline.trim()) {
    throw new Error('Nenhum <script> inline encontrado no index.html');
}

const dir = mkdtempSync(join(tmpdir(), 'devedor-syntax-'));
const tmpFile = join(dir, 'inline.js');
writeFileSync(tmpFile, inline);
execFileSync(process.execPath, ['--check', tmpFile], { stdio: 'inherit' });
rmSync(dir, { recursive: true, force: true });

console.log('Sintaxe válida em backup.js, sw.js e no script inline do index.html');