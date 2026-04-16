import { takeScreenshot, printImage } from './screenshot-lib.js';

// Print Geeknews Topics
// for (let i = 1; i <= 3; i++) {
//   const screenshot = await takeScreenshot('https://news.hada.io/', `div.topic_row:nth-child(${i})`);
//   await printImage(screenshot, 'news.hada.io');
// }

// Print GitHub Trending Repositories
for (let i = 1; i <= 10; i++) {
  const screenshot = await takeScreenshot(
    'https://github.com/trending?since=weekly',
    `.container-lg .Box .Box-row:nth-child(${i})`,
    { content: '.float-right {display: none !important;} .col-9 {width: 100% !important;}' }
  );
  await printImage(screenshot, 'github.com/trending');
  await new Promise(resolve => setTimeout(resolve, 3000)); // wait for 3 seconds before taking the next screenshot
}
