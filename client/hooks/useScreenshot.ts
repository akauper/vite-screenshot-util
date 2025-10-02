import { useCallback, useState } from "react";
import type { UseScreenshotOptions, TakeScreenshotOptions, ScreenshotSuccess } from "../types";
import { ScreenshotError } from "../types";

/**
 * React hook for taking high-quality screenshots using native browser APIs.
 *
 * Uses getDisplayMedia for full page screenshots (prompts user to select tab/window)
 * and SVG foreignObject for element screenshots. No server required.
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
 * // Element screenshot
 * await takeScreenshot({ element: divRef.current, scale: 2 });
 * ```
 */
export const useScreenshot = (options?: UseScreenshotOptions) => {
    const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

    /**
     * Captures a screenshot using native browser APIs.
     *
     * @param screenshotOptions - Screenshot configuration
     * @param screenshotOptions.element - Specific element to capture (if omitted, prompts user for full page)
     * @param screenshotOptions.scale - Scale factor for element screenshots (default: 1)
     *
     * @example
     * ```tsx
     * // Full page (prompts user to select tab/window)
     * await takeScreenshot();
     *
     * // Specific element with 2x scaling
     * await takeScreenshot({ element: divRef.current, scale: 2 });
     * ```
     */
    const takeScreenshot = useCallback(async (screenshotOptions?: TakeScreenshotOptions) => {
        setIsTakingScreenshot(true);
        options?.onStart?.();

        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const element = screenshotOptions?.element;

            if (element) {
                // For specific elements, use foreignObject SVG approach
                const rect = element.getBoundingClientRect();
                const scale = screenshotOptions?.scale || 1;

                // Clone the element
                const clone = element.cloneNode(true) as HTMLElement;

                // Create SVG
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', String(rect.width * scale));
                svg.setAttribute('height', String(rect.height * scale));
                svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

                const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
                foreignObject.setAttribute('width', String(rect.width));
                foreignObject.setAttribute('height', String(rect.height));
                foreignObject.appendChild(clone);
                svg.appendChild(foreignObject);

                // Convert to data URL
                const svgData = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                // Draw to canvas for higher quality
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = rect.width * scale;
                    canvas.height = rect.height * scale;
                    const ctx = canvas.getContext('2d');

                    if (ctx) {
                        ctx.scale(scale, scale);
                        ctx.drawImage(img, 0, 0);

                        canvas.toBlob((blob) => {
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
                            URL.revokeObjectURL(url);
                            setIsTakingScreenshot(false);
                        });
                    }
                };
                img.src = url;
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

                            canvas.toBlob((blob) => {
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
