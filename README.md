# vite-screenshot-util

High-quality screenshot utilities for React + Vite applications. Two approaches to choose from:

- **Native Browser APIs** (`useScreenshot`) - No dependencies, prompts user to select tab/window
- **Playwright** (`useScreenshotPlaywright`) - Automated headless browser with full auth state (cookies, localStorage, sessionStorage)

Perfect for dev tools, debug menus, automated testing, or capturing UI states.

## Installation

```bash
npm install vite-screenshot-util
```

### For Native Screenshots Only

No additional dependencies needed! `html2canvas-pro` is bundled for element screenshots.

### For Playwright Screenshots

Install optional peer dependencies:

```bash
npm install express playwright
```

Then add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { screenshotPlugin } from 'vite-screenshot-util/plugin';

export default defineConfig({
  plugins: [
    screenshotPlugin({
      port: 3001,              // Server port (default: 3001)
      outputPath: 'screenshots' // Where to save screenshots (default: project root)
    })
  ]
});
```

## Usage

### Native Browser Screenshots (`useScreenshot`)

Uses `getDisplayMedia` for full page screenshots and `html2canvas-pro` for element screenshots. No server required, but full-page mode prompts user to select tab/window.

```tsx
import { useScreenshot } from 'vite-screenshot-util';

function MyComponent() {
  const { takeScreenshot, isTakingScreenshot } = useScreenshot({
    onSuccess: (result) => console.log('Saved:', result.path),
    onError: (error) => console.error('Failed:', error.message)
  });

  return (
    <div>
      <button
        onClick={() => takeScreenshot()}
        disabled={isTakingScreenshot}
      >
        Take Full Page Screenshot
      </button>

      <div ref={divRef} id="my-chart">
        {/* Capture by ref */}
        <button onClick={() => takeScreenshot({
          element: divRef.current,
          scale: 2
        })}>
          Capture This Div (2x scale)
        </button>

        {/* Capture by CSS selector */}
        <button onClick={() => takeScreenshot({
          element: '#my-chart',
          scale: 2
        })}>
          Capture by ID
        </button>

        <button onClick={() => takeScreenshot({
          element: '.chart-container',
          scale: 2
        })}>
          Capture by Class
        </button>
      </div>
    </div>
  );
}
```

**Options:**

- `element?: HTMLElement | string` - Specific element to capture (HTMLElement ref or CSS selector; omit for full page)
- `scale?: number` - Scale factor for element screenshots (default: 1)

### Playwright Screenshots (`useScreenshotPlaywright`)

Starts a headless browser on-demand, captures with full authentication state, then automatically stops. Requires `screenshotPlugin` in your Vite config.

```tsx
import { useScreenshotPlaywright } from 'vite-screenshot-util';

function MyComponent() {
  const { takeScreenshot, isTakingScreenshot } = useScreenshotPlaywright({
    onSuccess: (result) => console.log('Saved at:', result.path),
    onError: (error) => console.error('Failed:', error.message)
  });

  return (
    <div>
      {/* Authenticated screenshot with all state copied */}
      <button onClick={() => takeScreenshot()}>
        Screenshot Current Page (with auth)
      </button>

      {/* Unauthenticated screenshot */}
      <button onClick={() => takeScreenshot({
        copyCookies: false,
        copyLocalStorage: false,
        copySessionStorage: false
      })}>
        Screenshot (no auth)
      </button>

      {/* Screenshot different URL with current auth */}
      <button onClick={() => takeScreenshot({
        url: 'http://localhost:3000/dashboard'
      })}>
        Screenshot Dashboard
      </button>
    </div>
  );
}
```

**Options:**

- `element?: HTMLElement | string` - Specific element to capture (HTMLElement ref or CSS selector; omit for viewport)
- `scale?: number` - Device scale factor (default: 2)
- `copyCookies?: boolean` - Copy cookies to headless browser (default: true)
- `copyLocalStorage?: boolean` - Copy localStorage to headless browser (default: true)
- `copySessionStorage?: boolean` - Copy sessionStorage to headless browser (default: true)
- `url?: string` - Override URL to screenshot (default: current page)

## API Reference

### Hook Options

Both hooks accept these callback options:

```typescript
interface UseScreenshotOptions {
  onStart?: () => void;                           // Called when screenshot begins
  onSuccess?: (result: ScreenshotSuccess) => void; // Called on success
  onError?: (error: ScreenshotError) => void;     // Called on error
  onEnd?: (result: ScreenshotResult) => void;     // Called on completion (success or error)
}
```

### Plugin Options

```typescript
interface ScreenshotPluginOptions {
  port?: number;        // Server port (default: 3001)
  enabled?: boolean;    // Enable/disable plugin (default: true)
  outputPath?: string;  // Relative path for screenshots (default: project root)
}
```

### Return Types

```typescript
interface ScreenshotSuccess {
  path: string; // File path or filename
}

class ScreenshotError extends Error {
  name: 'ScreenshotError';
  message: string;
  cause?: Error;
}

type ScreenshotResult = ScreenshotSuccess | ScreenshotError;
```

## How It Works

### Native Browser API (`useScreenshot`)

1. **Full Page**: Uses `navigator.mediaDevices.getDisplayMedia()` to prompt user to select tab/window
2. **Element**: Uses `html2canvas-pro` to render element to canvas at specified scale, handling cross-origin content
3. Downloads as PNG file via browser download

**Pros:**
- Minimal dependencies (html2canvas-pro bundled)
- High quality
- Works everywhere
- Handles cross-origin content in elements

**Cons:**
- Full page mode prompts user to select tab/window
- Cannot automate full page captures
- Cannot screenshot different URLs

### Playwright API (`useScreenshotPlaywright`)

1. Hook calls `/__screenshot_start` to start headless browser server
2. Collects current cookies, localStorage, sessionStorage
3. Sends to server with target URL
4. Server launches Playwright, applies auth state, navigates, captures screenshot
5. Saves to disk at configured `outputPath`
6. Hook calls `/__screenshot_stop` to shutdown server

**Pros:**
- Fully automated (no user prompt)
- Can screenshot any URL
- Copies full auth state
- Can disable auth copying for testing

**Cons:**
- Requires Playwright (200MB+ install)
- Requires server setup
- Dev-only (not for production)

## Common Use Cases

### Debug Menu

```tsx
import { useScreenshotPlaywright } from 'vite-screenshot-util';

function DebugMenu() {
  const { takeScreenshot } = useScreenshotPlaywright({
    onSuccess: (result) => {
      // Copy path to clipboard
      navigator.clipboard.writeText(result.path);
      alert(`Screenshot saved: ${result.path}`);
    }
  });

  return (
    <div className="debug-menu">
      <button onClick={() => takeScreenshot()}>
        Capture Screenshot
      </button>
    </div>
  );
}
```

### Testing UI States

```tsx
import { useScreenshotPlaywright } from 'vite-screenshot-util';

function ComponentTests() {
  const { takeScreenshot } = useScreenshotPlaywright();

  const captureAllStates = async () => {
    // Capture authenticated state
    await takeScreenshot({ url: 'http://localhost:3000/dashboard' });

    // Capture unauthenticated state
    await takeScreenshot({
      url: 'http://localhost:3000/login',
      copyCookies: false,
      copyLocalStorage: false
    });
  };

  return <button onClick={captureAllStates}>Capture All States</button>;
}
```

### High-Quality Element Captures

```tsx
import { useScreenshot } from 'vite-screenshot-util';

function ChartExport({ chartRef }) {
  const { takeScreenshot, isTakingScreenshot } = useScreenshot();

  return (
    <button
      onClick={() => takeScreenshot({ element: chartRef.current, scale: 3 })}
      disabled={isTakingScreenshot}
    >
      Export Chart (3x quality)
    </button>
  );
}
```

## TypeScript Support

Fully typed with TypeScript. All types are exported:

```typescript
import type {
  UseScreenshotOptions,
  TakeScreenshotOptions,
  TakeScreenshotOptionsPlaywright,
  UseScreenshotPlaywrightOptions,
  ScreenshotSuccess,
  ScreenshotError,
  ScreenshotResult,
  ScreenshotPluginOptions
} from 'vite-screenshot-util';
```

## Development

This package uses:
- **React** 18+ or 19+
- **Vite** 5+
- **TypeScript** 5+
- **Playwright** 1.40+ (optional)
- **Express** 4+ (optional)

## License

MIT

## Author

Adam Kauper <akauper@gmail.com>

## Contributing

Issues and PRs welcome! This is a public package designed to help developers capture screenshots in React + Vite apps.
