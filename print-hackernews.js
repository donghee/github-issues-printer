import { takeScreenshot, printImage } from './screenshot-lib.js';

// Print Hackernews Topics
const screenshot = await takeScreenshot('https://news.ycombinator.com/', '//*[@id="bigbox"]');
await printImage(screenshot, 'news.ycombinator.com');
