import { expect, test } from "../support/test";

async function scrollToPageBottom(page: import("@playwright/test").Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
}

async function expectNearTop(page: import("@playwright/test").Page) {
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name}: header route navigation starts at the top`, async ({ mockedPage: page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await scrollToPageBottom(page);

    if (viewport.name === "mobile") {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }
    await page.getByRole("link", { name: "Pricing" }).click();

    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expectNearTop(page);
  });
}

test("footer and inner-route navigation start at the top", async ({ mockedPage: page }) => {
  await page.goto("/pricing");
  await scrollToPageBottom(page);
  await page.getByRole("link", { name: "Terms and Conditions" }).click();

  await expect(page).toHaveURL(/\/terms$/);
  await expectNearTop(page);
});

test("section and top hashes account for the sticky header", async ({ mockedPage: page }) => {
  await page.goto("/");
  await scrollToPageBottom(page);
  await page.getByRole("link", { name: "Why RecruiterReply" }).click();

  await expect(page).toHaveURL(/\/#why-recruiterreply$/);
  const section = page.locator("#why-recruiterreply");
  await expect.poll(() => section.evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBeGreaterThanOrEqual(95);

  await scrollToPageBottom(page);
  await page.getByRole("link", { name: "Back to top" }).click();
  await expect(page).toHaveURL(/\/#top$/);
  await expectNearTop(page);
});

test("Back restores the prior scroll position without a forced top reset", async ({ mockedPage: page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  const previousScrollY = await page.evaluate(() => window.scrollY);

  await page.getByRole("link", { name: "Pricing" }).click();
  await expectNearTop(page);
  await page.goBack();

  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(previousScrollY - 100);
});

test("a refreshed section deep link lands below the sticky header", async ({ mockedPage: page }) => {
  await page.goto("/#why-recruiterreply");
  const section = page.locator("#why-recruiterreply");
  await expect(section).toBeVisible();
  await expect.poll(() => section.evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBeGreaterThanOrEqual(95);

  await page.reload();
  await expect.poll(() => section.evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBeGreaterThanOrEqual(95);
});
