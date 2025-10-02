import type { Plugin } from 'vite';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

export interface ScreenshotPluginOptions {
  port?: number;
  enabled?: boolean;
  outputPath?: string;
}

/**
 * Vite plugin that manages the Playwright screenshot server.
 *
 * Starts a headless browser server on-demand when useScreenshotPlaywright calls
 * takeScreenshot(), then automatically stops it after the screenshot completes.
 * Required for useScreenshotPlaywright hook to work.
 *
 * @param options - Plugin configuration
 * @param options.port - Server port (default: 3001)
 * @param options.enabled - Enable/disable plugin (default: true)
 * @param options.outputPath - Relative path for saving screenshots (default: project root)
 *
 * @returns Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { screenshotPlugin } from 'vite-screenshot-util/plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     screenshotPlugin({
 *       port: 3001,
 *       outputPath: 'screenshots'
 *     })
 *   ]
 * });
 * ```
 */
export function screenshotPlugin(options: ScreenshotPluginOptions = {}): Plugin {
  const { port = 3001, enabled = true, outputPath } = options;
  let serverProcess: ChildProcess | null = null;
  let serverPath: string;
  let isServerReady = false;

  const startServer = () => {
    if (serverProcess || !enabled) return;

    console.log('[screenshot-plugin] Starting screenshot server on port', port);

    serverProcess = spawn('node', [serverPath], {
      stdio: 'pipe',
      env: {
        ...process.env,
        SCREENSHOT_PORT: port.toString(),
        ...(outputPath && { SCREENSHOT_OUTPUT_PATH: outputPath })
      },
      shell: true
    });

    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[screenshot-server]', output.trim());
      if (output.includes('Screenshot server running')) {
        isServerReady = true;
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error('[screenshot-server]', data.toString().trim());
    });

    serverProcess.on('error', (error) => {
      console.error('[screenshot-plugin] Failed to start screenshot server:', error);
    });

    serverProcess.on('exit', (code) => {
      console.log('[screenshot-plugin] Screenshot server exited with code', code);
      serverProcess = null;
      isServerReady = false;
    });
  };

  const stopServer = () => {
    if (serverProcess) {
      serverProcess.removeAllListeners('exit');
      serverProcess.on('exit', () => {
        console.log('[screenshot-plugin] Screenshot server stopped');
      });
      serverProcess.kill();
      serverProcess = null;
      isServerReady = false;
    }
  };

  return {
    name: 'vite-plugin-screenshot',
    apply: 'serve', // Only run in dev mode

    configureServer(server) {
      if (!enabled) return;

      // Find the package root by looking for the dist folder containing this plugin
      // When imported, this file is at: node_modules/@quiply/screenshot-util/dist/plugin/plugin.js
      // So we go up one level to dist, then into server
      const pluginDir = dirname(fileURLToPath(import.meta.url));
      const distDir = resolve(pluginDir, '..');
      serverPath = resolve(distDir, 'server', 'screenshot-server.js');

      // Add middleware to handle screenshot requests and start server on-demand
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/__screenshot_start') {
          if (!serverProcess) {
            startServer();
            // Wait a bit for server to start
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            started: true,
            port,
            ready: isServerReady
          }));
          return;
        }
        if (req.url === '/__screenshot_stop') {
          stopServer();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ stopped: true }));
          return;
        }
        next();
      });
    },

    buildEnd() {
      stopServer();
    }
  };
}
