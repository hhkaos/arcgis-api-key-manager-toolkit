import { cp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

await Promise.all([
  build({
    entryPoints: ['src/popup.ts'],
    outfile: 'dist/popup.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    sourcemap: true,
    target: ['chrome120']
  }),
  build({
    entryPoints: ['src/explorer.ts'],
    outfile: 'dist/explorer.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    sourcemap: true,
    target: ['chrome120']
  }),
  build({
    entryPoints: ['src/service-worker.ts'],
    outfile: 'dist/service-worker.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    sourcemap: true,
    target: ['chrome120']
  })
]);

await cp('src/static', 'dist', { recursive: true });
