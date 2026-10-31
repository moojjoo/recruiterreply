import { expect, test } from '../support/test';

type ToolCase = {
  path: string;
  resultHeading: string;
  submit(page: import('@playwright/test').Page): Promise<void>;
};

const tools: ToolCase[] = [
  {
    path: '/analyze',
    resultHeading: 'Analysis Results',
    async submit(page) {
      await page.getByLabel('Recruiter message input').fill('Remote role at Acme, $150k.');
      await page.getByRole('button', { name: /Analyze Message/ }).click();
    },
  },
  {
    path: '/reply',
    resultHeading: 'Generated Reply',
    async submit(page) {
      await page.getByLabel('Recruiter message', { exact: true }).fill('Are you interested?');
      await page.getByRole('button', { name: /Generate Reply/ }).click();
    },
  },
  {
    path: '/compare',
    resultHeading: 'Comparison Results',
    async submit(page) {
      const companies = page.getByPlaceholder('Company name');
      const salaries = page.getByPlaceholder('150000');
      await companies.nth(0).fill('Acme');
      await companies.nth(1).fill('Globex');
      await salaries.nth(0).fill('160000');
      await salaries.nth(1).fill('150000');
      await page.getByRole('button', { name: 'Compare Offers' }).click();
    },
  },
];

async function installScrollRecorder(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const calls: ScrollBehavior[] = [];
    Object.defineProperty(window, '__resultScrollCalls', { value: calls });
    Element.prototype.scrollIntoView = function scrollIntoView(options?: boolean | ScrollIntoViewOptions) {
      if (typeof options === 'object') calls.push(options.behavior ?? 'auto');
    };
  });
}

async function scrollCalls(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    (window as unknown as { __resultScrollCalls: ScrollBehavior[] }).__resultScrollCalls,
  );
}

function rgb(value: string): number[] {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(`Unexpected computed color: ${value}`);
  return match.slice(1).map(Number);
}

function luminance(color: number[]): number {
  const channels = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: number[], b: number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

for (const tool of tools) {
  test(`${tool.path} reveals each rendered result and preserves themed contrast`, async ({ authedPage: page }) => {
    await installScrollRecorder(page);
    await page.addInitScript(() => localStorage.setItem('recruiterreply-theme', 'light'));
    await page.goto(tool.path);
    expect(await scrollCalls(page)).toEqual([]);

    await tool.submit(page);
    const region = page.getByRole('region', { name: 'Generated results' });
    await expect(region.getByRole('heading', { name: tool.resultHeading })).toBeVisible();
    await expect(region.locator('.tool-results-heading')).toBeFocused();
    expect(await scrollCalls(page)).toEqual(['smooth']);
    await expect(region.locator('.tool-results-heading')).toHaveCSS('scroll-margin-top', '104px');

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(region).toBeVisible();
    const surface = region.locator('.card, .card-elevated').first();
    // Let the existing theme transition settle before measuring final colors.
    await page.waitForTimeout(500);
    const colors = await surface.evaluate((node) => {
      const style = getComputedStyle(node);
      return { foreground: style.color, background: style.backgroundColor };
    });
    expect(contrast(rgb(colors.foreground), rgb(colors.background))).toBeGreaterThanOrEqual(4.5);

    await tool.submit(page);
    await expect.poll(() => scrollCalls(page)).toEqual(['smooth', 'smooth']);
  });
}

test('reduced motion reveals results without smooth scrolling on a narrow viewport', async ({ authedPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installScrollRecorder(page);
  await page.goto('/analyze');
  await tools[0].submit(page);
  await expect(page.locator('.tool-results-heading')).toBeFocused();
  expect(await scrollCalls(page)).toEqual(['instant']);
});

test('an asynchronous error is announced, focused, and revealed', async ({ authedPage: page }) => {
  await installScrollRecorder(page);
  await page.route('**/api/analyze-recruiter-message', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Upstream failure' }) }),
  );
  await page.goto('/analyze');
  await tools[0].submit(page);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Upstream failure');
  await expect(alert).toBeFocused();
  expect(await scrollCalls(page)).toEqual(['smooth']);
});
