// @ts-nocheck
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log('Starting browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/auth/login');
    
    // Fill credentials
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    console.log('Waiting for successful login...');
    await page.waitForURL('**/admin**', { timeout: 10000 });
    
    // Go directly to the Mr Brightside page we were editing before
    console.log('Navigating to Page Editor (home)...');
    await page.goto('http://localhost:3000/admin/pages/pB12iA7xS15S4t0'); // Replace with actual ID, or click through
    
    // Actually, let's just click Settings -> Pages -> First Page
    await page.goto('http://localhost:3000/admin/pages');
    await page.waitForSelector('text=home');
    await page.click('text=Edit');
    
    console.log('Waiting for Editor to load...');
    await page.waitForTimeout(3000); // give it time to fetch blocks and render the canvas
    
    const outputPath = '/Users/andre/.gemini/antigravity/brain/6f15e8c2-dc3c-47d7-b07e-3ee53a50b1ae/canvas_studio_template_fix_' + Date.now() + '.webp';
    await page.screenshot({ path: outputPath, fullPage: true });
    
    console.log(`Saved screenshot to: ${outputPath}`);
    
    await browser.close();
}

main().catch(console.error);
