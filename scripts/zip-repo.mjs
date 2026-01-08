import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const repo = resolve(process.cwd());
const out = resolve(repo, '..', 'block-v7.zip');

execSync(`cd "${repo}" && zip -r "${out}" . -x "**/node_modules/**" "**/.next/**" "**/dist/**" "**/.expo/**"`, {
  stdio: 'inherit'
});

console.log(`Created: ${out}`);
