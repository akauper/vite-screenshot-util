import express from 'express';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Simple CORS for localhost
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(express.json());

app.post('/screenshot', async (req, res) => {
    try {
        const { width, height, scale, selector, url, cookies, localStorage, sessionStorage } = req.body;

        const browser = await chromium.launch({
            headless: true
        });

        const context = await browser.newContext({
            viewport: {
                width: width || 1920,
                height: height || 1080
            },
            deviceScaleFactor: scale || 2
        });

        // Add cookies for authentication
        if (cookies && cookies.length > 0) {
            await context.addCookies(cookies);
        }

        const page = await context.newPage();

        // Navigate to the domain first to set storage
        const baseUrl = new URL(url || 'http://localhost:3000').origin;
        await page.goto(baseUrl);

        // Set localStorage and sessionStorage
        if (localStorage) {
            await page.evaluate((storage) => {
                for (const [key, value] of Object.entries(storage)) {
                    window.localStorage.setItem(key, value as string);
                }
            }, localStorage);
        }

        if (sessionStorage) {
            await page.evaluate((storage) => {
                for (const [key, value] of Object.entries(storage)) {
                    window.sessionStorage.setItem(key, value as string);
                }
            }, sessionStorage);
        }

        // Now navigate to the actual URL
        await page.goto(url || 'http://localhost:3000', { waitUntil: 'networkidle' });

        // Wait a bit for auth to settle
        await page.waitForTimeout(2000);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = process.env.SCREENSHOT_OUTPUT_PATH
            ? path.resolve(process.cwd(), process.env.SCREENSHOT_OUTPUT_PATH)
            : process.cwd();
        const screenshotPath = path.join(outputDir, `screenshot-${timestamp}.png`);

        if (selector) {
            const element = page.locator(selector);
            await element.screenshot({
                path: screenshotPath,
                type: 'png'
            });
        } else {
            await page.screenshot({
                path: screenshotPath,
                fullPage: false,
                type: 'png'
            });
        }

        await browser.close();

        console.log('[screenshot-server] Saved:', screenshotPath);
        res.json({ success: true, path: screenshotPath });
    } catch (error) {
        console.error('[screenshot-server] Error:', error);
        res.status(500).json({ success: false, error: String(error) });
    }
});

const PORT = process.env.SCREENSHOT_PORT || 3001;
app.listen(PORT, () => {
    console.log(`Screenshot server running on http://localhost:${PORT}`);
});
