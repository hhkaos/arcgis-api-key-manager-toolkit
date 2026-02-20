import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: false,
  format: 'esm',
  platform: 'neutral',
  sourcemap: true,
  target: ['es2020']
});
