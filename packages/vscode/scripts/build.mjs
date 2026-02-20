import { build } from 'esbuild';

await Promise.all([
  build({
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    bundle: true,
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: true,
    target: ['node20']
  }),
  build({
    entryPoints: ['src/webview-ui.ts'],
    outfile: 'dist/webview-ui.js',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    sourcemap: true,
    target: ['chrome120']
  })
]);
