import { test, expect } from "@playwright/test";

test.describe("navigation scroll restoration (#576)", () => {
  test("a new route begins at the top after scrolling", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
      window.scrollTo(0, 1200);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

    const termsLink = page.locator('a[href="/terms"]').first();
    await expect(termsLink).toBeVisible();
    await termsLink.click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  });

  test("same-page top anchor scrolls to the top", async ({ page }) => {
    await page.goto("/terms");
    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
      const top = document.createElement("div");
      top.id = "top";
      document.body.prepend(top);
      window.scrollTo(0, 1200);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "#top";
      link.textContent = "Back to top";
      document.body.append(link);
      link.click();
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  });
});
