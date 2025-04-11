const puppeteer = require('puppeteer');
const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

// --- Screenshot Configuration ---
const urlToCapture = process.env.GOOGLE_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSdjoWcHb2PqK1BXPp_U8Z-AYHyaimZ4Ko5-xvmNOOuQquDOTQ/viewform?embedded=true'; // Fallback URL
const screenshotDirectory = path.join(__dirname, 'screenshots'); // Directory to save screenshots
const screenshotPrefix = 'screenshot_';
const cronSchedule = '*/2 * * * *'; // Capture every 2 minutes
// --- End Screenshot Configuration ---

// --- Screenshot Function ---
async function captureScreenshot(url, outputPath) {
    let browser = null;
    console.log(`Attempting to capture screenshot of: ${url}`);
    try {
        // Launch Puppeteer
        browser = await puppeteer.launch({
            headless: true, // Run in headless mode
            args: [
                '--no-sandbox', // Required for some environments
                '--disable-setuid-sandbox'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 }); // Set viewport size

        // Navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }); // Wait for the page to fully load

        // Capture the screenshot
        await page.screenshot({ path: outputPath, fullPage: true });
        console.log(`Screenshot saved to: ${outputPath}`);
    } catch (error) {
        console.error(`Error capturing screenshot of ${url}:`, error);
    } finally {
        if (browser) {
            await browser.close(); // Ensure the browser is closed
            console.log("Puppeteer browser closed.");
        }
    }
}
// --- End Screenshot Function ---

// --- Schedule Screenshot Task ---
async function setupScreenshotTask() {
    try {
        // Ensure the screenshot directory exists
        await fs.mkdir(screenshotDirectory, { recursive: true });
        console.log(`Screenshot directory ensured: ${screenshotDirectory}`);

        // Check if the URL is valid before scheduling
        if (!urlToCapture) {
            console.warn('GOOGLE_FORM_URL is not defined. Screenshot task will not run.');
            return;
        }

        // Schedule the task
        cron.schedule(cronSchedule, async () => {
            console.log(`Cron job triggered: ${new Date().toISOString()}`);
            const timestamp = Date.now();
            const filename = `${screenshotPrefix}${timestamp}.png`;
            const outputPath = path.join(screenshotDirectory, filename);
            await captureScreenshot(urlToCapture, outputPath);
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata" // Set your timezone if needed
        });

        console.log(`Screenshot capture scheduled: ${cronSchedule}`);
    } catch (error) {
        console.error('Error setting up screenshot directory or scheduling task:', error);
    }
}

// Call the setup function when the script starts
setupScreenshotTask();
// --- End Schedule Screenshot Task ---