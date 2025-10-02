import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react-swc';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['client/**/*']
    })
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'client/index.ts'),
      name: 'ScreenshotUtil',
      fileName: 'index',
      formats: ['es']
    },
    rolldownOptions: {
      external: ['react', 'react-dom', 'child_process', 'url', 'path', 'vite'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
});
