import { useCallback, useState } from "react";
import type { UseScreenshotPlaywrightOptions, TakeScreenshotOptionsPlaywright, ScreenshotSuccess } from "../types";
import { ScreenshotError } from "../types";

/**
 * React hook for taking automated screenshots using Playwright.
 *
 * Starts a headless browser server on-demand, captures screenshots with full auth state
 * (cookies, localStorage, sessionStorage), then stops the server. Requires the
 * screenshotPlugin in your Vite config and Playwright installed as a peer dependency.
 *
 * @param options - Hook configuration
 * @param options.serverUrl - Screenshot server URL (default: http://localhost:3001/screenshot)
 * @param options.onStart - Called when screenshot capture begins
 * @param options.onSuccess - Called when screenshot succeeds with result
 * @param options.onError - Called when screenshot fails with error
 * @param options.onEnd - Called when screenshot completes (success or failure)
 *
 * @returns Object containing takeScreenshot function and isTakingScreenshot state
 *
 * @example
 * ```tsx
 * const { takeScreenshot, isTakingScreenshot } = useScreenshotPlaywright({
 *   onSuccess: (result) => console.log('Saved:', result.path)
 * });
 *
 * // Authenticated screenshot with all state copied
 * await takeScreenshot();
 *
 * // Unauthenticated screenshot
 * await takeScreenshot({
 *   copyCookies: false,
 *   copyLocalStorage: false,
 *   copySessionStorage: false
 * });
 *
 * // Screenshot different URL with current auth
 * await takeScreenshot({ url: 'http://localhost:3000/dashboard' });
 * ```
 */
export const useScreenshotPlaywright = (options?: UseScreenshotPlaywrightOptions) => {
    const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

    /**
     * Captures a screenshot using Playwright in a headless browser.
     *
     * Starts the screenshot server on-demand, captures with current auth state,
     * then stops the server. All options default to true for convenience.
     *
     * @param screenshotOptions - Screenshot configuration
     * @param screenshotOptions.element - Specific element to capture (if omitted, captures viewport)
     * @param screenshotOptions.scale - Device scale factor (default: 2)
     * @param screenshotOptions.copyCookies - Copy cookies to headless browser (default: true)
     * @param screenshotOptions.copyLocalStorage - Copy localStorage to headless browser (default: true)
     * @param screenshotOptions.copySessionStorage - Copy sessionStorage to headless browser (default: true)
     * @param screenshotOptions.url - Override URL to screenshot (default: current page)
     *
     * @example
     * ```tsx
     * // Authenticated screenshot (copies all state)
     * await takeScreenshot();
     *
     * // Unauthenticated screenshot
     * await takeScreenshot({
     *   copyCookies: false,
     *   copyLocalStorage: false,
     *   copySessionStorage: false
     * });
     *
     * // Screenshot different page with current auth
     * await takeScreenshot({ url: 'http://localhost:3000/admin' });
     * ```
     */
    const takeScreenshot = useCallback(async (screenshotOptions?: TakeScreenshotOptionsPlaywright) => {
        setIsTakingScreenshot(true);
        options?.onStart?.();

        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            // Start the screenshot server on-demand via Vite middleware
            const startResponse = await fetch('/__screenshot_start');
            const startData = await startResponse.json();

            if (!startData.started) {
                throw new Error('Failed to start screenshot server');
            }

            // Wait a bit longer if server just started
            if (!startData.ready) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            const scale = screenshotOptions?.scale || 2;
            const width = window.innerWidth;
            const height = window.innerHeight;
            const copyCookies = screenshotOptions?.copyCookies ?? true;
            const copyLocalStorage = screenshotOptions?.copyLocalStorage ?? true;
            const copySessionStorage = screenshotOptions?.copySessionStorage ?? true;
            const targetUrl = screenshotOptions?.url || window.location.href;

            // Get selector if element is provided
            let selector: string | undefined;
            if (screenshotOptions?.element) {
                const el = screenshotOptions.element;
                if (el.id) {
                    selector = `#${el.id}`;
                } else if (el.className) {
                    selector = `.${el.className.split(' ')[0]}`;
                } else {
                    selector = el.tagName.toLowerCase();
                }
            }

            // Get cookies if enabled
            let cookies;
            if (copyCookies) {
                cookies = document.cookie.split(';').filter(c => c.trim()).map(cookie => {
                    const [name, value] = cookie.trim().split('=');
                    return {
                        name,
                        value,
                        domain: window.location.hostname,
                        path: '/'
                    };
                });
            }

            // Get localStorage if enabled
            let localStorageData: Record<string, string> | undefined;
            if (copyLocalStorage) {
                localStorageData = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        localStorageData[key] = localStorage.getItem(key) || '';
                    }
                }
            }

            // Get sessionStorage if enabled
            let sessionStorageData: Record<string, string> | undefined;
            if (copySessionStorage) {
                sessionStorageData = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                        sessionStorageData[key] = sessionStorage.getItem(key) || '';
                    }
                }
            }

            // Call screenshot server
            const serverUrl = options?.serverUrl || 'http://localhost:3001/screenshot';
            const response = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    width,
                    height,
                    scale,
                    selector,
                    url: targetUrl,
                    cookies,
                    localStorage: localStorageData,
                    sessionStorage: sessionStorageData
                })
            });

            if (response.ok) {
                const data = await response.json();
                const result: ScreenshotSuccess = { path: data.path };
                options?.onSuccess?.(result);

                // Stop the server after taking screenshot
                await fetch('/__screenshot_stop');

                setIsTakingScreenshot(false);
                options?.onEnd?.(result);
            } else {
                throw new Error('Screenshot API failed');
            }
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            const screenshotError = new ScreenshotError(
                error instanceof Error ? error.message : 'Failed to capture screenshot',
                error instanceof Error ? error : undefined
            );
            options?.onError?.(screenshotError);

            // Stop the server even on error
            try {
                await fetch('/__screenshot_stop');
            } catch (e) {
                console.error('Failed to stop screenshot server:', e);
            }

            setIsTakingScreenshot(false);
            options?.onEnd?.(screenshotError);
        }
    }, [options]);

    return {
        takeScreenshot,
        isTakingScreenshot
    };
};