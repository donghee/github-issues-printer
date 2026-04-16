import { chromium } from 'playwright';
import fetch from 'node-fetch';

const PRINTER_WEBHOOK_URL  = process.env.PRINTER_WEBHOOK_URL || 'http://localhost:3000/image-webhook';

export async function takeScreenshot(url, locator, injectStyle) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, // iPhone 6/7/8 viewport
  });

  const page = await context.newPage();
  console.log(`Created browser and page`);
  await page.goto(url);
  if (injectStyle) {
    await page.addStyleTag(injectStyle);
  }
  const ss = (await page.locator(locator).screenshot()).toString('base64url');
  console.log('Screenshot taken');
  await browser.close();

  return `data:image/png;base64,${ss}`;
}

export async function printImage(base64URL, title, webhookUrl = PRINTER_WEBHOOK_URL) {
  console.log(`Writing to printer...`);
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Image-Event': 'image',
    },
    body: JSON.stringify({
      action: 'uploaded',
      image: {
        title,
        base64: base64URL,
        created_at: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.text();
}
