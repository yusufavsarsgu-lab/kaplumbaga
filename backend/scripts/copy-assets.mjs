import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(rootDir, 'src', 'data');
const target = join(rootDir, 'dist', 'data');

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
