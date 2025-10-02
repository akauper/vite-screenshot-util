export interface ScreenshotSuccess {
    path: string;
}

export class ScreenshotError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'ScreenshotError';
    }
}

export type ScreenshotResult = ScreenshotSuccess | ScreenshotError;

export interface UseScreenshotOptions {
    onStart?: () => void;
    onEnd?: (result: ScreenshotResult) => void;
    onError?: (error: ScreenshotError) => void;
    onSuccess?: (result: ScreenshotSuccess) => void;
}

export interface TakeScreenshotOptions {
    element?: HTMLElement | null;
    scale?: number;
}

export interface TakeScreenshotOptionsPlaywright extends TakeScreenshotOptions {
    copyCookies?: boolean;
    copyLocalStorage?: boolean;
    copySessionStorage?: boolean;
    url?: string;
}

export interface UseScreenshotPlaywrightOptions extends UseScreenshotOptions {
    serverUrl?: string;
}