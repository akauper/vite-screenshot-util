import React, { createContext, PropsWithChildren } from 'react';
import { ScreenshotResult, TakeScreenshotOptions } from './types';
import { useScreenshot } from './hooks';

export interface ScreenshotContextValue {
    takeScreenshot: (options?: TakeScreenshotOptions) => Promise<void>;
    isTakingScreenshot: boolean;
}

export const ScreenshotContext = createContext<ScreenshotContextValue>({
    takeScreenshot: () => Promise.reject(new Error('No screenshot provider found')),
    isTakingScreenshot: false,
});

export const useScreenshotProvider = (): ScreenshotContextValue => {
    const context = React.useContext(ScreenshotContext);
    if (!context) {
        throw new Error('useScreenshot must be used within a ScreenshotProvider');
    }
    return context;
}

const ScreenshotProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const { takeScreenshot, isTakingScreenshot } = useScreenshot();

    const value: ScreenshotContextValue = {
        takeScreenshot,
        isTakingScreenshot
    }

    return (
        <ScreenshotContext.Provider value={value}>
            {children}
        </ScreenshotContext.Provider>
    );
};

export default ScreenshotProvider;
