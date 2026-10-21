import { test, expect } from '@playwright/test';

test('redirects unauthenticated visitors from root to login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('MatchBase', { exact: true })).toBeVisible();
  await expect(page.locator('input[type="tel"]')).toBeVisible();
});
