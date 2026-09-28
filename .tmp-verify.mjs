import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });
await page.waitForSelector('text=Finoplan', { timeout: 10000 });

await page.fill('input[placeholder="Passphrase"]', 'test-passphrase-1234');
await page.fill('input[placeholder="Confirm passphrase"]', 'test-passphrase-1234');
await page.click('button:has-text("Create passphrase")');
await page.waitForSelector('nav >> text=Rules', { timeout: 10000 });

await page.click('nav >> text=Rules');
await page.waitForSelector('text=Recurring Rules');
await page.screenshot({ path: '/tmp/glitch-0-rules-empty.png' });

// Create a rule
await page.click('button:has-text("Add recurring rule")');
await page.waitForSelector('text=Add recurring rule');
await page.fill('input[placeholder="e.g. Netflix Subscription"]', 'Rent');
await page.fill('input[placeholder="Enter amount"]', '24000');
await page.selectOption('select:near(:text("Category"))', { index: 1 });
await page.click('button:has-text("Expense")');
await page.fill('input[type="number"][min="1"][max="31"]', '5');
await page.fill('input[type="date"]', '2026-09-01');
await page.click('button:has-text("Add rule")');

// Immediately screenshot right after the sheet closes, no waiting for async settle
await page.waitForSelector('text=Recurring Rules');
await page.screenshot({ path: '/tmp/glitch-1-immediately-after-create.png' });

// Now wait a bit and screenshot again (after async execution-info fetch resolves)
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/glitch-2-after-settle.png' });

// Measure the filter chips container's bounding box at both moments by re-triggering an edit
await page.click('button:has-text("Rent")');
await page.waitForSelector('text=Edit recurring rule');
await page.fill('input[placeholder="Enter amount"]', '25000');
await page.click('button:has-text("Save rule")');
await page.waitForSelector('text=Recurring Rules');
await page.screenshot({ path: '/tmp/glitch-3-immediately-after-edit.png' });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/glitch-4-after-edit-settle.png' });

await browser.close();
