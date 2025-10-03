import { useCallback, useState } from "react";
import type { UseScreenshotOptions, TakeScreenshotOptions, ScreenshotSuccess } from "../types";
import { ScreenshotError } from "../types";
import html2canvas from 'html2canvas-pro';

/**
 * React hook for taking high-quality screenshots using native browser APIs.
 *
 * Uses getDisplayMedia for full page screenshots (prompts user to select tab/window)
 * and html2canvas-pro for element screenshots. No server required.
 *
 * @param options - Hook configuration
 * @param options.onStart - Called when screenshot capture begins
 * @param options.onSuccess - Called when screenshot succeeds with result
 * @param options.onError - Called when screenshot fails with error
 * @param options.onEnd - Called when screenshot completes (success or failure)
 *
 * @returns Object containing takeScreenshot function and isTakingScreenshot state
 *
 * @example
 * ```tsx
 * const { takeScreenshot, isTakingScreenshot } = useScreenshot({
 *   onSuccess: (result) => console.log('Saved:', result.path)
 * });
 *
 * // Full page screenshot (prompts user)
 * await takeScreenshot();
 *
 * // Element screenshot by ref
 * await takeScreenshot({ element: divRef.current, scale: 2 });
 *
 * // Element screenshot by CSS selector
 * await takeScreenshot({ element: '#my-chart', scale: 2 });
 * await takeScreenshot({ element: '.chart-container', scale: 2 });
 * ```
 */
export const useScreenshot = (options?: UseScreenshotOptions) => {
    const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

    /**
     * Captures a screenshot using native browser APIs.
     *
     * @param screenshotOptions - Screenshot configuration
     * @param screenshotOptions.element - Specific element to capture (HTMLElement ref or CSS selector; if omitted, prompts user for full page)
     * @param screenshotOptions.scale - Scale factor for element screenshots (default: 1)
     *
     * @example
     * ```tsx
     * // Full page (prompts user to select tab/window)
     * await takeScreenshot();
     *
     * // Element by ref with 2x scaling
     * await takeScreenshot({ element: divRef.current, scale: 2 });
     *
     * // Element by CSS selector
     * await takeScreenshot({ element: '#my-chart', scale: 2 });
     * await takeScreenshot({ element: '.my-class', scale: 2 });
     * ```
     */
    const takeScreenshot = useCallback(async (screenshotOptions?: TakeScreenshotOptions) => {
        setIsTakingScreenshot(true);
        options?.onStart?.();

        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            let element = screenshotOptions?.element;

            // If element is a string (CSS selector), find it in the DOM
            if (typeof element === 'string') {
                // Try as-is first, then with common selector prefixes
                let foundElement = document.querySelector(element);

                // If not found and no prefix, try with # for id
                if (!foundElement && !element.startsWith('.') && !element.startsWith('#')) {
                    foundElement = document.querySelector(`#${element}`);
                }

                // If still not found, try with . for class
                if (!foundElement && !element.startsWith('.') && !element.startsWith('#')) {
                    foundElement = document.querySelector(`.${element}`);
                }

                if (!foundElement) {
                    throw new Error(`Element not found: ${element}`);
                }
                element = foundElement as HTMLElement;
            }

            if (element) {
                // For specific elements, use html2canvas-pro
                const scale = screenshotOptions?.scale || 1;

                const canvas = await html2canvas(element, {
                    scale,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: null
                });

                canvas.toBlob((blob: Blob | null) => {
                    if (blob) {
                        const link = document.createElement('a');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const filename = `screenshot-${timestamp}.png`;
                        link.download = filename;
                        link.href = URL.createObjectURL(blob);
                        link.click();
                        URL.revokeObjectURL(link.href);

                        const result: ScreenshotSuccess = { path: filename };
                        options?.onEnd?.(result);
                        options?.onSuccess?.(result);
                    }
                    setIsTakingScreenshot(false);
                });
            } else {
                // For full page, use getDisplayMedia
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: 'browser',
                        width: { ideal: 3840 },
                        height: { ideal: 2160 }
                    } as any,
                    audio: false,
                    preferCurrentTab: true
                } as any);

                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;

                await new Promise<void>((resolve) => {
                    video.onloadedmetadata = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;

                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(video, 0, 0);

                            stream.getTracks().forEach(track => track.stop());

                            canvas.toBlob((blob: Blob | null) => {
                                if (blob) {
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                    const filename = `screenshot-${timestamp}.png`;
                                    link.download = filename;
                                    link.href = url;
                                    link.click();
                                    URL.revokeObjectURL(url);

                                    const result: ScreenshotSuccess = { path: filename };
                                    options?.onSuccess?.(result);
                                }
                                resolve();
                            }, 'image/png', 1.0);
                        } else {
                            resolve();
                        }
                    };
                });

                setIsTakingScreenshot(false);
                const result: ScreenshotSuccess = { path: 'screenshot.png' };
                options?.onEnd?.(result);
            }
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            const screenshotError = new ScreenshotError(
                error instanceof Error ? error.message : 'Failed to capture screenshot',
                error instanceof Error ? error : undefined
            );
            options?.onError?.(screenshotError);
            setIsTakingScreenshot(false);
            options?.onEnd?.(screenshotError);
        }
    }, [options]);

    return {
        takeScreenshot,
        isTakingScreenshot
    };
};
