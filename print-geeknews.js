import { takeScreenshot, printImage } from './screenshot-lib.js';

// Print Geeknews Topics
for (let i = 1; i <= 10; i++) {
  const screenshot = await takeScreenshot('https://news.hada.io/', `div.topic_row:nth-child(${i})`);
  await printImage(screenshot, 'news.hada.io');
}
