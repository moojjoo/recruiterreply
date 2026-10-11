import { test, expect } from '../support/test';

const routes = [
  { path: '/analyze', title: 'Message Analyzer', active: 'Analyze Messages' },
  { path: '/reply', title: 'Reply Generator', active: 'Generate Replies' },
  { path: '/compare', title: 'Offer Comparison', active: 'Compare Offers' },
];

function rgb(value: string): number[] {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error('Unexpected computed color: ' + value);
  return match.slice(1).map(Number);
}
function luminance(color: number[]): number {
  const channels = color.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: number[], b: number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
async function checkColors(page: import('@playwright/test').Page, mode: 'light' | 'dark') {
  const hero = page.locator('.tool-page-hero');
  const heroBg = rgb(await hero.evaluate(node => getComputedStyle(node).backgroundColor));
  expect(mode === 'light' ? luminance(heroBg) : 1 - luminance(heroBg)).toBeGreaterThan(0.8);
  for (const selector of ['.section-title', '.section-subtitle']) {
    const node = hero.locator(selector);
    const fg = rgb(await node.evaluate(element => getComputedStyle(element).color));
    expect(contrast(fg, heroBg), selector + ' contrast').toBeGreaterThanOrEqual(4.5);
  }
  const tabs = hero.locator('.tool-nav-tab');
  await expect(tabs).toHaveCount(3);
  for (const tab of await tabs.all()) {
    const bg = rgb(await tab.evaluate(element => getComputedStyle(element).backgroundColor));
    const fg = rgb(await tab.evaluate(element => getComputedStyle(element).color));
    expect(contrast(fg, bg), 'tool navigation tab contrast').toBeGreaterThanOrEqual(4.5);
  }
}
for (const { path, title, active } of routes) {
  test(path + ' hero and tabs follow light/dark/light', async ({ authedPage: page }) => {
    await page.addInitScript(() => localStorage.setItem('recruiterreply-theme', 'light'));
    await page.goto(path);
    await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Tools' }).getByText(active)).toHaveAttribute('aria-current', 'page');
    await checkColors(page, 'light');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await checkColors(page, 'dark');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await checkColors(page, 'light');
    await page.reload();
    await checkColors(page, 'light');
  });
}
