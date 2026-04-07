import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const name = pkg.name;

if (!name || name === '') {
  throw new Error('package.json: поле "name" нужно для base GitHub Pages');
}

process.env.VITE_BASE_PATH = `/${name}/`;
execSync('vite build', { stdio: 'inherit', cwd: root, env: process.env });
