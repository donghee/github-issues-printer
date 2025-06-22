import { chromium } from 'playwright';
import  fs from 'fs';
import fetch from 'node-fetch';

// export async function takeScreenshot(issueId: string) {
export async function takeScreenshot(url, locator, injectStyle) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone 6/7/8 viewport
  });

  const page = await context.newPage();
  console.log(`Created browser and page`);
  // await page.goto(`http://localhost:3000/sentry/${issueId}`);
  await page.goto(url);
  if (injectStyle) {
    await page.addStyleTag(injectStyle);
  }
  const ss = (await page.locator(locator).screenshot()).toString('base64url');
  console.log('Screenshot taken');
  const base64URL = `data:image/png;base64,${ss}`;
  await browser.close();

  // save the screenshot to a png file for testing purposes
  //fs.writeFileSync('./screenshot.png', Buffer.from(ss, 'base64'));
  //console.log(`Screenshot saved to ./screenshot.png`);

  console.log(`Writing to printer...`);
  fetch('http://localhost:3000/image-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Image-Event': 'image',
    },
    body: JSON.stringify({
      action: 'uploaded',
      image: {
        title: 'news.hada.io',
        base64: base64URL,
        created_at: new Date().toISOString(),
      },
    }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
  })
}

// Print Geeknews Topics
for (let i = 1; i <= 3; i++) {
  await takeScreenshot('https://news.hada.io/', `div.topic_row:nth-child(${i})`);
}

// Print GitHub Trending Repositories
for (let i = 1; i <= 3; i++) {
  await takeScreenshot('https://github.com/trending?since=weekly', `.container-lg .Box .Box-row:nth-child(${i})`, {content: '.float-right {display: none !important;} .col-9 {width: 100% !important;}'});
} 

