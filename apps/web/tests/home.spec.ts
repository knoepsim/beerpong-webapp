import { test, expect } from '@playwright/test';

test('shows the start page to visitors and leads them to the login', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Turniere einfach organisieren.' })).toBeVisible();
  await page.getByRole('link', { name: 'Jetzt starten' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('MatchBase', { exact: true })).toBeVisible();
  await expect(page.locator('input[type="tel"]')).toBeVisible();
});
