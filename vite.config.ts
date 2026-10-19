import { defineConfig } from 'vite';
import { presbuilder } from './server/plugin.ts';

export default defineConfig({
  plugins: [presbuilder()],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  // dist/ — публичная сборка проекта (свой git-репозиторий), её html сюда не относятся
  optimizeDeps: { entries: ['index.html'] },
  server: {
    port: 5180,
    open: true,
    // готовые ролики, корзина и публичная сборка — не исходники, следить за ними незачем
    watch: { ignored: ['**/out/**', '**/.trash/**', '**/dist/**'] },
  },
  build: { target: 'es2022', outDir: 'build' },
});
