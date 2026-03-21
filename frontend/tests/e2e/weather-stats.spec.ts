import { test, expect } from '@playwright/test';

test('weather stats page shows monthly extremes card', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.metric-card');
  const text = await page.locator('.metric-card').nth(3).textContent();
  expect(text).toBeTruthy();
});
