import { takeScreenshot, printImage } from './screenshot-lib.js';

// Print Geeknews Topics and slice them each into 10 parts
// for (let i = 1; i <= 10; i++) {
//   const screenshot = await takeScreenshot('https://news.hada.io/', `div.topic_row:nth-child(${i})`);
//   await printImage(screenshot, 'news.hada.io');
// }

// Print Geeknews All Topics
const screenshot = await takeScreenshot('https://news.hada.io/', 'div.topics');
await printImage(screenshot, 'news.hada.io');
