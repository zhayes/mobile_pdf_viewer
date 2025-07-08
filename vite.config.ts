import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import terser from '@rollup/plugin-terser';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      copyDtsFiles: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.*', 'src/**/*.spec.*', 'src/demo/*']
    }),
    cssInjectedByJsPlugin()
  ],
  build: {
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueMobilePDFViewer',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['vue', 'pdfjs-dist', 'uid'],
      output: {
        globals: {
          vue: 'Vue',
          'pdfjs-dist': 'pdfjsLib',
          'uid': 'uid'
        }
      },
      plugins: [
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true
          }
        })
      ]
    },
    minify: false // 禁用 Vite 内置的 minify，使用 rollup 插件
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
