import * as esbuild from 'esbuild';
const options = {
  entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'],
  format: 'cjs', target: 'es2018', outfile: 'main.js',
  banner: { js: '/* DictateBar for Obsidian. Built from src/main.ts. */' },
};
if (process.argv.includes('--watch')) {
  const context = await esbuild.context({ ...options, sourcemap: 'inline' });
  await context.watch();
} else {
  await esbuild.build({ ...options, minify: true });
}
