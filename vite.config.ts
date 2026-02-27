import browserslistToEsbuild from 'browserslist-to-esbuild';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'src/resources',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    target: browserslistToEsbuild(undefined, { env: 'production' }),
    lib: {
      entry: 'src/snippet.ts',
      name: 'MindboxWidget',
      formats: ['iife'],
      fileName: function () {
        return 'snippet.js';
      }
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
